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
