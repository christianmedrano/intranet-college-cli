import type { FastifyReply } from 'fastify'
import { loadConfig } from '../config.js'
import type { RefreshToken } from './tokens.js'

/** Nombre de la cookie de refresh (plan §5). */
export const REFRESH_COOKIE = 'refresh_token'

/** La cookie solo se envía a los endpoints de autenticación. */
export const REFRESH_COOKIE_PATH = '/api/v1/auth'

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
