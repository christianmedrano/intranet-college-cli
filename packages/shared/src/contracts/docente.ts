import type { PersonaResponse } from './persona.js'

/**
 * Docente expuesto por la API (RF-CORE-013).
 *
 * No expone credenciales: la cuenta de acceso, si existe, se gestiona en el
 * módulo de usuarios.
 */
export interface DocenteResponse {
  id: string
  codigoDocente: string
  especialidad: string | null
  persona: PersonaResponse
}
