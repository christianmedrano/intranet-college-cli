import { z } from 'zod'

/** Estados posibles de un año académico (spec core §6). */
export const estadoAnioAcademicoSchema = z.enum([
  'PLANIFICADO',
  'ACTIVO',
  'CERRADO',
])

export type EstadoAnioAcademico = z.infer<typeof estadoAnioAcademicoSchema>

/** Fecha sin hora en formato ISO `YYYY-MM-DD`. */
const fechaSchema = z.iso.date('La fecha debe tener el formato AAAA-MM-DD')

const nombreSchema = z
  .string()
  .trim()
  .min(1, 'El nombre es obligatorio')
  .max(20, 'El nombre es demasiado largo')

/**
 * Creación de un año académico (RF-CORE-008).
 *
 * El estado no se acepta en el cuerpo: todo año nace `PLANIFICADO` y solo se
 * activa por `POST /anios-academicos/:id/activar`, que garantiza la unicidad
 * del año activo (RN-CORE-002).
 */
export const crearAnioAcademicoSchema = z.object({
  nombre: nombreSchema,
  fechaInicio: fechaSchema,
  fechaFin: fechaSchema,
})

export type CrearAnioAcademicoInput = z.infer<typeof crearAnioAcademicoSchema>

/**
 * Actualización parcial de un año académico.
 *
 * Excluye `estado` a propósito: la activación tiene su propio endpoint
 * transaccional. Se exige al menos un campo para evitar cambios vacíos.
 */
export const actualizarAnioAcademicoSchema = z
  .object({
    nombre: nombreSchema.optional(),
    fechaInicio: fechaSchema.optional(),
    fechaFin: fechaSchema.optional(),
  })
  .refine((datos) => Object.keys(datos).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar',
  })

export type ActualizarAnioAcademicoInput = z.infer<
  typeof actualizarAnioAcademicoSchema
>
