import type { ErrorCode } from '../schemas/base.js'

/** Respuesta de error uniforme de la API. */
export interface ApiError {
  error: {
    code: ErrorCode
    message: string
    details: string[]
  }
}

/** Metadatos de paginación incluidos en los listados. */
export interface PaginationMeta {
  page: number
  pageSize: number
  total: number
}

/** Envoltorio estándar para listados paginados. */
export interface Paginated<T> {
  data: T[]
  meta: PaginationMeta
}

/** Respuesta de un recurso individual. */
export interface ItemResponse<T> {
  data: T
}
