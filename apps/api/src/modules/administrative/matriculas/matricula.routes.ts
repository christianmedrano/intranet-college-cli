import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../../../core/auth/guards.js'
import {
  solicitarMatriculaHandler,
  listarMatriculasHandler,
  obtenerMatriculaHandler,
  aprobarMatriculaHandler,
  rechazarMatriculaHandler,
  retirarMatriculaHandler,
  anularMatriculaHandler,
} from './matricula.controller.js'

async function matriculaRoutes(fastify: FastifyInstance) {
  const preHandler = [requireAuth]

  // POST /api/v1/matriculas - Solicitar matrícula (apoderado)
  fastify.post(
    '/matriculas',
    {
      schema: {
        body: {
          type: 'object',
          required: ['alumnoId', 'seccionId', 'anioId'],
          properties: {
            alumnoId: { type: 'string', format: 'uuid' },
            seccionId: { type: 'string', format: 'uuid' },
            anioId: { type: 'string', format: 'uuid' },
            documentos: {
              type: 'array',
              items: {
                type: 'object',
                required: ['tipo', 'archivoNombre', 'archivoRuta'],
                properties: {
                  tipo: { type: 'string', minLength: 1 },
                  archivoNombre: { type: 'string', minLength: 1 },
                  archivoRuta: { type: 'string', minLength: 1 },
                },
              },
            },
          },
        },
        tags: ['Administrative - Matrículas'],
        summary: 'Solicitar una nueva matrícula',
        security: [{ bearerAuth: [] }],
      },
      preHandler,
    },
    solicitarMatriculaHandler,
  )

  // GET /api/v1/matriculas - Listar matrículas
  fastify.get(
    '/matriculas',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            anioId: { type: 'string', format: 'uuid' },
            nivelId: { type: 'string', format: 'uuid' },
            gradoId: { type: 'string', format: 'uuid' },
            seccionId: { type: 'string', format: 'uuid' },
            estado: { type: 'string', enum: ['SOLICITADA', 'APROBADA', 'RECHAZADA', 'RETIRADA', 'ANULADA'] },
            alumnoId: { type: 'string', format: 'uuid' },
          },
        },
        tags: ['Administrative - Matrículas'],
        summary: 'Listar matrículas con filtros y paginación',
        security: [{ bearerAuth: [] }],
      },
      preHandler,
    },
    listarMatriculasHandler,
  )

  // GET /api/v1/matriculas/:id - Obtener matrícula por ID
  fastify.get(
    '/matriculas/:id',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        tags: ['Administrative - Matrículas'],
        summary: 'Obtener una matrícula por ID',
        security: [{ bearerAuth: [] }],
      },
      preHandler,
    },
    obtenerMatriculaHandler,
  )

  // PATCH /api/v1/matriculas/:id/aprobar - Aprobar matrícula
  fastify.patch(
    '/matriculas/:id/aprobar',
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
            observaciones: { type: 'string', maxLength: 500 },
          },
        },
        tags: ['Administrative - Matrículas'],
        summary: 'Aprobar una matrícula',
        security: [{ bearerAuth: [] }],
      },
      preHandler,
    },
    aprobarMatriculaHandler,
  )

  // PATCH /api/v1/matriculas/:id/rechazar - Rechazar matrícula
  fastify.patch(
    '/matriculas/:id/rechazar',
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
        tags: ['Administrative - Matrículas'],
        summary: 'Rechazar una matrícula',
        security: [{ bearerAuth: [] }],
      },
      preHandler,
    },
    rechazarMatriculaHandler,
  )

  // PATCH /api/v1/matriculas/:id/retirar - Retirar matrícula
  fastify.patch(
    '/matriculas/:id/retirar',
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
        tags: ['Administrative - Matrículas'],
        summary: 'Retirar una matrícula aprobada',
        security: [{ bearerAuth: [] }],
      },
      preHandler,
    },
    retirarMatriculaHandler,
  )

  // PATCH /api/v1/matriculas/:id/anular - Anular matrícula
  fastify.patch(
    '/matriculas/:id/anular',
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
        tags: ['Administrative - Matrículas'],
        summary: 'Anular una matrícula',
        security: [{ bearerAuth: [] }],
      },
      preHandler,
    },
    anularMatriculaHandler,
  )
}

export default matriculaRoutes