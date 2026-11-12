import { z } from 'zod'
import {
  paginationMetaSchema,
  paginationSchema,
  uuidSchema,
} from '../base.js'

/** Tipos MIME permitidos para materiales virtuales (RF-VIR-005). */
export const tipoMimeVirtualSchema = z.enum([
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
])

export type TipoMimeVirtual = z.infer<typeof tipoMimeVirtualSchema>

/** Tamaño máximo por defecto para material virtual (10 MB), configurable en core.config. */
export const TAMANO_MAXIMO_BYTES_VIR = 10 * 1024 * 1024

/** Valida tipo MIME contra lista blanca de virtual-classroom. */
export function esTipoMimePermitidoVir(mime: string): boolean {
  return [
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
  ].includes(mime)
}

/**
 * Creación de material (RF-VIR-001).
 *
 * Requiere curso, sección, período y archivo válido.
 * `docenteId` es opcional: si no se envía y el actor es DOCENTE, se usa su ID.
 * Validaciones: MIME en lista blanca, tamaño ≤ 10 MB.
 */
export const crearMaterialSchema = z
  .object({
    cursoId: uuidSchema,
    seccionId: uuidSchema,
    periodoId: uuidSchema,
    docenteId: uuidSchema.optional(),
    titulo: z
      .string()
      .trim()
      .min(1, 'El título es obligatorio')
      .max(200, 'El título es demasiado largo'),
    descripcion: z
      .string()
      .trim()
      .max(5000, 'La descripción es demasiado larga')
      .optional(),
    archivoNombre: z.string().min(1, 'El nombre del archivo es obligatorio'),
    archivoMime: tipoMimeVirtualSchema,
    tamanoBytes: z
      .number()
      .int()
      .positive('El tamaño debe ser positivo'),
  })
  .refine(
    (data) => data.tamanoBytes <= 10 * 1024 * 1024,
    {
      message: 'El archivo supera el tamaño máximo permitido (10 MB)',
      path: ['tamanoBytes'],
    },
  )

export type CrearMaterialInput = z.infer<typeof crearMaterialSchema>

/**
 * Actualización parcial de material.
 *
 * Al menos un campo es obligatorio.
 */
export const actualizarMaterialSchema = z
  .object({
    cursoId: uuidSchema.optional(),
    seccionId: uuidSchema.optional(),
    periodoId: uuidSchema.optional(),
    docenteId: uuidSchema.optional(),
    titulo: z
      .string()
      .trim()
      .min(1, 'El título es obligatorio')
      .max(200, 'El título es demasiado largo')
      .optional(),
    descripcion: z
      .string()
      .trim()
      .max(5000, 'La descripción es demasiado larga')
      .optional(),
    archivoNombre: z.string().min(1, 'El nombre del archivo es obligatorio').optional(),
    archivoMime: tipoMimeVirtualSchema.optional(),
    tamanoBytes: z
      .number()
      .int()
      .positive('El tamaño debe ser positivo')
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar',
  })

export type ActualizarMaterialInput = z.infer<typeof actualizarMaterialSchema>

/**
 * Filtros de listado de materiales (RF-VIR-004).
 *
 * Permite filtrar por curso, sección, período y docente.
 * La paginación es estándar (page/pageSize).
 */
export const listarMaterialesQuerySchema = paginationSchema.extend({
  cursoId: uuidSchema.optional(),
  seccionId: uuidSchema.optional(),
  periodoId: uuidSchema.optional(),
  docenteId: uuidSchema.optional(),
})

export type ListarMaterialesQuery = z.infer<typeof listarMaterialesQuerySchema>

/**
 * Respuesta de adjunto de material virtual.
 *
 * La URL es una ruta relativa al origen de la API (`/api/v1/virtual/...`); el
 * cliente la resuelve contra su propio origen.
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

/**
 * Material devuelto por la API (RF-VIR-001 a RF-VIR-005).
 *
 * Los adjuntos se incluyen cuando existen.
 */
export const materialResponseSchema = z.object({
  id: uuidSchema,
  cursoId: uuidSchema,
  seccionId: uuidSchema,
  periodoId: uuidSchema,
  docenteId: uuidSchema,
  titulo: z.string(),
  descripcion: z.string().nullable(),
  archivoNombre: z.string(),
  archivoMime: z.string(),
  tamanoBytes: z.number().int().nonnegative(),
  createdAt: z.string(),
  updatedAt: z.string(),
  adjuntos: z.array(adjuntoVirtualResponseSchema),
})

export type MaterialResponsePayload = z.infer<typeof materialResponseSchema>

/**
 * Listado paginado de materiales.
 */
export const paginatedMaterialesSchema = z.object({
  data: z.array(materialResponseSchema),
  meta: paginationMetaSchema,
})

export type PaginatedMaterialesPayload = z.infer<
  typeof paginatedMaterialesSchema
>

/**
 * Respuesta de preparación de descarga de material.
 *
 * `url` es relativa al origen de la API.
 */
export const materialDescargaSchema = z.object({
  url: z.string().min(1),
  archivoNombre: z.string(),
  archivoMime: z.string(),
  tamanoBytes: z.number().int().nonnegative(),
})

export type MaterialDescargaPayload = z.infer<typeof materialDescargaSchema>

/**
 * Respuesta de preparación de descarga de adjunto.
 *
 * `url` es relativa al origen de la API.
 */
export const adjuntoDescargaSchema = z.object({
  url: z.string().min(1),
  nombreOriginal: z.string(),
  archivoMime: z.string(),
  tamanoBytes: z.number().int().nonnegative(),
})

export type AdjuntoDescargaPayload = z.infer<typeof adjuntoDescargaSchema>