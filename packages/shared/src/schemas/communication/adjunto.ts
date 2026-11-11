import { z } from 'zod'
import { uuidSchema } from '../base.js'

/** Subida de adjunto (entrada multipart se maneja en controller, esto es para validación de metadatos). */
export const adjuntoMetadatosSchema = z.object({
  nombreOriginal: z.string().min(1).max(255),
  tipoMime: z.string().min(1).max(100),
  tamanoBytes: z.number().int().positive(),
})

export type AdjuntoMetadatosInput = z.infer<typeof adjuntoMetadatosSchema>

/** Respuesta genérica de adjunto (tanto para anuncios como mensajes). */
export const adjuntoResponseSchema = z.object({
  id: uuidSchema,
  nombreOriginal: z.string(),
  url: z.string().url(),
  tipoMime: z.string(),
  tamanoBytes: z.number().int().nonnegative(),
  createdAt: z.string(),
})

export type AdjuntoResponsePayload = z.infer<typeof adjuntoResponseSchema>

/** Tipos MIME permitidos (configurable en core.config; aquí lista base). */
export const TIPOS_MIME_PERMITIDOS: Readonly<string[]> = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const

/** Tamaño máximo por defecto (10 MB), configurable en core.config. */
export const TAMANO_MAXIMO_BYTES = 10 * 1024 * 1024

/** Valida tipo MIME contra lista blanca. */
export function esTipoMimePermitido(mime: string): boolean {
  return TIPOS_MIME_PERMITIDOS.includes(mime)
}

/** Valida tamaño contra máximo configurado. */
export function esTamanoValido(bytes: number, maximo = TAMANO_MAXIMO_BYTES): boolean {
  return bytes > 0 && bytes <= maximo
}