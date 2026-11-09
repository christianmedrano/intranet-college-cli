import { z } from 'zod'
import { paginationSchema, uuidSchema } from '../base.js'

/** Filtros del listado de alertas de inasistencias (RF-ACAD-009). */
export const listarAlertasAsistenciaQuerySchema = paginationSchema.extend({
  anioId: uuidSchema.optional(),
  alumnoId: uuidSchema.optional(),
})

export type ListarAlertasAsistenciaQuery = z.infer<
  typeof listarAlertasAsistenciaQuerySchema
>
