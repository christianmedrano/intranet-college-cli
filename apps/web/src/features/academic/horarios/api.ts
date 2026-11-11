import {
  horarioResponseSchema,
  paginatedAlertasAsistenciaSchema,
  paginatedHorariosSchema,
  umbralAsistenciaResponseSchema,
  type ActualizarHorarioInput,
  type CrearHorarioInput,
  type UmbralAsistenciaInput,
} from '@intranet/shared'
import { apiRequest, apiRequestSinContenido } from '../../../shared/api/client'

/** Tamaño máximo admitido por la API para un listado académico. */
const TAMANO_LISTA = 100

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

/** Obtiene el umbral de inasistencias de un año (RF-ACAD-008). */
export function obtenerUmbral(anioId: string) {
  return apiRequest(
    `/anios-academicos/${anioId}/umbral-asistencia`,
    umbralAsistenciaResponseSchema,
  )
}

/** Configura el umbral de inasistencias de un año (RF-ACAD-008). */
export function guardarUmbral(anioId: string, input: UmbralAsistenciaInput) {
  return apiRequest(
    `/anios-academicos/${anioId}/umbral-asistencia`,
    umbralAsistenciaResponseSchema,
    { method: 'PUT', body: input },
  )
}

/** Listado de alertas de inasistencias con el alcance del rol (RF-ACAD-009). */
export function listarAlertas(filtros: { anioId?: string; alumnoId?: string } = {}) {
  return apiRequest(
    `/alertas-asistencia?${construirQuery(filtros)}`,
    paginatedAlertasAsistenciaSchema,
  )
}

/** Listado de horarios con el alcance del rol (RF-ACAD-011). */
export function listarHorarios(filtros: { anioId: string; seccionId?: string; docenteId?: string }) {
  return apiRequest(
    `/horarios?${construirQuery(filtros)}`,
    paginatedHorariosSchema,
  )
}

/** Crea un bloque de horario (RF-ACAD-010). */
export function crearHorario(input: CrearHorarioInput) {
  return apiRequest('/horarios', horarioResponseSchema, {
    method: 'POST',
    body: input,
  })
}

/** Actualiza parcialmente un bloque de horario (RF-ACAD-010). */
export function actualizarHorario(id: string, input: ActualizarHorarioInput) {
  return apiRequest(`/horarios/${id}`, horarioResponseSchema, {
    method: 'PATCH',
    body: input,
  })
}

/** Elimina lógicamente un bloque de horario (RF-ACAD-010). */
export function eliminarHorario(id: string) {
  return apiRequestSinContenido(`/horarios/${id}`, { method: 'DELETE' })
}