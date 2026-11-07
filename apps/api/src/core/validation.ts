import type { ZodType } from 'zod'
import { AppError } from './errors.js'

/**
 * Valida una entrada con un schema compartido y lanza `VALIDATION_ERROR`.
 *
 * Los detalles se construyen con la ruta del campo y el mensaje de Zod; nunca
 * incluyen los valores recibidos, para no filtrar datos personales en la
 * respuesta ni en los logs.
 *
 * @param schema Schema Zod del contrato compartido.
 * @param datos Cuerpo, parámetros o query sin validar.
 * @throws AppError `VALIDATION_ERROR` con un detalle por problema.
 */
export function parseOrThrow<T>(schema: ZodType<T>, datos: unknown): T {
  const parsed = schema.safeParse(datos)

  if (!parsed.success) {
    throw new AppError(
      'VALIDATION_ERROR',
      undefined,
      parsed.error.issues.map(
        (issue) => `${issue.path.join('.') || 'cuerpo'}: ${issue.message}`,
      ),
    )
  }

  return parsed.data
}
