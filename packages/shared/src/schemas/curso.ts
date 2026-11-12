import { z } from 'zod'
import { paginationSchema, paginationMetaSchema, uuidSchema } from './base.js'

const nombreSchema = z
  .string()
  .trim()
  .min(1, 'El nombre es obligatorio')
  .max(100, 'El nombre es demasiado largo')

/** Área curricular opcional; `null` la vacía en una actualización. */
const areaSchema = z
  .string()
  .trim()
  .min(1, 'El área no puede estar vacía')
  .max(100, 'El área es demasiado larga')
  .nullable()

const ordenSchema = z
  .number()
  .int('El orden debe ser un entero')
  .min(1, 'El orden debe ser mayor o igual a 1')
  .max(100, 'El orden es demasiado alto')

/**
 * Creación de un curso (RF-CORE-011).
 *
 * El curso pertenece a un nivel y es único por `(nivel, nombre)`. El nivel se
 * fija al crear y no se mueve por `PATCH`.
 */
export const crearCursoSchema = z.object({
  nivelId: uuidSchema,
  nombre: nombreSchema,
  area: areaSchema.optional(),
  orden: ordenSchema,
})

export type CrearCursoInput = z.infer<typeof crearCursoSchema>

/** Actualización parcial de un curso; excluye `nivelId` a propósito. */
export const actualizarCursoSchema = z
  .object({
    nombre: nombreSchema.optional(),
    area: areaSchema.optional(),
    orden: ordenSchema.optional(),
  })
  .refine((datos) => Object.keys(datos).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar',
  })

export type ActualizarCursoInput = z.infer<typeof actualizarCursoSchema>

/** Filtro opcional del listado: cursos de un nivel concreto. */
export const listarCursosQuerySchema = paginationSchema.extend({
  nivelId: uuidSchema.optional(),
})

export type ListarCursosQuery = z.infer<typeof listarCursosQuerySchema>

/**
 * Curso expuesto por la API (RF-CORE-011).
 */
export const cursoResponseSchema = z.object({
  id: uuidSchema,
  nivelId: uuidSchema,
  nombre: z.string(),
  area: z.string().nullable(),
  orden: z.number().int(),
})

export type CursoResponsePayload = z.infer<typeof cursoResponseSchema>

/**
 * Listado paginado de cursos.
 */
export const paginatedCursosSchema = z.object({
  data: z.array(cursoResponseSchema),
  meta: paginationMetaSchema,
})

export type PaginatedCursosPayload = z.infer<typeof paginatedCursosSchema>
