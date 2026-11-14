import { z } from 'zod'
import { uuidSchema } from '../base.js'
import { paginationSchema, paginationMetaSchema } from '../base.js'
import { roleCodeSchema } from '../../domain/permissions.js'

/** Tipos de anuncio. */
export const anuncioTipoSchema = z.enum(['INSTITUCIONAL', 'SECCION'])
export type AnuncioTipo = z.infer<typeof anuncioTipoSchema>

/** Estados de anuncio. */
export const anuncioEstadoSchema = z.enum(['BORRADOR', 'PUBLICADO', 'EXPIRADO', 'ARCHIVADO'])
export type AnuncioEstado = z.infer<typeof anuncioEstadoSchema>

/** Crear anuncio (RF-COM-001, RF-COM-002). */
export const crearAnuncioSchema = z
  .object({
    titulo: z.string().trim().min(1, 'El título es obligatorio').max(200, 'El título es demasiado largo'),
    cuerpo: z.string().trim().min(1, 'El cuerpo es obligatorio').max(10000, 'El cuerpo es demasiado largo'),
    tipo: anuncioTipoSchema,
    estado: z.enum(['BORRADOR', 'PUBLICADO']).default('BORRADOR'),
    anioId: uuidSchema,
    audienciaNiveles: z.array(uuidSchema).optional(),
    audienciaGrados: z.array(uuidSchema).optional(),
    audienciaSecciones: z.array(uuidSchema).optional(),
    audienciaRoles: z.array(roleCodeSchema).optional(),
    expiraEn: z
    .union([
      z.iso.datetime({ offset: true }),
      z.iso.date(),
      z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
    ])
    .optional()
    .transform((val) => {
      if (!val) return undefined
      if (typeof val === 'string') {
        if (val.length === 10) {
          // It's a date string (YYYY-MM-DD), convert to end of day ISO datetime
          return `${val}T23:59:59.999Z`
        }
        if (val.length === 16) {
          // It's a datetime-local string (YYYY-MM-DDTHH:MM), convert to ISO datetime with Z offset
          return `${val}:00.000Z`
        }
      }
      return val
    }),
  })
  .refine(
    (d) =>
      d.tipo === 'SECCION' ||
      (d.audienciaNiveles?.length ?? 0) +
        (d.audienciaGrados?.length ?? 0) +
        (d.audienciaSecciones?.length ?? 0) +
        (d.audienciaRoles?.length ?? 0) >
        0,
    {
      message: 'Anuncio institucional requiere al menos una audiencia',
      path: ['audienciaNiveles'],
    },
  )

export type CrearAnuncioInput = z.infer<typeof crearAnuncioSchema>

/** Actualizar anuncio (parcial) — recreado sin .partial() sobre schema con refine. */
export const actualizarAnuncioSchema = z
  .object({
    titulo: z.string().trim().min(1, 'El título es obligatorio').max(200, 'El título es demasiado largo').optional(),
    cuerpo: z.string().trim().min(1, 'El cuerpo es obligatorio').max(10000, 'El cuerpo es demasiado largo').optional(),
    tipo: anuncioTipoSchema.optional(),
    estado: anuncioEstadoSchema.optional(),
    anioId: uuidSchema.optional(),
    audienciaNiveles: z.array(uuidSchema).optional(),
    audienciaGrados: z.array(uuidSchema).optional(),
    audienciaSecciones: z.array(uuidSchema).optional(),
    audienciaRoles: z.array(roleCodeSchema).optional(),
    expiraEn: z
    .union([
      z.iso.datetime({ offset: true }),
      z.iso.date(),
      z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
    ])
    .optional()
    .transform((val) => {
      if (!val) return undefined
      if (typeof val === 'string') {
        if (val.length === 10) {
          // It's a date string (YYYY-MM-DD), convert to end of day ISO datetime
          return `${val}T23:59:59.999Z`
        }
        if (val.length === 16) {
          // It's a datetime-local string (YYYY-MM-DDTHH:MM), convert to ISO datetime with Z offset
          return `${val}:00.000Z`
        }
      }
      return val
    }),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar',
  })
  .refine(
    (d) =>
      d.tipo === 'SECCION' ||
      !d.tipo || // si no se envía tipo, no validamos audiencia (actualización parcial)
      (d.audienciaNiveles?.length ?? 0) +
        (d.audienciaGrados?.length ?? 0) +
        (d.audienciaSecciones?.length ?? 0) +
        (d.audienciaRoles?.length ?? 0) >
        0,
    {
      message: 'Anuncio institucional requiere al menos una audiencia',
      path: ['audienciaNiveles'],
    },
  )

export type ActualizarAnuncioInput = z.infer<typeof actualizarAnuncioSchema>

/** Filtros de listado de anuncios. */
export const listarAnunciosQuerySchema = paginationSchema.extend({
  tipo: anuncioTipoSchema.optional(),
  estado: anuncioEstadoSchema.optional(),
  nivelId: uuidSchema.optional(),
  gradoId: uuidSchema.optional(),
  seccionId: uuidSchema.optional(),
  rol: roleCodeSchema.optional(),
  desde: z.iso.datetime({ offset: true }).optional(),
  hasta: z.iso.datetime({ offset: true }).optional(),
})

export type ListarAnunciosQuery = z.infer<typeof listarAnunciosQuerySchema>

/** Adjunto de anuncio. */
export const adjuntoAnuncioSchema = z.object({
  id: uuidSchema,
  nombreOriginal: z.string(),
  url: z.string().url(),
  tipoMime: z.string(),
  tamanoBytes: z.number().int().nonnegative(),
  createdAt: z.string(),
})

export type AdjuntoAnuncioResponse = z.infer<typeof adjuntoAnuncioSchema>

/** Anuncio devuelto por la API. */
export const anuncioResponseSchema = z.object({
  id: uuidSchema,
  institucionId: uuidSchema,
  autorId: uuidSchema,
  titulo: z.string(),
  cuerpo: z.string(),
  tipo: anuncioTipoSchema,
  estado: anuncioEstadoSchema,
  anioId: z.string().nullable(),
  audienciaNiveles: z.array(uuidSchema),
  audienciaGrados: z.array(uuidSchema),
  audienciaSecciones: z.array(uuidSchema),
  audienciaRoles: z.array(roleCodeSchema),
  publicadoEn: z.string().nullable(),
  expiraEn: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  adjuntos: z.array(adjuntoAnuncioSchema),
})

export type AnuncioResponsePayload = z.infer<typeof anuncioResponseSchema>

/** Listado paginado de anuncios. */
export const paginatedAnunciosSchema = z.object({
  data: z.array(anuncioResponseSchema),
  meta: paginationMetaSchema,
})

export type PaginatedAnunciosPayload = z.infer<typeof paginatedAnunciosSchema>