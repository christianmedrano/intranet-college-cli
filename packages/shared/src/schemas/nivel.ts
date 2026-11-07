import { z } from 'zod'

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
 * Creación de un nivel educativo (RF-CORE-010).
 *
 * El nivel se asocia a la única institución del despliegue; por eso
 * `institucionId` no viaja en el cuerpo.
 */
export const crearNivelSchema = z.object({
  nombre: nombreSchema,
  orden: ordenSchema,
})

export type CrearNivelInput = z.infer<typeof crearNivelSchema>

/** Actualización parcial de un nivel; exige al menos un campo. */
export const actualizarNivelSchema = z
  .object({
    nombre: nombreSchema.optional(),
    orden: ordenSchema.optional(),
  })
  .refine((datos) => Object.keys(datos).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar',
  })

export type ActualizarNivelInput = z.infer<typeof actualizarNivelSchema>
