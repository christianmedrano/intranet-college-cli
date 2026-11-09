import type { EstadoJustificacion } from '../../domain/academic.js'

/**
 * Solicitud de justificación de una falta (RF-ACAD-006).
 *
 * `resueltoPor`, `resueltoEn` y `motivoResolucion` son `null` mientras el
 * estado sea `SOLICITADA`.
 */
export interface JustificacionResponse {
  id: string
  asistenciaId: string
  solicitanteUsuarioId: string
  motivo: string
  estado: EstadoJustificacion
  resueltoPor: string | null
  resueltoEn: string | null
  motivoResolucion: string | null
  createdAt: string
  updatedAt: string
}
