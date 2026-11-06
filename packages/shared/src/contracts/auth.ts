import type { Permission, RoleCode } from '../domain/permissions.js'

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

/** Datos mínimos de la persona que se exponen en el perfil. */
export interface PersonaResumen {
  nombres: string
  apellidos: string
  tipoDocumento: string
  numeroDocumento: string
}

/**
 * Respuesta de `GET /me` (RF-CORE-005).
 *
 * `permissions` es la unión de los permisos de todos los roles del usuario
 * (RN-CORE-010), calculada en el backend.
 */
export interface MeResponse {
  id: string
  username: string | null
  email: string | null
  debeCambiarPassword: boolean
  persona: PersonaResumen
  roles: RoleCode[]
  permissions: Permission[]
}

/** Respuesta de `POST /auth/forgot-password`. No revela si el correo existe. */
export interface ForgotPasswordResponse {
  message: string
}

/** Respuesta de `POST /auth/reset-password`. */
export interface ResetPasswordResponse {
  message: string
}

/**
 * Respuesta de `POST /usuarios/:id/token-recuperacion`.
 *
 * El token en claro se devuelve una única vez; la base solo conserva su hash.
 */
export interface RecoveryTokenResponse {
  token: string
  /** Fecha ISO-8601 en la que el token deja de ser válido. */
  expiresAt: string
}
