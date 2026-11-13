import { z } from 'zod'
import { paginationSchema, uuidSchema } from '../base.js'

/** Conceptos de pago permitidos (RF-ADM-001, RN-ADM-003). */
export const conceptoPagoSchema = z.enum([
  'CUOTA_MENSUAL',
  'MATRICULA',
  'CERTIFICADO',
  'OTRO',
])

export type ConceptoPago = z.infer<typeof conceptoPagoSchema>

/** Métodos de pago permitidos (RF-ADM-001, RN-ADM-004). */
export const metodoPagoSchema = z.enum([
  'EFECTIVO',
  'TRANSFERENCIA',
  'DEPOSITO',
  'OTRO',
])

export type MetodoPago = z.infer<typeof metodoPagoSchema>

/** Estados de un pago (RF-ADM-001, RN-ADM-002). */
export const estadoPagoSchema = z.enum(['REGISTRADO', 'ANULADO'])

export type EstadoPago = z.infer<typeof estadoPagoSchema>

/** Validación de monto en PEN (RN-ADM-001). */
const montoPagoSchema = z
  .number()
  .positive('El monto debe ser mayor a 0')
  .max(999999.99, 'El monto supera el máximo permitido')
  .refine((val) => Number(val.toFixed(2)) === val, {
    message: 'El monto debe tener máximo 2 decimales',
  })

/** Fecha de pago en ISO 8601 UTC (no futura). */
const fechaPagoSchema = z.iso.datetime().refine((val) => {
  const fecha = new Date(val)
  const hoy = new Date()
  hoy.setHours(23, 59, 59, 999)
  return fecha <= hoy
}, { message: 'La fecha de pago no puede ser futura' })

/**
 * Creación de un pago (RF-ADM-001).
 *
 * Requiere alumno, concepto, monto, fecha, método.
 * Validaciones: monto > 0, fecha no futura, concepto válido.
 */
export const crearPagoSchema = z.object({
  alumnoId: uuidSchema,
  concepto: conceptoPagoSchema,
  monto: montoPagoSchema,
  moneda: z.literal('PEN'),
  fechaPago: fechaPagoSchema,
  metodo: metodoPagoSchema,
  comprobante: z.string().max(100).optional(),
  observaciones: z.string().max(500).optional(),
})

export type CrearPagoInput = z.infer<typeof crearPagoSchema>

/**
 * Anulación de un pago (RF-ADM-002, RN-ADM-002).
 *
 * Requiere motivo obligatorio. El pago debe estar REGISTRADO.
 */
export const anularPagoSchema = z.object({
  motivo: z.string().min(1, 'El motivo es obligatorio').max(500, 'El motivo es demasiado largo'),
})

export type AnularPagoInput = z.infer<typeof anularPagoSchema>

/**
 * Filtros para listado de pagos (RF-ADM-004).
 */
export const listarPagosQuerySchema = paginationSchema.extend({
  alumnoId: uuidSchema.optional(),
  concepto: conceptoPagoSchema.optional(),
  fechaDesde: z.iso.date().optional(),
  fechaHasta: z.iso.date().optional(),
  estado: estadoPagoSchema.optional(),
  metodo: metodoPagoSchema.optional(),
})

export type ListarPagosQuery = z.infer<typeof listarPagosQuerySchema>

/**
 * Respuesta de un pago (RF-ADM-001 a RF-ADM-004).
 */
export const pagoResponseSchema = z.object({
  id: uuidSchema,
  alumnoId: uuidSchema,
  concepto: conceptoPagoSchema,
  monto: z.number(),
  moneda: z.string(),
  fechaPago: z.string(),
  metodo: metodoPagoSchema,
  comprobante: z.string().nullable(),
  observaciones: z.string().nullable(),
  estado: estadoPagoSchema,
  anuladoMotivo: z.string().nullable(),
  anuladoPorId: uuidSchema.nullable(),
  anuladoAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type PagoResponsePayload = z.infer<typeof pagoResponseSchema>

/**
 * Listado paginado de pagos.
 */
export const paginatedPagosSchema = z.object({
  data: z.array(pagoResponseSchema),
  meta: paginationSchema.extend({ total: z.number().int().min(0) }).omit({ pageSize: true, page: true }).extend({
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1),
    total: z.number().int().min(0),
  }),
})

export type PaginatedPagosPayload = z.infer<typeof paginatedPagosSchema>

/**
 * Respuesta de estado de cuenta por alumno (RF-ADM-003).
 */
export const estadoCuentaResponseSchema = z.object({
  alumnoId: uuidSchema,
  totalesPorConcepto: z.array(z.object({
    concepto: z.string(),
    totalPagado: z.number(),
    totalPendiente: z.number(),
    cantidad: z.number().int(),
  })),
  totalGeneralPagado: z.number(),
  totalGeneralPendiente: z.number(),
})

export type EstadoCuentaResponsePayload = z.infer<typeof estadoCuentaResponseSchema>