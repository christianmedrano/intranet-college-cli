import type { FastifyRequest } from 'fastify'
import { getPrisma } from '../db.js'
import { AppError } from '../errors.js'
import { normalizeRoleCodes } from '../rbac.js'
import { verifyAccessToken } from './tokens.js'

const PATRON_BEARER = /^Bearer\s+(\S+)$/i

/** Extrae el token de `Authorization: Bearer <token>`. */
export function extractBearerToken(
  authorization: string | undefined,
): string | undefined {
  if (!authorization) {
    return undefined
  }

  return PATRON_BEARER.exec(authorization.trim())?.[1]
}

/**
 * `preHandler` que exige un token de acceso válido.
 *
 * Verifica firma y expiración, y luego recarga el usuario para comprobar que
 * sigue activo y sin borrado lógico (RN-CORE-006). Así una desactivación surte
 * efecto sin esperar a que caduque el token.
 *
 * Hidrata `request.authUser` con la identidad y sus roles para que
 * `requirePermission` pueda evaluar el permiso.
 *
 * @throws AppError `UNAUTHORIZED` si falta el token, es inválido o el usuario
 * ya no está vigente.
 */
export async function requireAuth(request: FastifyRequest): Promise<void> {
  const token = extractBearerToken(request.headers.authorization)

  if (!token) {
    throw new AppError('UNAUTHORIZED')
  }

  let usuarioId: string

  try {
    usuarioId = await verifyAccessToken(token)
  } catch {
    throw new AppError('UNAUTHORIZED')
  }

  const usuario = await getPrisma().usuario.findFirst({
    where: { id: usuarioId, activo: true, deletedAt: null },
    select: {
      id: true,
      roles: { select: { rol: { select: { codigo: true } } } },
    },
  })

  if (!usuario) {
    throw new AppError('UNAUTHORIZED')
  }

  request.authUser = {
    id: usuario.id,
    roles: normalizeRoleCodes(usuario.roles.map((fila) => fila.rol.codigo)),
  }
}
