import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  uuidParamSchema,
} from '@intranet/shared'
import type { FastifyReply, FastifyRequest } from 'fastify'
import type { ZodType } from 'zod'
import {
  clearRefreshCookie,
  REFRESH_COOKIE,
  setRefreshCookie,
} from '../../../core/auth/cookies.js'
import {
  assertLoginAllowed,
  clearLoginFailures,
  loginAttemptKey,
  recordLoginFailure,
} from '../../../core/auth/login-throttle.js'
import { AppError } from '../../../core/errors.js'
import {
  forgotPassword,
  getPerfil,
  issueRecoveryToken,
  login,
  logout,
  refreshSession,
  resetPassword,
} from './auth.service.js'

/**
 * Valida el cuerpo o los parámetros con un schema compartido.
 *
 * Convierte los problemas de Zod en detalles del sobre de error, sin exponer
 * los valores recibidos.
 */
function parseOrThrow<T>(schema: ZodType<T>, datos: unknown): T {
  const parsed = schema.safeParse(datos)

  if (!parsed.success) {
    throw new AppError(
      'VALIDATION_ERROR',
      undefined,
      parsed.error.issues.map(
        (issue) => `${issue.path.join('.') || 'cuerpo'}: ${issue.message}`,
      ),
    )
  }

  return parsed.data
}

/**
 * `POST /auth/login`
 *
 * Valida el cuerpo, aplica el límite de intentos fallidos y entrega el refresh
 * en cookie `httpOnly`. El cuerpo nunca contiene el refresh token.
 *
 * El contador solo suma credenciales inválidas o identificadores ambiguos; un
 * acceso correcto lo reinicia (RF-CORE-004).
 */
export async function loginController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const parsed = loginSchema.safeParse(request.body)

  if (!parsed.success) {
    throw new AppError(
      'VALIDATION_ERROR',
      undefined,
      parsed.error.issues.map(
        (issue) => `${issue.path.join('.') || 'cuerpo'}: ${issue.message}`,
      ),
    )
  }

  const clave = loginAttemptKey(request.ip, parsed.data.identifier)

  assertLoginAllowed(clave)

  let resultado: Awaited<ReturnType<typeof login>>

  try {
    resultado = await login(parsed.data)
  } catch (error) {
    if (
      error instanceof AppError &&
      (error.code === 'UNAUTHORIZED' || error.code === 'CONFLICT')
    ) {
      recordLoginFailure(clave)
    }

    throw error
  }

  clearLoginFailures(clave)

  setRefreshCookie(reply, resultado.refresh)

  reply.code(200).send({
    accessToken: resultado.accessToken,
    tokenType: resultado.tokenType,
    expiresIn: resultado.expiresIn,
  })
}

/**
 * `GET /me`
 *
 * Devuelve el perfil, los roles y los permisos efectivos del usuario
 * autenticado. Requiere el `preHandler` `requireAuth`.
 */
export async function meController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const actor = request.authUser

  if (!actor) {
    throw new AppError('UNAUTHORIZED')
  }

  reply.code(200).send(await getPerfil(actor.id))
}

/**
 * `POST /auth/refresh`
 *
 * Renueva el access token a partir de la cookie y entrega un refresh rotado.
 * No devuelve el refresh en el cuerpo.
 */
export async function refreshController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const token = request.cookies[REFRESH_COOKIE]

  if (!token) {
    throw new AppError('UNAUTHORIZED', 'No hay una sesión activa.')
  }

  const resultado = await refreshSession(token)

  setRefreshCookie(reply, resultado.refresh)

  reply.code(200).send({
    accessToken: resultado.accessToken,
    tokenType: resultado.tokenType,
    expiresIn: resultado.expiresIn,
  })
}

/**
 * `POST /auth/logout`
 *
 * Revoca la sesión actual y elimina la cookie. Requiere `requireAuth`.
 */
export async function logoutController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const actor = request.authUser

  if (!actor) {
    throw new AppError('UNAUTHORIZED')
  }

  await logout(actor.id, request.cookies[REFRESH_COOKIE])

  clearRefreshCookie(reply)

  reply.code(204).send()
}

/**
 * `POST /auth/forgot-password`
 *
 * Responde siempre `202`, exista o no el correo, para no revelar qué cuentas
 * están registradas (RF-CORE-007).
 */
export async function forgotPasswordController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const input = parseOrThrow(forgotPasswordSchema, request.body)

  await forgotPassword(input)

  reply.code(202).send({
    message:
      'Si el correo está registrado, el administrador podrá entregarte un enlace de recuperación.',
  })
}

/**
 * `POST /auth/reset-password`
 *
 * Consume el token de un solo uso y cambia la contraseña. El token debe
 * obtenerlo el usuario a través de la administración.
 */
export async function resetPasswordController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const input = parseOrThrow(resetPasswordSchema, request.body)

  await resetPassword(input)

  reply.code(200).send({ message: 'Contraseña actualizada correctamente.' })
}

/**
 * `POST /usuarios/:id/token-recuperacion`
 *
 * Emite el token en claro una única vez para que el administrador lo entregue.
 * Requiere `core.usuarios.gestionar` y un usuario vigente.
 */
export async function issueRecoveryTokenController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { id } = parseOrThrow(uuidParamSchema, request.params)

  reply.code(200).send(await issueRecoveryToken(id))
}
