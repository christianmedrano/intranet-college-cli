import { z } from 'zod'
import {
  certificadoResponseSchema,
  paginatedCertificadosSchema,
  plantillaCertificadoResponseSchema,
  paginatedPlantillasSchema,
  type CrearCertificadoInput,
  type SolicitarCertificadoInput,
  type AprobarCertificadoInput,
  type RechazarCertificadoInput,
  type PlantillaCertificadoInput,
  type ActualizarPlantillaInput,
  type ListarCertificadosQuery,
  type CertificadoResponsePayload,
  type PaginatedCertificadosPayload,
  type PlantillaCertificadoResponsePayload,
  type PaginatedPlantillasPayload,
} from '@intranet/shared'
import { apiRequest, apiRequestSinContenido } from '../../../shared/api/client'

// Re-export types for consumers
export type {
  CertificadoResponsePayload,
  PaginatedCertificadosPayload,
  PlantillaCertificadoResponsePayload,
  PaginatedPlantillasPayload,
}

/** Parámetros para listado de plantillas. */
export interface ListarPlantillasParams {
  page?: number
  pageSize?: number
  tipo?: string
}

/** Respuesta de la descarga de un certificado. */
const descargaCertificadoSchema = z.object({
  message: z.string(),
  certificado: certificadoResponseSchema,
  downloadUrl: z.string(),
})

export type DescargaCertificadoPayload = z.infer<typeof descargaCertificadoSchema>

/**
 * Listado paginado de certificados con filtros (RF-ADM-011 a RF-ADM-013).
 *
 * El backend segmenta el alcance según el rol: el Director ve todos; el
 * apoderado y el alumno solo los propios.
 */
export async function listarCertificados(
  query: Partial<ListarCertificadosQuery> = {},
): Promise<PaginatedCertificadosPayload> {
  const params = new URLSearchParams()
  if (query.page) params.set('page', String(query.page))
  if (query.pageSize) params.set('pageSize', String(query.pageSize))
  if (query.tipo) params.set('tipo', query.tipo)
  if (query.alumnoId) params.set('alumnoId', query.alumnoId)
  if (query.anioId) params.set('anioId', query.anioId)
  if (query.estado) params.set('estado', query.estado)

  return apiRequest(`/api/v1/certificados?${params.toString()}`, paginatedCertificadosSchema)
}

/**
 * Emite un certificado directamente (RF-ADM-011).
 *
 * Requiere el permiso `administrative.certificados.emitir`.
 */
export async function crearCertificado(
  input: CrearCertificadoInput,
): Promise<CertificadoResponsePayload> {
  return apiRequest('/certificados', certificadoResponseSchema, {
    method: 'POST',
    body: input,
  })
}

/**
 * Solicita un certificado como apoderado o alumno (RF-ADM-012).
 */
export async function solicitarCertificado(
  input: SolicitarCertificadoInput,
): Promise<CertificadoResponsePayload> {
  return apiRequest('/api/v1/certificados/solicitar', certificadoResponseSchema, {
    method: 'POST',
    body: input,
  })
}

/**
 * Aprueba una solicitud, asigna número correlativo y genera el PDF
 * (RF-ADM-013).
 */
export async function aprobarCertificado(
  id: string,
  input: AprobarCertificadoInput = {},
): Promise<CertificadoResponsePayload> {
  return apiRequest(`/api/v1/certificados/${id}/aprobar`, certificadoResponseSchema, {
    method: 'PATCH',
    body: input,
  })
}

/**
 * Rechaza una solicitud de certificado con motivo obligatorio (RF-ADM-013).
 */
export async function rechazarCertificado(
  id: string,
  input: RechazarCertificadoInput,
): Promise<CertificadoResponsePayload> {
  return apiRequest(`/api/v1/certificados/${id}/rechazar`, certificadoResponseSchema, {
    method: 'PATCH',
    body: input,
  })
}

/**
 * Descarga el PDF de un certificado emitido (RF-ADM-013).
 *
 * Devuelve la ruta de descarga y el certificado asociado.
 */
export async function descargarCertificado(
  id: string,
): Promise<DescargaCertificadoPayload> {
  return apiRequest(`/api/v1/certificados/${id}/download`, descargaCertificadoSchema)
}

/**
 * Listado paginado de plantillas de certificado (RF-ADM-014).
 */
export async function listarPlantillas(
  params: ListarPlantillasParams = {},
): Promise<PaginatedPlantillasPayload> {
  const query = new URLSearchParams()
  if (params.page) query.set('page', String(params.page))
  if (params.pageSize) query.set('pageSize', String(params.pageSize))
  if (params.tipo) query.set('tipo', params.tipo)

  return apiRequest(
    `/api/v1/plantillas-certificados?${query.toString()}`,
    paginatedPlantillasSchema,
  )
}

/**
 * Crea una plantilla de certificado con contenido HTML y variables
 * `{{variable}}` (RF-ADM-014).
 */
export async function crearPlantilla(
  input: PlantillaCertificadoInput,
): Promise<PlantillaCertificadoResponsePayload> {
  return apiRequest('/api/v1/plantillas-certificados', plantillaCertificadoResponseSchema, {
    method: 'POST',
    body: input,
  })
}

/**
 * Actualiza parcialmente una plantilla; el backend incrementa la versión
 * cuando cambia el contenido (RF-ADM-014).
 */
export async function actualizarPlantilla(
  id: string,
  input: ActualizarPlantillaInput,
): Promise<PlantillaCertificadoResponsePayload> {
  return apiRequest(`/api/v1/plantillas-certificados/${id}`, plantillaCertificadoResponseSchema, {
    method: 'PATCH',
    body: input,
  })
}

/**
 * Elimina una plantilla de certificado (RF-ADM-014).
 */
export async function eliminarPlantilla(id: string): Promise<void> {
  await apiRequestSinContenido(`/api/v1/plantillas-certificados/${id}`, {
    method: 'DELETE',
  })
}
