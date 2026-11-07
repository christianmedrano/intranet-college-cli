import { z } from 'zod'
import { actualizarPersonaSchema, personaSchema } from './persona.js'

const codigoDocenteSchema = z
  .string()
  .trim()
  .min(1, 'El código de docente es obligatorio')
  .max(30, 'El código de docente es demasiado largo')

const especialidadSchema = z
  .string()
  .trim()
  .min(1, 'La especialidad no puede estar vacía')
  .max(100, 'La especialidad es demasiado larga')
  .nullable()
  .optional()

/**
 * Registro de un docente con sus datos personales (RF-CORE-013).
 *
 * El docente puede existir sin cuenta de acceso.
 */
export const crearDocenteSchema = z.object({
  persona: personaSchema,
  codigoDocente: codigoDocenteSchema,
  especialidad: especialidadSchema,
})

export type CrearDocenteInput = z.infer<typeof crearDocenteSchema>

/** Actualización parcial del docente y de su persona. */
export const actualizarDocenteSchema = z
  .object({
    persona: actualizarPersonaSchema.optional(),
    codigoDocente: codigoDocenteSchema.optional(),
    especialidad: especialidadSchema,
  })
  .refine((datos) => Object.keys(datos).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar',
  })

export type ActualizarDocenteInput = z.infer<typeof actualizarDocenteSchema>
