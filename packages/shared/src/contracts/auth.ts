/**
 * Respuesta de un inicio de sesión exitoso.
 *
 * El refresh token nunca viaja en el cuerpo: se entrega en la cookie
 * `refresh_token` con `HttpOnly`.
 */
export interface LoginResponse {
  accessToken: string
  tokenType: 'Bearer'
  /** Vigencia del token de acceso en segundos. */
  expiresIn: number
}
