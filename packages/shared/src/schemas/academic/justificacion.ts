import { z } from 'zod'
import { estadoJustificacionSchema } from '../../domain/academic.js'
import { paginationSchema, uuidSchema } from '../base.js'
import { motivoObligatorioSchema } from './base.js'

/**
 * Solicitud de justificación de una falta (RF-ACAD-006).
 *
 * La crea el apoderado vinculado; el servicio comprueba que la asistencia esté
 * en `FALTA_INJUSTIFICADA` y que no exista otra solicitud abierta.
 */
export const crearJustificacionSchema = z.object({
  motivo: motivoObligatorioSchema,
})

export type CrearJustificacionInput = z.infer<typeof crearJustificacionSchema>

/** Aprobación de una justificación, con comentario opcional. */
export const resolverJustificacionSchema = z.object({
  comentario: z
    .string()
    .trim()
    .max(500, 'El comentario es demasiado largo')
    .optional(),
})

export type ResolverJustificacionInput = z.infer<
  typeof resolverJustificacionSchema
>

/** Rechazo de una justificación: el motivo es obligatorio (RN-ACAD-012). */
export const rechazarJustificacionSchema = z.object({
  motivo: motivoObligatorioSchema,
})

export type RechazarJustificacionInput = z.infer<
  typeof rechazarJustificacionSchema
>

/** Filtros del listado de justificaciones. */
export const listarJustificacionesQuerySchema = paginationSchema.extend({
  estado: estadoJustificacionSchema.optional(),
  alumnoId: uuidSchema.optional(),
  seccionId: uuidSchema.optional(),
})

export type ListarJustificacionesQuery = z.infer<
  typeof listarJustificacionesQuerySchema
>
