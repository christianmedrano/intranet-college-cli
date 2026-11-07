import { z } from 'zod'

/** Fecha sin hora en formato ISO `YYYY-MM-DD`. */
const fechaSchema = z.iso.date('La fecha debe tener el formato AAAA-MM-DD')

const nombreSchema = z
  .string()
  .trim()
  .min(1, 'El nombre es obligatorio')
  .max(100, 'El nombre es demasiado largo')

const tipoDocumentoSchema = z
  .string()
  .trim()
  .min(2, 'El tipo de documento es obligatorio')
  .max(20, 'El tipo de documento es demasiado largo')

const numeroDocumentoSchema = z
  .string()
  .trim()
  .min(1, 'El número de documento es obligatorio')
  .max(30, 'El número de documento es demasiado largo')

const telefonoSchema = z
  .string()
  .trim()
  .min(1, 'El teléfono no puede estar vacío')
  .max(30, 'El teléfono es demasiado largo')
  .nullable()
  .optional()

const emailContactoSchema = z
  .email('El correo de contacto no es válido')
  .trim()
  .max(150, 'El correo de contacto es demasiado largo')
  .nullable()
  .optional()

const direccionSchema = z
  .string()
  .trim()
  .min(1, 'La dirección no puede estar vacía')
  .max(200, 'La dirección es demasiado larga')
  .nullable()
  .optional()

/**
 * Datos personales comunes a alumnos, docentes y apoderados (spec core §6).
 *
 * `Persona` es única por `(tipoDocumento, numeroDocumento)`. La fecha de
 * nacimiento es opcional y viaja como `YYYY-MM-DD`.
 */
export const personaSchema = z.object({
  nombres: nombreSchema,
  apellidos: nombreSchema,
  tipoDocumento: tipoDocumentoSchema,
  numeroDocumento: numeroDocumentoSchema,
  fechaNacimiento: fechaSchema.nullable().optional(),
  telefono: telefonoSchema,
  emailContacto: emailContactoSchema,
  direccion: direccionSchema,
})

export type PersonaInput = z.infer<typeof personaSchema>

/**
 * Actualización parcial de los datos personales.
 *
 * Todos los campos son opcionales; los que admiten `null` se vacían enviando
 * `null`. La regla "al menos un campo" evita peticiones sin efecto.
 */
export const actualizarPersonaSchema = z
  .object({
    nombres: nombreSchema.optional(),
    apellidos: nombreSchema.optional(),
    tipoDocumento: tipoDocumentoSchema.optional(),
    numeroDocumento: numeroDocumentoSchema.optional(),
    fechaNacimiento: fechaSchema.nullable().optional(),
    telefono: telefonoSchema,
    emailContacto: emailContactoSchema,
    direccion: direccionSchema,
  })
  .refine((datos) => Object.keys(datos).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar',
  })

export type ActualizarPersonaInput = z.infer<typeof actualizarPersonaSchema>
