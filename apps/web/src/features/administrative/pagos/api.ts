import {
  pagoResponseSchema,
  paginatedPagosSchema,
  estadoCuentaResponseSchema,
  type CrearPagoInput,
  type AnularPagoInput,
  type PagoResponsePayload,
  type PaginatedPagosPayload,
  type EstadoCuentaResponsePayload,
} from '@intranet/shared'
import { apiRequest } from '../../../shared/api/client'

// Re-export types for consumers
export type { PagoResponsePayload, PaginatedPagosPayload, EstadoCuentaResponsePayload }

/** Parámetros para listado de pagos con alcance por rol. */
export interface ListarPagosParams {
  /** Página (1-indexed) */
  page?: number
  /** Tamaño de página */
  pageSize?: number
  /** Filtrar por alumno */
  alumnoId?: string
  /** Filtrar por concepto */
  concepto?: string
  /** Filtrar por fecha desde */
  fechaDesde?: string
  /** Filtrar por fecha hasta */
  fechaHasta?: string
  /** Filtrar por estado */
  estado?: string
  /** Filtrar por método */
  metodo?: string
}

/**
 * Listado paginado de pagos con alcance por vínculo (RF-ADM-004).
 *
 * El backend filtra según el rol:
 * - Director/SuperAdmin: todos los pagos
 * - Apoderado: solo pagos de sus alumnos vinculados
 * - Alumno: solo sus propios pagos
 */
export async function listarPagos(
  query: ListarPagosParams = {},
): Promise<PaginatedPagosPayload> {
  const params = new URLSearchParams()
  if (query.page) params.set('page', String(query.page))
  if (query.pageSize) params.set('pageSize', String(query.pageSize))
  if (query.alumnoId) params.set('alumnoId', query.alumnoId)
  if (query.concepto) params.set('concepto', query.concepto)
  if (query.fechaDesde) params.set('fechaDesde', query.fechaDesde)
  if (query.fechaHasta) params.set('fechaHasta', query.fechaHasta)
  if (query.estado) params.set('estado', query.estado)
  if (query.metodo) params.set('metodo', query.metodo)

  return apiRequest(`/api/v1/pagos?${params.toString()}`, paginatedPagosSchema)
}

/**
 * Obtiene el detalle de un pago por ID.
 */
export async function obtenerPago(id: string): Promise<PagoResponsePayload> {
  return apiRequest(`/api/v1/pagos/${id}`, pagoResponseSchema)
}

/**
 * Registra un nuevo pago (RF-ADM-001).
 *
 * Requiere: alumnoId, concepto, monto, fechaPago, metodo
 * Validaciones: monto > 0, fecha no futura, concepto/método válidos
 */
export async function crearPago(input: CrearPagoInput): Promise<PagoResponsePayload> {
  return apiRequest('/api/v1/pagos', pagoResponseSchema, {
    method: 'POST',
    body: input,
  })
}

/**
 * Anula un pago existente (RF-ADM-002, RN-ADM-002).
 *
 * Requiere motivo obligatorio. El pago debe estar REGISTRADO.
 */
export async function anularPago(
  id: string,
  input: AnularPagoInput,
): Promise<PagoResponsePayload> {
  return apiRequest(`/api/v1/pagos/${id}/anular`, pagoResponseSchema, {
    method: 'PATCH',
    body: input,
  })
}

/**
 * Obtiene el estado de cuenta de un alumno (RF-ADM-003).
 *
 * Retorna totales por concepto y general, distinguidos entre pagado/pendiente.
 * El alcance depende del rol: Director ve todos, Apoderado/Alumno solo sus vinculados.
 */
export async function obtenerEstadoCuenta(
  alumnoId: string,
): Promise<EstadoCuentaResponsePayload> {
  return apiRequest(`/api/v1/alumnos/${alumnoId}/estado-cuenta`, estadoCuentaResponseSchema)
}