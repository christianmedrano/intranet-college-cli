import { z } from 'zod'
import { valorLiteralSchema } from '../../domain/academic.js'
import { paginationMetaSchema, paginationSchema, uuidSchema } from '../base.js'
import { observacionSchema } from './base.js'

/**
 * Registro manual de la nota final de un período (RF-ACAD-002).
 *
 * No se calcula ni se deriva de las calificaciones parciales: se guarda tal
 * como la registra el docente (RN-ACAD-004).
 */
export const crearNotaFinalSchema = z.object({
  alumnoId: uuidSchema,
  cursoId: uuidSchema,
  periodoId: uuidSchema,
  valor: valorLiteralSchema,
  observacion: observacionSchema.optional(),
})

export type CrearNotaFinalInput = z.infer<typeof crearNotaFinalSchema>

/** Actualización de la nota final, con el mismo contrato que la calificación. */
export const actualizarNotaFinalSchema = z
  .object({
    valor: valorLiteralSchema.optional(),
    observacion: observacionSchema.optional(),
    motivo: z.string().trim().max(500, 'El motivo es demasiado largo').optional(),
  })
  .refine(
    (datos) => datos.valor !== undefined || datos.observacion !== undefined,
    { message: 'Debe enviar el valor, la observación o ambos' },
  )

export type ActualizarNotaFinalInput = z.infer<
  typeof actualizarNotaFinalSchema
>

/** Filtros del listado de notas finales de un período. */
export const listarNotasFinalesQuerySchema = paginationSchema.extend({
  cursoId: uuidSchema.optional(),
  seccionId: uuidSchema.optional(),
})

export type ListarNotasFinalesQuery = z.infer<
  typeof listarNotasFinalesQuerySchema
>

/**
 * Nota final devuelta por la API (RF-ACAD-002).
 *
 * Se registra manualmente y nunca se calcula a partir de las calificaciones
 * parciales (RN-ACAD-004).
 */
export const notaFinalResponseSchema = z.object({
  id: uuidSchema,
  alumnoId: uuidSchema,
  cursoId: uuidSchema,
  periodoId: uuidSchema,
  valor: valorLiteralSchema,
  observacion: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

/** Listado paginado de notas finales de un período. */
export const paginatedNotasFinalesSchema = z.object({
  data: z.array(notaFinalResponseSchema),
  meta: paginationMetaSchema,
})

export type NotaFinalResponsePayload = z.infer<typeof notaFinalResponseSchema>
export type PaginatedNotasFinalesPayload = z.infer<
  typeof paginatedNotasFinalesSchema
>
