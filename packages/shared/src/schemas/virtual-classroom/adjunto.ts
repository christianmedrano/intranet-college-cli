import { z } from 'zod'
import { uuidSchema } from '../base.js'

/**
 * Metadatos para subida de adjunto (entrada multipart se maneja en controller).
 *
 * Solo valida metadatos; el archivo real se recibe via multipart.
 */
export const adjuntoVirtualMetadatosSchema = z.object({
  nombreOriginal: z.string().min(1).max(255),
  tipoMime: z.string().min(1).max(100),
  tamanoBytes: z.number().int().positive(),
})

export type AdjuntoVirtualMetadatosInput = z.infer<
  typeof adjuntoVirtualMetadatosSchema
>

/**
 * Respuesta genérica de adjunto para material virtual.
 *
 * `url` es una ruta relativa al origen de la API (`/api/v1/virtual/...`).
 */
export const adjuntoVirtualResponseSchema = z.object({
  id: uuidSchema,
  materialId: uuidSchema,
  nombreOriginal: z.string(),
  url: z.string().min(1),
  tipoMime: z.string(),
  tamanoBytes: z.number().int().nonnegative(),
  createdAt: z.string(),
})

export type AdjuntoVirtualResponsePayload = z.infer<
  typeof adjuntoVirtualResponseSchema
>

/** Tipo conveniente para uso en contratos. */
export type AdjuntoVirtualResponse = AdjuntoVirtualResponsePayload