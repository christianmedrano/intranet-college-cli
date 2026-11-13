import type { FastifyInstance } from 'fastify'
import { crearPagoHandler, listarPagosHandler, obtenerPagoHandler, anularPagoHandler, estadoCuentaHandler } from './pago.controller.js'

async function pagoRoutes(fastify: FastifyInstance) {
  // POST /api/v1/pagos - Registrar pago
  fastify.post(
    '/pagos',
    {
      schema: {
        body: {
          type: 'object',
          required: ['alumnoId', 'concepto', 'monto', 'moneda', 'fechaPago', 'metodo'],
          properties: {
            alumnoId: { type: 'string', format: 'uuid' },
            concepto: { type: 'string', enum: ['CUOTA_MENSUAL', 'MATRICULA', 'CERTIFICADO', 'OTRO'] },
            monto: { type: 'number', minimum: 0.01, maximum: 999999.99 },
            moneda: { type: 'string', enum: ['PEN'] },
            fechaPago: { type: 'string', format: 'date' },
            metodo: { type: 'string', enum: ['EFECTIVO', 'TRANSFERENCIA', 'DEPOSITO', 'OTRO'] },
            comprobante: { type: 'string', maxLength: 100 },
            observaciones: { type: 'string', maxLength: 500 },
          },
        },
        response: {
          201: { $ref: 'PagoResponse#' },
        },
        tags: ['Administrative - Pagos'],
        summary: 'Registrar un nuevo pago',
        security: [{ bearerAuth: [] }],
      },
    },
    crearPagoHandler,
  )

  // GET /api/v1/pagos - Listar pagos
  fastify.get(
    '/pagos',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            alumnoId: { type: 'string', format: 'uuid' },
            concepto: { type: 'string', enum: ['CUOTA_MENSUAL', 'MATRICULA', 'CERTIFICADO', 'OTRO'] },
            fechaDesde: { type: 'string', format: 'date' },
            fechaHasta: { type: 'string', format: 'date' },
            estado: { type: 'string', enum: ['REGISTRADO', 'ANULADO'] },
            metodo: { type: 'string', enum: ['EFECTIVO', 'TRANSFERENCIA', 'DEPOSITO', 'OTRO'] },
          },
        },
        response: {
          200: { $ref: 'PaginatedPagosResponse#' },
        },
        tags: ['Administrative - Pagos'],
        summary: 'Listar pagos con filtros y paginación',
        security: [{ bearerAuth: [] }],
      },
    },
    listarPagosHandler,
  )

  // GET /api/v1/pagos/:id - Obtener pago por ID
  fastify.get(
    '/pagos/:id',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: { $ref: 'PagoResponse#' },
        },
        tags: ['Administrative - Pagos'],
        summary: 'Obtener un pago por ID',
        security: [{ bearerAuth: [] }],
      },
    },
    obtenerPagoHandler,
  )

  // PATCH /api/v1/pagos/:id/anular - Anular un pago
  fastify.patch(
    '/pagos/:id/anular',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          required: ['motivo'],
          properties: {
            motivo: { type: 'string', minLength: 1, maxLength: 500 },
          },
        },
        response: {
          200: { $ref: 'PagoResponse#' },
        },
        tags: ['Administrative - Pagos'],
        summary: 'Anular un pago',
        security: [{ bearerAuth: [] }],
      },
    },
    anularPagoHandler,
  )

  // GET /api/v1/alumnos/:id/estado-cuenta - Estado de cuenta de alumno
  fastify.get(
    '/alumnos/:id/estado-cuenta',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              alumno: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  codigo: { type: 'string' },
                  nombres: { type: 'string' },
                  apellidos: { type: 'string' },
                },
              },
              totalesPorConcepto: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    concepto: { type: 'string' },
                    totalPagado: { type: 'number' },
                    totalPendiente: { type: 'number' },
                    cantidad: { type: 'integer' },
                  },
                },
              },
              totalGeneralPagado: { type: 'number' },
              totalGeneralPendiente: { type: 'number' },
            },
          },
        },
        tags: ['Administrative - Pagos'],
        summary: 'Obtener estado de cuenta de un alumno',
        security: [{ bearerAuth: [] }],
      },
    },
    estadoCuentaHandler,
  )
}

export default pagoRoutes