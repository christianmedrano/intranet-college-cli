import type {
  EstadoAsistencia,
  EstadoJustificacion,
} from '@intranet/shared'
import { ApiClientError } from '../../../shared/api/client'

/**
 * Traduce un error de la API a un mensaje apto para la interfaz.
 *
 * Los detalles de validación se muestran tal como los redacta el backend;
 * nunca se exponen trazas ni información técnica.
 */
export function mensajeError(error: unknown): string {
  if (error instanceof ApiClientError) {
    return error.details.length > 0 ? error.details.join(' ') : error.message
  }

  return 'Ocurrió un error inesperado. Inténtalo de nuevo.'
}

const ETIQUETAS_ASISTENCIA: Readonly<Record<EstadoAsistencia, string>> = {
  PRESENTE: 'Presente',
  TARDE: 'Tarde',
  FALTA_JUSTIFICADA: 'Falta justificada',
  FALTA_INJUSTIFICADA: 'Falta injustificada',
}

/** Texto en español de un estado de asistencia (RF-ACAD-004). */
export function etiquetaEstadoAsistencia(estado: EstadoAsistencia): string {
  return ETIQUETAS_ASISTENCIA[estado]
}

const ETIQUETAS_JUSTIFICACION: Readonly<Record<EstadoJustificacion, string>> = {
  SOLICITADA: 'Solicitada',
  APROBADA: 'Aprobada',
  RECHAZADA: 'Rechazada',
}

/** Texto en español de un estado de justificación (RF-ACAD-006). */
export function etiquetaEstadoJustificacion(
  estado: EstadoJustificacion,
): string {
  return ETIQUETAS_JUSTIFICACION[estado]
}
