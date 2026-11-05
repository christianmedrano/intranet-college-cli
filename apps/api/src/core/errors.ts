import type {
  FastifyError,
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
} from 'fastify'
import type { ApiError, ErrorCode } from '@intranet/shared'

/** Código HTTP asociado a cada código de error del dominio. */
const STATUS_BY_CODE: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
}

/** Mensajes neutros: nunca exponen detalles internos ni datos de la base. */
const DEFAULT_MESSAGE: Record<ErrorCode, string> = {
  VALIDATION_ERROR: 'Los datos enviados no son válidos.',
  UNAUTHORIZED: 'Debes iniciar sesión para continuar.',
  FORBIDDEN: 'No tienes permiso para realizar esta acción.',
  NOT_FOUND: 'El recurso solicitado no existe.',
  CONFLICT: 'La operación entra en conflicto con datos existentes.',
  RATE_LIMITED: 'Demasiados intentos. Inténtalo más tarde.',
  INTERNAL_ERROR: 'Ocurrió un error inesperado.',
}

/** Traducción de códigos HTTP de Fastify a códigos del sobre de error. */
const CODE_BY_STATUS: Partial<Record<number, ErrorCode>> = {
  400: 'VALIDATION_ERROR',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  429: 'RATE_LIMITED',
}

/**
 * Error de dominio con código, estado HTTP y mensaje apto para el usuario.
 *
 * Los servicios lanzan `AppError`; el manejador global lo traduce al sobre
 * estándar de `docs/architecture.md`.
 */
export class AppError extends Error {
  readonly code: ErrorCode
  readonly details: string[]

  constructor(code: ErrorCode, message?: string, details: string[] = []) {
    super(message ?? DEFAULT_MESSAGE[code])
    this.name = 'AppError'
    this.code = code
    this.details = details
  }

  get statusCode(): number {
    return STATUS_BY_CODE[this.code]
  }
}

/** Construye el sobre de error uniforme de la API. */
export function errorResponse(
  code: ErrorCode,
  message?: string,
  details: string[] = [],
): ApiError {
  return {
    error: {
      code,
      message: message ?? DEFAULT_MESSAGE[code],
      details,
    },
  }
}

/**
 * Registra el manejador global de errores.
 *
 * Los errores no controlados se registran en el log y al cliente solo le llega
 * un mensaje genérico, sin trazas ni detalles de base de datos.
 */
export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler(
    (error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
      if (error instanceof AppError) {
        return reply
          .code(error.statusCode)
          .send(errorResponse(error.code, error.message, error.details))
      }

      if (error.validation) {
        return reply
          .code(400)
          .send(errorResponse('VALIDATION_ERROR', undefined, error.validation.map(
            (issue) => `${issue.instancePath || issue.params?.missingProperty || 'campo'}: ${issue.message ?? 'inválido'}`,
          )))
      }

      const mapped = CODE_BY_STATUS[error.statusCode ?? 500]
      if (mapped) {
        return reply.code(error.statusCode ?? 500).send(errorResponse(mapped))
      }

      request.log.error({ err: error }, 'Error no controlado')
      return reply.code(500).send(errorResponse('INTERNAL_ERROR'))
    },
  )
}
