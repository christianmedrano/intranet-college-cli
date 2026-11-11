import {
  calificacionResponseSchema,
  notaFinalResponseSchema,
  paginatedCalificacionesSchema,
  paginatedNotasFinalesSchema,
  type ActualizarCalificacionInput,
  type ActualizarNotaFinalInput,
  type CrearCalificacionInput,
  type CrearNotaFinalInput,
} from '@intranet/shared'
import { apiRequest } from '../../../shared/api/client'

/** Tamaño máximo admitido por la API para un listado académico. */
const TAMANO_LISTA = 100

/**
 * Listado de calificaciones de un período (RF-ACAD-001).
 *
 * El backend aplica el alcance del rol: docente, apoderado y alumno solo ven
 * los registros que les corresponden.
 */
export function listarCalificaciones(periodoId: string) {
  return apiRequest(
    `/periodos/${periodoId}/calificaciones?page=1&pageSize=${TAMANO_LISTA}`,
    paginatedCalificacionesSchema,
  )
}

/** Listado de notas finales de un período (RF-ACAD-002). */
export function listarNotasFinales(periodoId: string) {
  return apiRequest(
    `/periodos/${periodoId}/notas-finales?page=1&pageSize=${TAMANO_LISTA}`,
    paginatedNotasFinalesSchema,
  )
}

/** Registra una calificación literal (RF-ACAD-001). */
export function crearCalificacion(input: CrearCalificacionInput) {
  return apiRequest('/calificaciones', calificacionResponseSchema, {
    method: 'POST',
    body: input,
  })
}

/** Edita o corrige una calificación existente (RF-ACAD-001, RF-ACAD-003). */
export function actualizarCalificacion(
  id: string,
  input: ActualizarCalificacionInput,
) {
  return apiRequest(`/calificaciones/${id}`, calificacionResponseSchema, {
    method: 'PATCH',
    body: input,
  })
}

/** Registra manualmente la nota final del período (RF-ACAD-002). */
export function crearNotaFinal(input: CrearNotaFinalInput) {
  return apiRequest('/notas-finales', notaFinalResponseSchema, {
    method: 'POST',
    body: input,
  })
}

/** Edita o corrige una nota final existente (RF-ACAD-002, RF-ACAD-003). */
export function actualizarNotaFinal(
  id: string,
  input: ActualizarNotaFinalInput,
) {
  return apiRequest(`/notas-finales/${id}`, notaFinalResponseSchema, {
    method: 'PATCH',
    body: input,
  })
}
