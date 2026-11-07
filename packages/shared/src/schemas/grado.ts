import { z } from 'zod'
import { paginationSchema, uuidSchema } from './base.js'

const nombreSchema = z
  .string()
  .trim()
  .min(1, 'El nombre es obligatorio')
  .max(50, 'El nombre es demasiado largo')

const ordenSchema = z
  .number()
  .int('El orden debe ser un entero')
  .min(1, 'El orden debe ser mayor o igual a 1')
  .max(100, 'El orden es demasiado alto')

/**
 * Creación de un grado (RF-CORE-010).
 *
 * `nivelId` es el padre y se fija al crear: un `PATCH` no permite mover el
 * grado de nivel, igual que un año no cambia de institución.
 */
export const crearGradoSchema = z.object({
  nivelId: uuidSchema,
  nombre: nombreSchema,
  orden: ordenSchema,
})

export type CrearGradoInput = z.infer<typeof crearGradoSchema>

/** Actualización parcial de un grado; excluye `nivelId` a propósito. */
export const actualizarGradoSchema = z
  .object({
    nombre: nombreSchema.optional(),
    orden: ordenSchema.optional(),
  })
  .refine((datos) => Object.keys(datos).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar',
  })

export type ActualizarGradoInput = z.infer<typeof actualizarGradoSchema>

/** Filtro opcional del listado: grados de un nivel concreto. */
export const listarGradosQuerySchema = paginationSchema.extend({
  nivelId: uuidSchema.optional(),
})

export type ListarGradosQuery = z.infer<typeof listarGradosQuerySchema>
