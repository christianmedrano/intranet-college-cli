import { z } from 'zod'
import { paginationMetaSchema, uuidSchema } from './base.js'

/** Estados posibles de un período académico (spec core §6). */
export const estadoPeriodoAcademicoSchema = z.enum([
  'PLANIFICADO',
  'ACTIVO',
  'CERRADO',
])

export type EstadoPeriodoAcademico = z.infer<
  typeof estadoPeriodoAcademicoSchema
>

/** Fecha sin hora en formato ISO `YYYY-MM-DD`. */
const fechaSchema = z.iso.date('La fecha debe tener el formato AAAA-MM-DD')

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
 * Creación de un período académico (RF-CORE-009).
 *
 * No se acepta `estado`: todo período nace `PLANIFICADO` y solo se cierra por
 * `POST /periodos/:id/cerrar`. La cantidad de períodos no está limitada por
 * regla de negocio: el año define N períodos (RN-CORE-003).
 */
export const crearPeriodoAcademicoSchema = z.object({
  nombre: nombreSchema,
  orden: ordenSchema,
  fechaInicio: fechaSchema,
  fechaFin: fechaSchema,
})

export type CrearPeriodoAcademicoInput = z.infer<
  typeof crearPeriodoAcademicoSchema
>

/** Actualización parcial; excluye `estado` a propósito (ver cierre). */
export const actualizarPeriodoAcademicoSchema = z
  .object({
    nombre: nombreSchema.optional(),
    orden: ordenSchema.optional(),
    fechaInicio: fechaSchema.optional(),
    fechaFin: fechaSchema.optional(),
  })
  .refine((datos) => Object.keys(datos).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar',
  })

export type ActualizarPeriodoAcademicoInput = z.infer<
  typeof actualizarPeriodoAcademicoSchema
>

/**
 * Período académico expuesto por la API (RF-CORE-009).
 */
export const periodoAcademicoResponseSchema = z.object({
  id: uuidSchema,
  anioId: uuidSchema,
  nombre: z.string(),
  orden: z.number().int(),
  fechaInicio: z.string(),
  fechaFin: z.string(),
  estado: estadoPeriodoAcademicoSchema,
})

export type PeriodoAcademicoResponsePayload = z.infer<
  typeof periodoAcademicoResponseSchema
>

/**
 * Listado paginado de períodos académicos.
 */
export const paginatedPeriodosAcademicosSchema = z.object({
  data: z.array(periodoAcademicoResponseSchema),
  meta: paginationMetaSchema,
})

export type PaginatedPeriodosAcademicosPayload = z.infer<
  typeof paginatedPeriodosAcademicosSchema
>