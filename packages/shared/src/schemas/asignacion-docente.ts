import { z } from 'zod'
import { paginationSchema, uuidSchema } from './base.js'

/**
 * Creación de una asignación docente–curso–sección–año (RF-CORE-011).
 *
 * El curso y la sección deben pertenecer al mismo nivel, y la sección al año
 * indicado; el servicio valida esas coherencias.
 */
export const crearAsignacionDocenteSchema = z.object({
  docenteId: uuidSchema,
  cursoId: uuidSchema,
  seccionId: uuidSchema,
  anioId: uuidSchema,
  esTutor: z.boolean().optional(),
})

export type CrearAsignacionDocenteInput = z.infer<
  typeof crearAsignacionDocenteSchema
>

/**
 * Actualización de una asignación docente (RF-CORE-011).
 *
 * Solo se puede cambiar la marca de tutor: los identificadores de docente,
 * curso, sección y año son inmutables una vez creada la asignación.
 */
export const actualizarAsignacionDocenteSchema = z.object({
  esTutor: z.boolean(),
})

export type ActualizarAsignacionDocenteInput = z.infer<
  typeof actualizarAsignacionDocenteSchema
>

/** Filtros opcionales del listado de asignaciones. */
export const listarAsignacionesDocenteQuerySchema = paginationSchema.extend({
  docenteId: uuidSchema.optional(),
  cursoId: uuidSchema.optional(),
  seccionId: uuidSchema.optional(),
  anioId: uuidSchema.optional(),
})

export type ListarAsignacionesDocenteQuery = z.infer<
  typeof listarAsignacionesDocenteQuerySchema
>
