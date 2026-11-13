import {
  anuncioResponseSchema,
  paginatedAnunciosSchema,
  type CrearAnuncioInput,
  type ActualizarAnuncioInput,
  type ListarAnunciosQuery,
  type AnuncioResponsePayload,
  type PaginatedAnunciosPayload,
} from '@intranet/shared'
import { apiRequest, apiRequestSinContenido } from '../../../shared/api/client'

// Re-export types for consumers
export type { AnuncioResponsePayload, PaginatedAnunciosPayload }

/**
 * Lista anuncios con filtros y paginación (RF-COM-003).
 *
 * Los filtros se aplican según el rol del usuario autenticado.
 * El backend segmenta automáticamente según el vínculo del usuario.
 */
export async function listarAnuncios(
  query: Partial<ListarAnunciosQuery> = {},
): Promise<PaginatedAnunciosPayload> {
  const params = new URLSearchParams()

  if (query.page) params.set('page', String(query.page))
  if (query.pageSize) params.set('pageSize', String(query.pageSize))
  if (query.tipo) params.set('tipo', query.tipo)
  if (query.estado) params.set('estado', query.estado)
  if (query.nivelId) params.set('nivelId', query.nivelId)
  if (query.gradoId) params.set('gradoId', query.gradoId)
  if (query.seccionId) params.set('seccionId', query.seccionId)
  if (query.rol) params.set('rol', query.rol)
  if (query.desde) params.set('desde', query.desde)
  if (query.hasta) params.set('hasta', query.hasta)

  return apiRequest(`/anuncios?${params.toString()}`, paginatedAnunciosSchema)
}

/**
 * Obtiene un anuncio por ID (RF-COM-003).
 */
export async function obtenerAnuncio(id: string): Promise<AnuncioResponsePayload> {
  return apiRequest(`/anuncios/${id}`, anuncioResponseSchema)
}

/**
 * Crea un anuncio institucional o de sección (RF-COM-001, RF-COM-002).
 *
 * Requiere permiso `communication.anuncios.gestionar`.
 * El backend valida que el usuario sea Director o docente tutor (para SECCION).
 */
export async function crearAnuncio(
  input: CrearAnuncioInput,
): Promise<AnuncioResponsePayload> {
  return apiRequest('/anuncios', anuncioResponseSchema, {
    method: 'POST',
    body: input,
  })
}

/**
 * Actualiza un anuncio (RF-COM-001, RF-COM-002).
 *
 * Solo el autor o un Director pueden actualizar.
 * Requiere permiso `communication.anuncios.gestionar`.
 */
export async function actualizarAnuncio(
  id: string,
  input: ActualizarAnuncioInput,
): Promise<AnuncioResponsePayload> {
  return apiRequest(`/anuncios/${id}`, anuncioResponseSchema, {
    method: 'PATCH',
    body: input,
  })
}

/**
 * Archiva (borrado lógico) un anuncio (RF-COM-001).
 *
 * Requiere permiso `communication.anuncios.gestionar`.
 * Solo el autor o un Director pueden archivar.
 */
export async function eliminarAnuncio(id: string): Promise<void> {
  await apiRequestSinContenido(`/anuncios/${id}`, { method: 'DELETE' })
}

/**
 * Sube un adjunto a un anuncio (RF-COM-006).
 */
export async function subirAdjuntoAnuncio(
  anuncioId: string,
  archivo: File,
): Promise<{ id: string; url: string; nombreOriginal: string }> {
  const formData = new FormData()
  formData.append('archivo', archivo)

  const respuesta = await fetch(`/api/v1/anuncios/${anuncioId}/adjuntos`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  })

  if (!respuesta.ok) {
    const error = await respuesta.json().catch(() => ({}))
    throw new Error(error.error?.message ?? 'Error al subir adjunto')
  }

  return respuesta.json()
}

/**
 * Elimina un adjunto de un anuncio (RF-COM-006).
 */
export async function eliminarAdjuntoAnuncio(adjuntoId: string): Promise<void> {
  await apiRequestSinContenido(`/anuncios/adjuntos/${adjuntoId}`, { method: 'DELETE' })
}

/**
 * Obtiene opciones de catálogo para el formulario de anuncio.
 */
export interface CatalogoOpcion {
  id: string
  nombre: string
}

export async function listarNivelesCatalogo(): Promise<{ id: string; nombre: string }[]> {
  const respuesta = await fetch('/api/v1/niveles?pageSize=100', {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })
  if (!respuesta.ok) throw new Error('No se pudieron cargar los niveles')
  const data = await respuesta.json()
  return data.data.map((n: { id: string; nombre: string }) => ({ id: n.id, nombre: n.nombre }))
}

export async function listarGradosCatalogo(): Promise<{ id: string; nombre: string; nivelId: string }[]> {
  const respuesta = await fetch('/api/v1/grados?pageSize=100', {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })
  if (!respuesta.ok) throw new Error('No se pudieron cargar los grados')
  const data = await respuesta.json()
  return data.data.map((g: { id: string; nombre: string; nivelId: string }) => ({
    id: g.id,
    nombre: g.nombre,
    nivelId: g.nivelId,
  }))
}

export async function listarSeccionesCatalogo(): Promise<{ id: string; nombre: string; gradoId: string }[]> {
  const respuesta = await fetch('/api/v1/secciones?pageSize=100', {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })
  if (!respuesta.ok) throw new Error('No se pudieron cargar las secciones')
  const data = await respuesta.json()
  return data.data.map((s: { id: string; nombre: string; gradoId: string }) => ({
    id: s.id,
    nombre: s.nombre,
    gradoId: s.gradoId,
  }))
}