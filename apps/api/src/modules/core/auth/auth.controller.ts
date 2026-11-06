import { loginSchema } from '@intranet/shared'
import type { FastifyReply, FastifyRequest } from 'fastify'
import {
  clearRefreshCookie,
  REFRESH_COOKIE,
  setRefreshCookie,
} from '../../../core/auth/cookies.js'
import { AppError } from '../../../core/errors.js'
import { getPerfil, login, logout, refreshSession } from './auth.service.js'

/**
 * `POST /auth/login`
 *
 * Valida el cuerpo, delega en el servicio y entrega el refresh en cookie
 * `httpOnly`. El cuerpo nunca contiene el refresh token.
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

  const resultado = await login(parsed.data)

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
