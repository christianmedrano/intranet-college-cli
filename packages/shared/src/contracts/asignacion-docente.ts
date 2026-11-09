import type { PersonaResponse } from './persona.js'

/**
 * Asignación docente–curso–sección–año (RF-CORE-011).
 *
 * Incluye los nombres de curso, sección y año para que el cliente pueda listar
 * las asignaciones sin consultas adicionales.
 */
export interface AsignacionDocenteResponse {
  id: string
  docenteId: string
  cursoId: string
  seccionId: string
  anioId: string
  esTutor: boolean
  docente: {
    id: string
    codigoDocente: string
    persona: PersonaResponse
  }
  curso: {
    id: string
    nombre: string
    nivelId: string
  }
  seccion: {
    id: string
    nombre: string
    gradoId: string
  }
  anio: {
    id: string
    nombre: string
  }
}
