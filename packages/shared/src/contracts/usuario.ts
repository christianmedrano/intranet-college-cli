import type { RoleCode } from '../domain/permissions.js'
import type { PersonaResponse } from './persona.js'

/**
 * Cuenta de acceso expuesta por la API (RF-CORE-002).
 *
 * Nunca incluye el hash de la contraseña ni el PIN temporal. Los roles viajan
 * en el orden canónico del catálogo para que la unión de permisos sea estable.
 */
export interface UsuarioResponse {
  id: string
  username: string | null
  email: string | null
  activo: boolean
  debeCambiarPassword: boolean
  ultimoAcceso: string | null
  persona: PersonaResponse
  roles: RoleCode[]
}

/**
 * Respuesta del alta de usuario.
 *
 * `pinTemporal` se entrega una sola vez y no se vuelve a exponer: el
 * administrador debe comunicarlo por un canal seguro (RN-CORE-016).
 */
export interface UsuarioCreadoResponse extends UsuarioResponse {
  pinTemporal: string
}
