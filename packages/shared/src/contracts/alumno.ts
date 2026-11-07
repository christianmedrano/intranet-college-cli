import type { PersonaResponse } from './persona.js'

/**
 * Vínculo de un alumno con uno de sus apoderados (RF-CORE-014).
 *
 * Es la vista desde el alumno: resume al apoderado sin anidar sus propios
 * alumnos, para evitar una estructura recursiva.
 */
export interface ApoderadoVinculoResponse {
  apoderadoId: string
  parentesco: string
  esPrincipal: boolean
  apoderado: PersonaResponse
}

/**
 * Alumno expuesto por la API (RF-CORE-012).
 *
 * Incluye sus datos personales y los vínculos con apoderados. La matrícula se
 * expone en su propio módulo (RF-CORE-015).
 */
export interface AlumnoResponse {
  id: string
  codigoAlumno: string
  fechaIngreso: string | null
  observaciones: string | null
  persona: PersonaResponse
  apoderados: ApoderadoVinculoResponse[]
}
