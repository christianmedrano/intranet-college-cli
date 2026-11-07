import { z } from 'zod'
import { paginationSchema, uuidSchema } from './base.js'

const nombreSchema = z
  .string()
  .trim()
  .min(1, 'El nombre es obligatorio')
  .max(20, 'El nombre es demasiado largo')

/**
 * Capacidad de la sección. Es opcional y admite `null`: no todas las
 * instituciones fijan un aforo (spec core §6).
 */
const capacidadSchema = z
  .number()
  .int('La capacidad debe ser un entero')
  .min(1, 'La capacidad debe ser mayor que cero')
  .nullable()
  .optional()

/**
 * Creación de una sección (RF-CORE-010).
 *
 * La sección es única por `(grado, año, nombre)`; `gradoId` y `anioId` se fijan
 * al crear y no se mueven por `PATCH`.
 */
export const crearSeccionSchema = z.object({
  gradoId: uuidSchema,
  anioId: uuidSchema,
  nombre: nombreSchema,
  capacidad: capacidadSchema,
})

export type CrearSeccionInput = z.infer<typeof crearSeccionSchema>

/** Actualización parcial de una sección; excluye los padres a propósito. */
export const actualizarSeccionSchema = z
  .object({
    nombre: nombreSchema.optional(),
    capacidad: capacidadSchema,
  })
  .refine((datos) => Object.keys(datos).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar',
  })

export type ActualizarSeccionInput = z.infer<typeof actualizarSeccionSchema>

/** Filtros opcionales del listado: por grado y/o por año académico. */
export const listarSeccionesQuerySchema = paginationSchema.extend({
  gradoId: uuidSchema.optional(),
  anioId: uuidSchema.optional(),
})

export type ListarSeccionesQuery = z.infer<typeof listarSeccionesQuerySchema>
