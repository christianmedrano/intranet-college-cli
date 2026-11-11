import { z } from 'zod'

/**
 * Identificador único universal usado como clave primaria en todo el dominio.
 * La constitución (§4.1) exige UUID generado en la aplicación.
 */
export const uuidSchema = z.uuid()

/** Versión numérica de un UUID, útil para construir parámetros de ruta. */
export const uuidParamSchema = z.object({
  id: uuidSchema,
})

/** Parámetros de paginación estándar de la API (`?page=1&pageSize=20`). */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

/** Metadatos de paginación que acompañan a los listados. */
export const paginationMetaSchema = z.object({
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  total: z.number().int().min(0),
})

/** Códigos de error del sobre estándar descrito en `docs/architecture.md`. */
export const errorCodeSchema = z.enum([
  'VALIDATION_ERROR',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
])

/**
 * Forma de un código de permiso: `modulo.recurso.accion`.
 * El catálogo concreto de permisos vive en `domain/permissions.ts` (T017);
 * aquí solo se valida el formato.
 */
export const permissionCodeSchema = z
  .string()
  .regex(
    /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*){1,2}$/,
    'El permiso debe tener el formato modulo.recurso.accion',
  )

/** Sobre de error uniforme para todas las respuestas de la API. */
export const apiErrorSchema = z.object({
  error: z.object({
    code: errorCodeSchema,
    message: z.string().min(1),
    details: z.array(z.string()).default([]),
  }),
})

export type Uuid = z.infer<typeof uuidSchema>
export type PaginationInput = z.infer<typeof paginationSchema>
export type ErrorCode = z.infer<typeof errorCodeSchema>
export type PermissionCode = z.infer<typeof permissionCodeSchema>
export type ApiErrorPayload = z.infer<typeof apiErrorSchema>
