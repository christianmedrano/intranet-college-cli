import { z } from 'zod'
import { valorLiteralSchema } from '../../domain/academic.js'
import { paginationSchema, uuidSchema } from '../base.js'
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
