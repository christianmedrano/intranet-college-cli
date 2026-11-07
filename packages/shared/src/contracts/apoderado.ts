import type { PersonaResponse } from './persona.js'

/**
 * Vínculo de un apoderado con uno de sus alumnos (RF-CORE-014).
 *
 * Es la vista desde el apoderado: resume al alumno sin anidar sus propios
 * apoderados, para evitar una estructura recursiva.
 */
export interface AlumnoVinculoResponse {
  alumnoId: string
  parentesco: string
  esPrincipal: boolean
  alumno: {
    id: string
    codigoAlumno: string
    persona: PersonaResponse
  }
}

/**
 * Apoderado expuesto por la API (RF-CORE-014).
 *
 * `alumnos` permite cumplir el criterio "un apoderado con dos alumnos los ve
 * ambos" sin una consulta adicional.
 */
export interface ApoderadoResponse {
  id: string
  ocupacion: string | null
  persona: PersonaResponse
  alumnos: AlumnoVinculoResponse[]
}

/** Resultado de vincular un alumno a un apoderado. */
export interface VinculoAlumnoResponse {
  apoderadoId: string
  alumnoId: string
  parentesco: string
  esPrincipal: boolean
}
