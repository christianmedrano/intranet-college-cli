import {
  materialResponseSchema,
  paginatedMaterialesSchema,
  materialDescargaSchema,
  adjuntoDescargaSchema,
  adjuntoVirtualResponseSchema,
  type CrearMaterialInput,
  type ActualizarMaterialInput,
  type MaterialResponsePayload,
  type PaginatedMaterialesPayload,
  type MaterialDescargaPayload,
  type AdjuntoDescargaPayload,
  type AdjuntoVirtualResponsePayload,
} from '@intranet/shared'

// Re-export types for consumers
export type {
  MaterialResponsePayload,
  PaginatedMaterialesPayload,
  MaterialDescargaPayload,
  AdjuntoDescargaPayload,
  AdjuntoVirtualResponsePayload,
}
import { apiRequest, apiRequestSinContenido } from '../../../shared/api/client'

/** Parámetros para listado de materiales. */
export interface ListarMaterialesParams {
  /** ID del año académico (requerido para el scope). */
  anioId: string
  /** Página (1-indexed) */
  page?: number
  /** Tamaño de página */
  pageSize?: number
  /** Filtrar por curso */
  cursoId?: string
  /** Filtrar por sección */
  seccionId?: string
  /** Filtrar por período */
  periodoId?: string
  /** Filtrar por docente */
  docenteId?: string
}

/**
 * Listado paginado de materiales con alcance por vínculo (RF-VIR-004).
 *
 * El backend filtra según el rol:
 * - Director/SuperAdmin: todos
 * - Docente: solo sus asignaciones
 * - Apoderado: materiales de secciones de sus alumnos
 * - Alumno: solo su sección
 */
export async function listarMateriales(
  anioId: string,
  query: Omit<ListarMaterialesParams, 'anioId'> = {},
): Promise<PaginatedMaterialesPayload> {
  const params = new URLSearchParams()
  if (query.page) params.set('page', String(query.page))
  if (query.pageSize) params.set('pageSize', String(query.pageSize))
  if (query.cursoId) params.set('cursoId', query.cursoId)
  if (query.seccionId) params.set('seccionId', query.seccionId)
  if (query.periodoId) params.set('periodoId', query.periodoId)
  if (query.docenteId) params.set('docenteId', query.docenteId)

  // El anioId se envía por header (x-anio-academico) según la implementación actual
  return apiRequest(
    `/virtual/materiales?${params.toString()}`,
    paginatedMaterialesSchema,
    {
      headers: { 'x-anio-academico': anioId },
    },
  )
}

/**
 * Obtiene el detalle de un material con sus adjuntos (RF-VIR-003).
 */
export async function obtenerMaterial(
  id: string,
  anioId: string,
): Promise<MaterialResponsePayload> {
  return apiRequest(`/virtual/materiales/${id}`, materialResponseSchema, {
    headers: { 'x-anio-academico': anioId },
  })
}

/**
 * Crea un material virtual (RF-VIR-001).
 *
 * Requiere: cursoId, seccionId, periodoId, titulo, archivoNombre, archivoMime, tamanoBytes
 * Opcional: docenteId (si no se envía y el actor es DOCENTE, se usa su ID), descripcion
 */
export async function crearMaterial(input: CrearMaterialInput): Promise<MaterialResponsePayload> {
  return apiRequest('/virtual/materiales', materialResponseSchema, {
    method: 'POST',
    body: input,
  })
}

/**
 * Actualiza un material virtual (RF-VIR-002).
 *
 * Al menos un campo es obligatorio. Si se cambia archivoNombre, se regenera la ruta.
 */
export async function actualizarMaterial(
  id: string,
  input: ActualizarMaterialInput,
): Promise<MaterialResponsePayload> {
  return apiRequest(`/virtual/materiales/${id}`, materialResponseSchema, {
    method: 'PATCH',
    body: input,
  })
}

/**
 * Elimina lógicamente un material (RF-VIR-003).
 *
 * Solo dueño o Director/SuperAdmin.
 */
export async function eliminarMaterial(id: string): Promise<void> {
  return apiRequestSinContenido(`/virtual/materiales/${id}`, {
    method: 'DELETE',
  })
}

/**
 * Prepara la descarga de un material (RF-VIR-005).
 *
 * Devuelve URL de descarga y metadatos.
 */
export async function prepararDescargaMaterial(
  id: string,
  anioId: string,
): Promise<MaterialDescargaPayload> {
  return apiRequest(
    `/virtual/materiales/${id}/download`,
    materialDescargaSchema,
    {
      headers: { 'x-anio-academico': anioId },
    },
  )
}

/**
 * Sube un adjunto a un material (RF-VIR-005).
 *
 * Usa multipart/form-data a través del cliente compartido.
 */
export async function subirAdjunto(
  materialId: string,
  archivo: File,
): Promise<AdjuntoVirtualResponsePayload> {
  const formData = new FormData()
  formData.append('archivo', archivo)

  // Usamos fetch directamente porque el cliente compartido no soporta multipart aún
  // El token se maneja automáticamente por credentials: 'include'
  const respuesta = await fetch(`/api/v1/virtual/materiales/${materialId}/adjuntos`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  })

  if (!respuesta.ok) {
    const error = await respuesta.json().catch(() => ({ message: 'Error subiendo adjunto' }))
    throw new Error(error.message ?? 'Error subiendo adjunto')
  }

  const datos = await respuesta.json()
  return adjuntoVirtualResponseSchema.parse(datos)
}

/**
 * Elimina un adjunto (RF-VIR-005).
 */
export async function eliminarAdjunto(materialId: string, adjuntoId: string): Promise<void> {
  return apiRequestSinContenido(`/virtual/adjuntos/${adjuntoId}?materialId=${materialId}`, {
    method: 'DELETE',
  })
}

/**
 * Lista adjuntos de un material (RF-VIR-005).
 */
export async function listarAdjuntos(
  materialId: string,
  anioId: string,
  pagina: number = 1,
  pageSize: number = 20,
): Promise<AdjuntoVirtualResponsePayload[]> {
  const params = new URLSearchParams()
  params.set('page', String(pagina))
  params.set('pageSize', String(pageSize))

  const { z } = await import('zod')
  const arraySchema = z.array(adjuntoVirtualResponseSchema)

  return apiRequest(
    `/virtual/materiales/${materialId}/adjuntos?${params.toString()}`,
    arraySchema,
    {
      headers: { 'x-anio-academico': anioId },
    },
  )
}

/**
 * Prepara la descarga de un adjunto (RF-VIR-005).
 */
export async function prepararDescargaAdjunto(
  materialId: string,
  adjuntoId: string,
): Promise<AdjuntoDescargaPayload> {
  return apiRequest(
    `/virtual/adjuntos/${adjuntoId}/download?materialId=${materialId}`,
    adjuntoDescargaSchema,
  )
}