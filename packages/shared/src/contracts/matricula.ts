import type { EstadoMatricula } from '../schemas/matricula.js'
import type { PersonaResponse } from './persona.js'

/**
 * Matrícula expuesta por la API (RF-CORE-015).
 *
 * Incluye año, nivel, grado y sección de forma plana para que el cliente no
 * tenga que recorrer la relación completa. `fechaMatricula` viaja en ISO 8601
 * con hora porque en el modelo es `DateTime`.
 */
export interface MatriculaResponse {
  id: string
  alumnoId: string
  seccionId: string
  anioId: string
  estado: EstadoMatricula
  fechaMatricula: string
  alumno: {
    id: string
    codigoAlumno: string
    persona: PersonaResponse
  }
  anio: {
    id: string
    nombre: string
  }
  nivel: {
    id: string
    nombre: string
  }
  grado: {
    id: string
    nombre: string
  }
  seccion: {
    id: string
    nombre: string
  }
}
