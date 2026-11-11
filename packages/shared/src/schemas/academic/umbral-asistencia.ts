import { z } from 'zod'

/**
 * Configuración del umbral de inasistencias por año (RF-ACAD-008).
 *
 * Es un entero positivo y no tiene valor por defecto: si no se configura, no
 * se generan alertas (RN-ACAD-013, RN-ACAD-014).
 */
export const umbralAsistenciaSchema = z.object({
  faltasParaAlerta: z
    .number()
    .int('El umbral debe ser un entero')
    .positive('El umbral debe ser mayor que cero'),
})

/** Respuesta del umbral de un año (RF-ACAD-008). */
export const umbralAsistenciaResponseSchema = z.object({
  anioId: z.string().uuid(),
  faltasParaAlerta: z.number().int().positive().nullable(),
})

export type UmbralAsistenciaInput = z.infer<typeof umbralAsistenciaSchema>
export type UmbralAsistenciaResponsePayload = z.infer<
  typeof umbralAsistenciaResponseSchema
>
