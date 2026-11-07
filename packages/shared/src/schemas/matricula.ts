import { z } from 'zod'
import { paginationSchema, uuidSchema } from './base.js'

/** Estados posibles de una matrícula (spec core §6). */
export const estadoMatriculaSchema = z.enum([
  'SOLICITADA',
  'APROBADA',
  'RETIRADA',
])

export type EstadoMatricula = z.infer<typeof estadoMatriculaSchema>

/**
 * Registro de una matrícula (RF-CORE-015).
 *
 * La sección y el año deben corresponderse: la sección ya pertenece a un año y
 * el servicio rechaza combinaciones incoherentes.
 */
export const crearMatriculaSchema = z.object({
  alumnoId: uuidSchema,
  seccionId: uuidSchema,
  anioId: uuidSchema,
})

export type CrearMatriculaInput = z.infer<typeof crearMatriculaSchema>

/**
 * Cambio de estado de una matrícula.
 *
 * `SOLICITADA` es el estado inicial y no se recupera: una matrícula retirada se
 * conserva como historial y no se reabre.
 */
export const actualizarMatriculaSchema = z.object({
  estado: estadoMatriculaSchema,
})

export type ActualizarMatriculaInput = z.infer<
  typeof actualizarMatriculaSchema
>

/** Filtros opcionales del historial de matrículas. */
export const listarMatriculasQuerySchema = paginationSchema.extend({
  alumnoId: uuidSchema.optional(),
  anioId: uuidSchema.optional(),
  estado: estadoMatriculaSchema.optional(),
})

export type ListarMatriculasQuery = z.infer<
  typeof listarMatriculasQuerySchema
>
