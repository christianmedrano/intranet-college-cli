import type { ValorLiteral } from '../../domain/academic.js'

/**
 * Calificación literal expuesta por la API (RF-ACAD-001).
 *
 * `createdAt` y `updatedAt` viajan en ISO 8601 con hora; no se expone ningún
 * campo numérico ni equivalencia (RN-ACAD-001).
 */
export interface CalificacionResponse {
  id: string
  alumnoId: string
  cursoId: string
  periodoId: string
  valor: ValorLiteral
  observacion: string | null
  createdAt: string
  updatedAt: string
}

/** Nota final manual del período (RF-ACAD-002, RN-ACAD-004). */
export interface NotaFinalResponse {
  id: string
  alumnoId: string
  cursoId: string
  periodoId: string
  valor: ValorLiteral
  observacion: string | null
  createdAt: string
  updatedAt: string
}

/**
 * Resumen de calificaciones de un período (RF-ACAD-012).
 *
 * `core` lo consume para bloquear el borrado de un año con notas.
 */
export interface ResumenCalificacionesResponse {
  totalCalificaciones: number
  totalNotasFinales: number
  tieneCalificaciones: boolean
}
