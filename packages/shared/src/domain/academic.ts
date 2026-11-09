import { z } from 'zod'

/**
 * Escala literal oficial del sistema (RN-ACAD-001).
 *
 * Es la única escala válida en Inicial, Primaria y Secundaria. Prohibido
 * almacenar o derivar valores numéricos.
 */
export const valorLiteralSchema = z.enum(['AD', 'A', 'B', 'C'])

export type ValorLiteral = z.infer<typeof valorLiteralSchema>

/** Estados posibles de una asistencia diaria (RN-ACAD-009). */
export const estadoAsistenciaSchema = z.enum([
  'PRESENTE',
  'TARDE',
  'FALTA_JUSTIFICADA',
  'FALTA_INJUSTIFICADA',
])

export type EstadoAsistencia = z.infer<typeof estadoAsistenciaSchema>

/** Estados posibles de una solicitud de justificación (RF-ACAD-006). */
export const estadoJustificacionSchema = z.enum([
  'SOLICITADA',
  'APROBADA',
  'RECHAZADA',
])

export type EstadoJustificacion = z.infer<typeof estadoJustificacionSchema>

/**
 * Día de la semana: `1` lunes a `7` domingo (RN-ACAD-019).
 *
 * Se modela como entero y no como texto para que el orden sea estable.
 */
export const diaSemanaSchema = z
  .number()
  .int('El día de la semana debe ser un entero')
  .min(1, 'El día de la semana debe estar entre 1 y 7')
  .max(7, 'El día de la semana debe estar entre 1 y 7')

export type DiaSemana = z.infer<typeof diaSemanaSchema>
