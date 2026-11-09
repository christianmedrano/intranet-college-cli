import type { EstadoAsistencia } from '../../domain/academic.js'

/**
 * Asistencia diaria expuesta por la API (RF-ACAD-004).
 *
 * `fecha` es una fecha escolar `YYYY-MM-DD`, sin hora ni zona horaria
 * (RN-ACAD-024).
 */
export interface AsistenciaResponse {
  id: string
  alumnoId: string
  fecha: string
  estado: EstadoAsistencia
  observacion: string | null
  createdAt: string
  updatedAt: string
}
