import { z } from 'zod'
import { personaSchema, actualizarPersonaSchema } from './persona.js'

/** Fecha sin hora en formato ISO `YYYY-MM-DD`. */
const fechaSchema = z.iso.date('La fecha debe tener el formato AAAA-MM-DD')

const codigoAlumnoSchema = z
  .string()
  .trim()
  .min(1, 'El código de alumno es obligatorio')
  .max(30, 'El código de alumno es demasiado largo')

const observacionesSchema = z
  .string()
  .trim()
  .min(1, 'Las observaciones no pueden estar vacías')
  .max(2000, 'Las observaciones son demasiado largas')
  .nullable()
  .optional()

/**
 * Registro de un alumno con sus datos personales (RF-CORE-012).
 *
 * La creación de la cuenta de acceso es una operación aparte: el alumno puede
 * existir sin usuario.
 */
export const crearAlumnoSchema = z.object({
  persona: personaSchema,
  codigoAlumno: codigoAlumnoSchema,
  fechaIngreso: fechaSchema.nullable().optional(),
  observaciones: observacionesSchema,
})

export type CrearAlumnoInput = z.infer<typeof crearAlumnoSchema>

/** Actualización parcial del alumno y de su persona; exige al menos un campo. */
export const actualizarAlumnoSchema = z
  .object({
    persona: actualizarPersonaSchema.optional(),
    codigoAlumno: codigoAlumnoSchema.optional(),
    fechaIngreso: fechaSchema.nullable().optional(),
    observaciones: observacionesSchema,
  })
  .refine((datos) => Object.keys(datos).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar',
  })

export type ActualizarAlumnoInput = z.infer<typeof actualizarAlumnoSchema>
