import { z } from 'zod'
import { valorLiteralSchema } from '../../domain/academic.js'
import { paginationSchema, uuidSchema } from '../base.js'
import { observacionSchema } from './base.js'

/**
 * Registro de una calificación literal (RF-ACAD-001).
 *
 * No existe campo numérico ni fórmula: el valor es `AD`, `A`, `B` o `C`
 * (RN-ACAD-001). El servicio valida matrícula, asignación y período.
 */
export const crearCalificacionSchema = z.object({
  alumnoId: uuidSchema,
  cursoId: uuidSchema,
  periodoId: uuidSchema,
  valor: valorLiteralSchema,
  observacion: observacionSchema.optional(),
})

export type CrearCalificacionInput = z.infer<typeof crearCalificacionSchema>

/**
 * Actualización de una calificación (RF-ACAD-001, RF-ACAD-005).
 *
 * `motivo` es obligatorio solo cuando corrige el Director tras el cierre del
 * período; esa regla se valida en el servicio, que conoce el rol y el estado.
 */
export const actualizarCalificacionSchema = z
  .object({
    valor: valorLiteralSchema.optional(),
    observacion: observacionSchema.optional(),
    motivo: z.string().trim().max(500, 'El motivo es demasiado largo').optional(),
  })
  .refine(
    (datos) => datos.valor !== undefined || datos.observacion !== undefined,
    { message: 'Debe enviar el valor, la observación o ambos' },
  )

export type ActualizarCalificacionInput = z.infer<
  typeof actualizarCalificacionSchema
>

/** Filtros del listado de calificaciones de un período. */
export const listarCalificacionesQuerySchema = paginationSchema.extend({
  cursoId: uuidSchema.optional(),
  seccionId: uuidSchema.optional(),
})

export type ListarCalificacionesQuery = z.infer<
  typeof listarCalificacionesQuerySchema
>
