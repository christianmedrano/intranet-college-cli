import { z } from 'zod'
import { estadoAsistenciaSchema } from '../../domain/academic.js'
import { paginationSchema, uuidSchema } from '../base.js'
import { fechaEscolarSchema, observacionSchema } from './base.js'

/** Registro individual de asistencia diaria (RF-ACAD-004). */
const registroAsistenciaSchema = z.object({
  alumnoId: uuidSchema,
  estado: estadoAsistenciaSchema,
  observacion: observacionSchema.optional(),
})

/**
 * Registro de la asistencia de una sección en una fecha (RF-ACAD-004).
 *
 * Es atómico y se limita a 200 registros por petición. Se rechaza un alumno
 * repetido para no depender del orden en que la base detecte el duplicado.
 */
export const registrarAsistenciaLoteSchema = z
  .object({
    seccionId: uuidSchema,
    fecha: fechaEscolarSchema,
    registros: z
      .array(registroAsistenciaSchema)
      .min(1, 'Debe enviar al menos un registro')
      .max(200, 'No se pueden enviar más de 200 registros por petición'),
  })
  .refine(
    (datos) =>
      new Set(datos.registros.map((registro) => registro.alumnoId)).size ===
      datos.registros.length,
    { message: 'No se puede repetir un alumno en la misma petición' },
  )

export type RegistrarAsistenciaLoteInput = z.infer<
  typeof registrarAsistenciaLoteSchema
>

/**
 * Corrección de una asistencia (RF-ACAD-005).
 *
 * El motivo es obligatorio (RN-ACAD-010); el valor anterior y el nuevo se
 * auditan en el servicio.
 */
export const corregirAsistenciaSchema = z
  .object({
    estado: estadoAsistenciaSchema.optional(),
    observacion: observacionSchema.optional(),
    motivo: z
      .string()
      .trim()
      .min(1, 'El motivo es obligatorio')
      .max(500, 'El motivo es demasiado largo'),
  })
  .refine(
    (datos) => datos.estado !== undefined || datos.observacion !== undefined,
    { message: 'Debe enviar el estado, la observación o ambos' },
  )

export type CorregirAsistenciaInput = z.infer<typeof corregirAsistenciaSchema>

/** Filtros del listado de asistencias (RF-ACAD-007). */
export const listarAsistenciasQuerySchema = paginationSchema
  .extend({
    alumnoId: uuidSchema.optional(),
    seccionId: uuidSchema.optional(),
    anioId: uuidSchema.optional(),
    desde: fechaEscolarSchema.optional(),
    hasta: fechaEscolarSchema.optional(),
  })
  .refine(
    (datos) =>
      datos.desde === undefined ||
      datos.hasta === undefined ||
      datos.desde <= datos.hasta,
    { message: 'La fecha inicial no puede ser posterior a la final' },
  )

export type ListarAsistenciasQuery = z.infer<
  typeof listarAsistenciasQuerySchema
>
