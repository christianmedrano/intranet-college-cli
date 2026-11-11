import { z } from 'zod'
import { paginationMetaSchema, paginationSchema, uuidSchema } from '../base.js'

/** Filtros del listado de alertas de inasistencias (RF-ACAD-009). */
export const listarAlertasAsistenciaQuerySchema = paginationSchema.extend({
  anioId: uuidSchema.optional(),
  alumnoId: uuidSchema.optional(),
})

export type ListarAlertasAsistenciaQuery = z.infer<
  typeof listarAlertasAsistenciaQuerySchema
>

/** Alerta de inasistencias devuelta por la API (RF-ACAD-009). */
export const alertaAsistenciaResponseSchema = z.object({
  id: uuidSchema,
  alumnoId: uuidSchema,
  anioId: uuidSchema,
  faltasInjustificadas: z.number().int().nonnegative(),
  umbral: z.number().int().positive(),
  generadaEn: z.string(),
  actualizadaEn: z.string(),
})

/** Listado paginado de alertas. */
export const paginatedAlertasAsistenciaSchema = z.object({
  data: z.array(alertaAsistenciaResponseSchema),
  meta: paginationMetaSchema,
})

export type AlertaAsistenciaResponsePayload = z.infer<
  typeof alertaAsistenciaResponseSchema
>
export type PaginatedAlertasAsistenciaPayload = z.infer<
  typeof paginatedAlertasAsistenciaSchema
>
