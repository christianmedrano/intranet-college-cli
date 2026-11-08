import { z } from 'zod'
import { paginationSchema, uuidSchema } from './base.js'

/** Fecha y hora ISO 8601 usada por los filtros de auditoría. */
const fechaHoraSchema = z.iso.datetime({ offset: true })

/**
 * Filtros del listado de auditoría (RF-CORE-016).
 *
 * `entidad` y `accion` se comparan de forma exacta con lo persistido; el
 * llamador decide si usa mayúsculas o minúsculas según el registro.
 */
export const listarAuditoriaQuerySchema = paginationSchema.extend({
  usuarioId: uuidSchema.optional(),
  entidad: z.string().trim().min(1).max(60).optional(),
  entidadId: uuidSchema.optional(),
  accion: z.string().trim().min(1).max(50).optional(),
  desde: fechaHoraSchema.optional(),
  hasta: fechaHoraSchema.optional(),
})

export type ListarAuditoriaQuery = z.infer<typeof listarAuditoriaQuerySchema>
