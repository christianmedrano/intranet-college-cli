import { z } from 'zod'
import { diaSemanaSchema } from '../../domain/academic.js'
import { paginationSchema, uuidSchema } from '../base.js'
import { horaSchema } from './base.js'

const horarioBaseSchema = z.object({
  anioId: uuidSchema,
  seccionId: uuidSchema,
  cursoId: uuidSchema,
  docenteId: uuidSchema.optional(),
  diaSemana: diaSemanaSchema,
  horaInicio: horaSchema,
  horaFin: horaSchema,
})

/**
 * Creación de un bloque de horario semanal (RF-ACAD-010).
 *
 * El curso debe pertenecer al nivel de la sección y, si se indica docente,
 * debe tener asignación vigente (RN-ACAD-018): ambas reglas se validan en el
 * servicio porque requieren consultar la base.
 */
export const crearHorarioSchema = horarioBaseSchema.refine(
  (datos) => datos.horaInicio < datos.horaFin,
  {
    message: 'La hora de inicio debe ser anterior a la de fin',
    path: ['horaFin'],
  },
)

export type CrearHorarioInput = z.infer<typeof crearHorarioSchema>

/**
 * Actualización parcial de un horario.
 *
 * Si se envían ambas horas se valida el orden; si se envía una sola, el
 * servicio la contrasta con el valor persistido.
 */
export const actualizarHorarioSchema = horarioBaseSchema
  .partial()
  .refine((datos) => Object.keys(datos).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar',
  })
  .refine(
    (datos) =>
      datos.horaInicio === undefined ||
      datos.horaFin === undefined ||
      datos.horaInicio < datos.horaFin,
    {
      message: 'La hora de inicio debe ser anterior a la de fin',
      path: ['horaFin'],
    },
  )

export type ActualizarHorarioInput = z.infer<typeof actualizarHorarioSchema>

/** Filtros del listado de horarios; el año es obligatorio (RF-ACAD-011). */
export const listarHorariosQuerySchema = paginationSchema.extend({
  anioId: uuidSchema,
  seccionId: uuidSchema.optional(),
  docenteId: uuidSchema.optional(),
})

export type ListarHorariosQuery = z.infer<typeof listarHorariosQuerySchema>
