import { z } from 'zod'
import { paginationSchema, paginationMetaSchema, uuidSchema } from '../base.js'

/** Crear mensaje en hilo de sección (RF-COM-004). */
export const crearMensajeSchema = z.object({
  cuerpo: z.string().trim().min(1, 'El mensaje no puede estar vacío').max(5000, 'El mensaje es demasiado largo'),
})

export type CrearMensajeInput = z.infer<typeof crearMensajeSchema>

/** Filtros de listado de mensajes. */
export const listarMensajesQuerySchema = paginationSchema.extend({
  seccionId: uuidSchema,
})

export type ListarMensajesQuery = z.infer<typeof listarMensajesQuerySchema>

/** Adjunto de mensaje. */
export const adjuntoMensajeSchema = z.object({
  id: uuidSchema,
  nombreOriginal: z.string(),
  url: z.string().url(),
  tipoMime: z.string(),
  tamanoBytes: z.number().int().nonnegative(),
  createdAt: z.string(),
})

export type AdjuntoMensajeResponse = z.infer<typeof adjuntoMensajeSchema>

/** Mensaje devuelto por la API. */
export const mensajeResponseSchema = z.object({
  id: uuidSchema,
  hiloId: uuidSchema,
  autorId: uuidSchema,
  autorNombre: z.string(),
  autorRol: z.string(),
  cuerpo: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  adjuntos: z.array(adjuntoMensajeSchema),
})

export type MensajeResponsePayload = z.infer<typeof mensajeResponseSchema>

/** Listado paginado de mensajes. */
export const paginatedMensajesSchema = z.object({
  data: z.array(mensajeResponseSchema),
  meta: paginationMetaSchema,
})

export type PaginatedMensajesPayload = z.infer<typeof paginatedMensajesSchema>