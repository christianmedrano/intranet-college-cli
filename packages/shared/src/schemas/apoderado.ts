import { z } from 'zod'
import { uuidSchema } from './base.js'
import { actualizarPersonaSchema, personaSchema } from './persona.js'

const ocupacionSchema = z
  .string()
  .trim()
  .min(1, 'La ocupación no puede estar vacía')
  .max(100, 'La ocupación es demasiado larga')
  .nullable()
  .optional()

/**
 * Registro de un apoderado con sus datos personales (RF-CORE-014).
 *
 * Los vínculos con alumnos se crean por `POST /apoderados/:id/alumnos`.
 */
export const crearApoderadoSchema = z.object({
  persona: personaSchema,
  ocupacion: ocupacionSchema,
})

export type CrearApoderadoInput = z.infer<typeof crearApoderadoSchema>

/** Actualización parcial del apoderado y de su persona. */
export const actualizarApoderadoSchema = z
  .object({
    persona: actualizarPersonaSchema.optional(),
    ocupacion: ocupacionSchema,
  })
  .refine((datos) => Object.keys(datos).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar',
  })

export type ActualizarApoderadoInput = z.infer<
  typeof actualizarApoderadoSchema
>

/**
 * Vínculo de un alumno con un apoderado (RF-CORE-014).
 *
 * `esPrincipal` es opcional; si se envía `true`, el servicio desmarca al
 * principal anterior del alumno para mantener exactamente uno.
 */
export const vincularAlumnoSchema = z.object({
  alumnoId: uuidSchema,
  parentesco: z
    .string()
    .trim()
    .min(1, 'El parentesco es obligatorio')
    .max(50, 'El parentesco es demasiado largo'),
  esPrincipal: z.boolean().optional().default(false),
})

export type VincularAlumnoInput = z.infer<typeof vincularAlumnoSchema>
