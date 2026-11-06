import type {
  LoginInput,
  LoginResponse,
  MeResponse,
} from '@intranet/shared'
import { verifyPassword } from '../../../core/auth/password.js'
import {
  createRefreshToken,
  signAccessToken,
  type RefreshToken,
} from '../../../core/auth/tokens.js'
import { getPrisma } from '../../../core/db.js'
import { AppError } from '../../../core/errors.js'
import { getEffectivePermissions, normalizeRoleCodes } from '../../../core/rbac.js'
import type { PrismaClient } from '../../../generated/prisma/client.js'
import {
  findUsuarioConRoles,
  findUsuariosPorIdentificador,
  registrarInicioDeSesion,
} from './auth.repository.js'

/** Resultado interno: incluye el refresh en claro para la cookie. */
export interface LoginResult extends LoginResponse {
  refresh: RefreshToken
}

/**
 * Autentica a un usuario con identificador flexible.
 *
 * Reglas aplicadas:
 * - RN-CORE-015: si el identificador coincide con más de un usuario, se rechaza
 *   para forzar uno más específico (`409`).
 * - RN-CORE-006: un usuario inactivo no puede autenticarse.
 * - Los fallos de credenciales responden siempre igual, sin revelar si el
 *   identificador existe (RF-CORE-004).
 *
 * @param input Credenciales ya validadas por Zod.
 * @param prisma Cliente inyectable para las pruebas.
 * @throws AppError `CONFLICT` si hay ambigüedad; `UNAUTHORIZED` si las
 * credenciales no son válidas o el usuario está inactivo.
 */
export async function login(
  input: LoginInput,
  prisma: PrismaClient = getPrisma(),
): Promise<LoginResult> {
  const usuarios = await findUsuariosPorIdentificador(prisma, input.identifier)

  if (usuarios.length > 1) {
    throw new AppError(
      'CONFLICT',
      'El identificador coincide con más de un usuario. Usa uno más específico.',
    )
  }

  const usuario = usuarios[0]

  if (!usuario || !usuario.activo) {
    throw new AppError('UNAUTHORIZED', 'Credenciales inválidas.')
  }

  if (!(await verifyPassword(usuario.passwordHash, input.password))) {
    throw new AppError('UNAUTHORIZED', 'Credenciales inválidas.')
  }

  const access = await signAccessToken(usuario.id)
  const refresh = createRefreshToken()

  await registrarInicioDeSesion(prisma, {
    usuarioId: usuario.id,
    tokenHash: refresh.tokenHash,
    expiraEn: refresh.expiraEn,
    ahora: new Date(),
  })

  return {
    accessToken: access.token,
    tokenType: 'Bearer',
    expiresIn: access.expiresIn,
    refresh,
  }
}

/**
 * Devuelve el perfil del usuario autenticado con sus roles y permisos
 * efectivos (RF-CORE-005).
 *
 * Vuelve a comprobar la vigencia del usuario porque el token puede haber sido
 * emitido antes de una desactivación (RN-CORE-006).
 *
 * @param usuarioId Identificador del usuario autenticado.
 * @param prisma Cliente inyectable para las pruebas.
 * @throws AppError `UNAUTHORIZED` si el usuario ya no existe o está inactivo.
 */
export async function getPerfil(
  usuarioId: string,
  prisma: PrismaClient = getPrisma(),
): Promise<MeResponse> {
  const usuario = await findUsuarioConRoles(prisma, usuarioId)

  if (!usuario || !usuario.activo) {
    throw new AppError('UNAUTHORIZED', 'La sesión no es válida.')
  }

  const roles = normalizeRoleCodes(
    usuario.roles.map((fila) => fila.rol.codigo),
  )

  return {
    id: usuario.id,
    username: usuario.username,
    email: usuario.email,
    debeCambiarPassword: usuario.debeCambiarPassword,
    persona: {
      nombres: usuario.persona.nombres,
      apellidos: usuario.persona.apellidos,
      tipoDocumento: usuario.persona.tipoDocumento,
      numeroDocumento: usuario.persona.numeroDocumento,
    },
    roles,
    permissions: getEffectivePermissions(roles),
  }
}
