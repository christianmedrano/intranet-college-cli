import {
  asistenciaResponseSchema,
  justificacionResponseSchema,
  paginatedAsistenciasSchema,
  paginatedJustificacionesSchema,
  registrarAsistenciaLoteResponseSchema,
  type CorregirAsistenciaInput,
  type CrearJustificacionInput,
  type EstadoJustificacion,
  type RechazarJustificacionInput,
  type RegistrarAsistenciaLoteInput,
} from '@intranet/shared'
import { apiRequest } from '../../../shared/api/client'

/** Tamaño máximo admitido por la API para un listado académico. */
const TAMANO_LISTA = 100

/** Filtros de consulta de asistencias (RF-ACAD-007). */
export interface FiltrosAsistencias {
  anioId?: string
  seccionId?: string
  desde?: string
  hasta?: string
}

/** Filtros de consulta de justificaciones (RF-ACAD-007). */
export interface FiltrosJustificaciones {
  estado?: EstadoJustificacion
  alumnoId?: string
  seccionId?: string
}

function construirQuery(filtros: object): string {
  const parametros = new URLSearchParams({
    page: '1',
    pageSize: String(TAMANO_LISTA),
  })

  for (const [clave, valor] of Object.entries(filtros)) {
    if (typeof valor === 'string' && valor.length > 0) {
      parametros.set(clave, valor)
    }
  }

  return parametros.toString()
}

/** Listado de asistencias con el alcance del rol (RF-ACAD-007). */
export function listarAsistencias(filtros: FiltrosAsistencias = {}) {
  return apiRequest(
    `/asistencias?${construirQuery(filtros)}`,
    paginatedAsistenciasSchema,
  )
}

/** Registra la asistencia de una sección en una fecha (RF-ACAD-004). */
export function registrarAsistenciaLote(input: RegistrarAsistenciaLoteInput) {
  return apiRequest(
    '/asistencias/lote',
    registrarAsistenciaLoteResponseSchema,
    { method: 'POST', body: input },
  )
}

/** Corrige una asistencia con motivo obligatorio (RF-ACAD-005). */
export function corregirAsistencia(
  id: string,
  input: CorregirAsistenciaInput,
) {
  return apiRequest(`/asistencias/${id}`, asistenciaResponseSchema, {
    method: 'PATCH',
    body: input,
  })
}

/** Listado de justificaciones con el alcance del rol (RF-ACAD-007). */
export function listarJustificaciones(filtros: FiltrosJustificaciones = {}) {
  return apiRequest(
    `/justificaciones?${construirQuery(filtros)}`,
    paginatedJustificacionesSchema,
  )
}

/** El apoderado solicita justificar una falta (RF-ACAD-006). */
export function solicitarJustificacion(
  asistenciaId: string,
  input: CrearJustificacionInput,
) {
  return apiRequest(
    `/asistencias/${asistenciaId}/justificaciones`,
    justificacionResponseSchema,
    { method: 'POST', body: input },
  )
}

/** El tutor o Director aprueba una solicitud (RF-ACAD-006). */
export function aprobarJustificacion(id: string) {
  return apiRequest(`/justificaciones/${id}/aprobar`, justificacionResponseSchema, {
    method: 'POST',
    body: {},
  })
}

/** El tutor o Director rechaza una solicitud con motivo (RF-ACAD-006). */
export function rechazarJustificacion(
  id: string,
  input: RechazarJustificacionInput,
) {
  return apiRequest(
    `/justificaciones/${id}/rechazar`,
    justificacionResponseSchema,
    { method: 'POST', body: input },
  )
}
