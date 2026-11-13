/**
 * Contrato de respuesta para pago (RF-ADM-001 a RF-ADM-004).
 */
export interface PagoResponse {
  id: string
  alumnoId: string
  concepto: 'CUOTA_MENSUAL' | 'MATRICULA' | 'CERTIFICADO' | 'OTRO'
  monto: number
  moneda: string
  fechaPago: string
  metodo: 'EFECTIVO' | 'TRANSFERENCIA' | 'DEPOSITO' | 'OTRO'
  comprobante: string | null
  observaciones: string | null
  estado: 'REGISTRADO' | 'ANULADO'
  anuladoMotivo: string | null
  anuladoPorId: string | null
  anuladoAt: string | null
  createdAt: string
  updatedAt: string
}

/**
 * Listado paginado de pagos.
 */
export interface PaginatedPagosResponse {
  data: PagoResponse[]
  meta: {
    page: number
    pageSize: number
    total: number
  }
}

/**
 * Respuesta de estado de cuenta por alumno (RF-ADM-003).
 */
export interface EstadoCuentaResponse {
  alumnoId: string
  totalesPorConcepto: Array<{
    concepto: string
    totalPagado: number
    totalPendiente: number
    cantidad: number
  }>
  totalGeneralPagado: number
  totalGeneralPendiente: number
}