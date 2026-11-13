import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../../../core/auth/guards.js'
import {
  listarCertificadosHandler,
  obtenerCertificadoHandler,
  obtenerCertificadoPorNumeroHandler,
  emitirCertificadoHandler,
  solicitarCertificadoHandler,
  aprobarCertificadoHandler,
  rechazarCertificadoHandler,
  anularCertificadoHandler,
  descargarCertificadoHandler,
} from './certificado.controller.js'

async function certificadoRoutes(fastify: FastifyInstance) {
  const preHandler = [requireAuth]

  // GET /api/v1/certificados - Listar certificados
  fastify.get(
    '/certificados',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            tipo: { type: 'string', enum: ['ESTUDIOS', 'MATRICULA', 'NO_ADEUDO', 'CONDUCTA', 'OTRO'] },
            alumnoId: { type: 'string', format: 'uuid' },
            anioId: { type: 'string', format: 'uuid' },
            estado: { type: 'string', enum: ['BORRADOR', 'SOLICITADO', 'APROBADO', 'RECHAZADO', 'EMITIDO', 'ANULADO'] },
          },
        },
        tags: ['Administrative - Certificados'],
        summary: 'Listar certificados con filtros y paginación',
        security: [{ bearerAuth: [] }],
      },
      preHandler,
    },
    listarCertificadosHandler,
  )

  // GET /api/v1/certificados/:id - Obtener certificado por ID
  fastify.get(
    '/certificados/:id',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        tags: ['Administrative - Certificados'],
        summary: 'Obtener un certificado por ID',
        security: [{ bearerAuth: [] }],
      },
      preHandler,
    },
    obtenerCertificadoHandler,
  )

  // GET /api/v1/certificados/numero/:numero - Obtener certificado por número
  fastify.get(
    '/certificados/numero/:numero',
    {
      schema: {
        params: {
          type: 'object',
          required: ['numero'],
          properties: {
            numero: { type: 'string', minLength: 1 },
          },
        },
        tags: ['Administrative - Certificados'],
        summary: 'Obtener un certificado por número',
        security: [{ bearerAuth: [] }],
      },
      preHandler,
    },
    obtenerCertificadoPorNumeroHandler,
  )

  // POST /api/v1/certificados - Emitir certificado (director/admin)
  fastify.post(
    '/certificados',
    {
      schema: {
        body: {
          type: 'object',
          required: ['tipo', 'alumnoId', 'anioId'],
          properties: {
            tipo: { type: 'string', enum: ['ESTUDIOS', 'MATRICULA', 'NO_ADEUDO', 'CONDUCTA', 'OTRO'] },
            alumnoId: { type: 'string', format: 'uuid' },
            anioId: { type: 'string', format: 'uuid' },
            plantillaId: { type: 'string', format: 'uuid' },
            variables: {
              type: 'object',
              additionalProperties: { type: 'string' },
            },
          },
        },
        tags: ['Administrative - Certificados'],
        summary: 'Emitir un certificado directamente',
        security: [{ bearerAuth: [] }],
      },
      preHandler,
    },
    emitirCertificadoHandler,
  )

  // POST /api/v1/certificados/solicitar - Solicitar certificado (apoderado/alumno)
  fastify.post(
    '/certificados/solicitar',
    {
      schema: {
        body: {
          type: 'object',
          required: ['tipo', 'alumnoId', 'anioId'],
          properties: {
            tipo: { type: 'string', enum: ['ESTUDIOS', 'MATRICULA', 'NO_ADEUDO', 'CONDUCTA', 'OTRO'] },
            alumnoId: { type: 'string', format: 'uuid' },
            anioId: { type: 'string', format: 'uuid' },
            plantillaId: { type: 'string', format: 'uuid' },
          },
        },
        tags: ['Administrative - Certificados'],
        summary: 'Solicitar un certificado',
        security: [{ bearerAuth: [] }],
      },
      preHandler,
    },
    solicitarCertificadoHandler,
  )

  // PATCH /api/v1/certificados/:id/aprobar - Aprobar certificado
  fastify.patch(
    '/certificados/:id/aprobar',
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
          properties: {
            plantillaId: { type: 'string', format: 'uuid' },
            variables: {
              type: 'object',
              additionalProperties: { type: 'string' },
            },
          },
        },
        tags: ['Administrative - Certificados'],
        summary: 'Aprobar un certificado solicitado',
        security: [{ bearerAuth: [] }],
      },
      preHandler,
    },
    aprobarCertificadoHandler,
  )

  // PATCH /api/v1/certificados/:id/rechazar - Rechazar certificado
  fastify.patch(
    '/certificados/:id/rechazar',
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
        tags: ['Administrative - Certificados'],
        summary: 'Rechazar un certificado solicitado',
        security: [{ bearerAuth: [] }],
      },
      preHandler,
    },
    rechazarCertificadoHandler,
  )

  // PATCH /api/v1/certificados/:id/anular - Anular certificado
  fastify.patch(
    '/certificados/:id/anular',
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
        tags: ['Administrative - Certificados'],
        summary: 'Anular un certificado',
        security: [{ bearerAuth: [] }],
      },
      preHandler,
    },
    anularCertificadoHandler,
  )

  // GET /api/v1/certificados/:id/download - Descargar certificado
  fastify.get(
    '/certificados/:id/download',
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
              message: { type: 'string' },
              certificado: { type: 'object', additionalProperties: true },
              downloadUrl: { type: 'string' },
            },
          },
        },
        tags: ['Administrative - Certificados'],
        summary: 'Descargar certificado en PDF',
        security: [{ bearerAuth: [] }],
      },
      preHandler,
    },
    descargarCertificadoHandler,
  )
}

export default certificadoRoutes