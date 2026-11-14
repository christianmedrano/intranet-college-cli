import {
  mensajeResponseSchema,
  paginatedMensajesSchema,
  type CrearMensajeInput,
  type ListarMensajesQuery,
  type MensajeResponsePayload,
  type PaginatedMensajesPayload,
} from '@intranet/shared'
import { apiRequest, apiRequestSinContenido } from '../../../shared/api/client'

// Re-export types for consumers
export type { MensajeResponsePayload, PaginatedMensajesPayload }

/**
 * Lista mensajes de un hilo de sección con paginación (RF-COM-005).
 */
export async function listarMensajes(
  seccionId: string,
  query: Partial<ListarMensajesQuery> = {},
): Promise<PaginatedMensajesPayload> {
  const params = new URLSearchParams()
  params.set('seccionId', seccionId)
  if (query.page) params.set('page', String(query.page))
  if (query.pageSize) params.set('pageSize', String(query.pageSize))

  return apiRequest(`/api/v1/secciones/${seccionId}/mensajes?${params.toString()}`, paginatedMensajesSchema)
}

/**
 * Envía un mensaje al hilo de una sección (RF-COM-004).
 *
 * Requiere permiso `communication.mensajeria.gestionar`.
 * El backend valida que el usuario sea tutor de la sección o apoderado con alumno matriculado.
 */
export async function enviarMensaje(
  seccionId: string,
  input: CrearMensajeInput,
): Promise<MensajeResponsePayload> {
  return apiRequest(`/api/v1/secciones/${seccionId}/mensajes`, mensajeResponseSchema, {
    method: 'POST',
    body: input,
  })
}

/**
 * Elimina (borrado lógico) un mensaje (RF-COM-005).
 *
 * Requiere permiso `communication.mensajeria.supervisar` (Director/SuperAdmin).
 */
export async function eliminarMensaje(id: string): Promise<void> {
  await apiRequestSinContenido(`/mensajes/${id}`, { method: 'DELETE' })
}

/**
 * Sube un adjunto a un mensaje (RF-COM-006).
 */
export async function subirAdjuntoMensaje(
  mensajeId: string,
  archivo: File,
): Promise<{ id: string; url: string; nombreOriginal: string }> {
  const formData = new FormData()
  formData.append('archivo', archivo)

  const respuesta = await fetch(`/api/v1/mensajes/${mensajeId}/adjuntos`, {
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
 * Elimina un adjunto de un mensaje (RF-COM-006).
 */
export async function eliminarAdjuntoMensaje(adjuntoId: string): Promise<void> {
  await apiRequestSinContenido(`/api/v1/mensajes/adjuntos/${adjuntoId}`, { method: 'DELETE' })
}