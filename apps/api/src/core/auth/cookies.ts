import type { FastifyReply } from 'fastify'
import { loadConfig } from '../config.js'
import type { RefreshToken } from './tokens.js'

/** Nombre de la cookie de refresh (plan §5). */
export const REFRESH_COOKIE = 'refresh_token'

/** La cookie solo se envía a los endpoints de la API. */
export const REFRESH_COOKIE_PATH = '/api/v1'

/**
 * Establece la cookie `httpOnly` con el refresh token.
 *
 * `Secure` se activa en producción; `SameSite=Lax` permite el flujo normal de
 * navegación sin exponer la cookie a peticiones de terceros.
 */
export function setRefreshCookie(
  reply: FastifyReply,
  refresh: RefreshToken,
): void {
  reply.setCookie(REFRESH_COOKIE, refresh.token, {
    httpOnly: true,
    secure: loadConfig().NODE_ENV === 'production',
    sameSite: 'lax',
    path: REFRESH_COOKIE_PATH,
    expires: refresh.expiraEn,
  })
}

/**
 * Elimina la cookie de refresh.
 *
 * Debe usar el mismo `path` con el que se creó; de lo contrario el navegador
 * conserva la cookie original.
 */
export function clearRefreshCookie(reply: FastifyReply): void {
  reply.clearCookie(REFRESH_COOKIE, { path: REFRESH_COOKIE_PATH })
}
