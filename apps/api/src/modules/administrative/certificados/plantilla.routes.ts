import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../../../core/auth/guards.js'
import {
  listarPlantillasHandler,
  obtenerPlantillaHandler,
  crearPlantillaHandler,
  actualizarPlantillaHandler,
  eliminarPlantillaHandler,
  previewPlantillaHandler,
} from './plantilla.controller.js'

async function plantillaRoutes(fastify: FastifyInstance) {
  const preHandler = [requireAuth]

  // GET /api/v1/plantillas-certificados - Listar plantillas
  fastify.get(
    '/plantillas-certificados',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            tipo: { type: 'string', enum: ['ESTUDIOS', 'MATRICULA', 'NO_ADEUDO', 'CONDUCTA', 'OTRO'] },
            estado: { type: 'string', enum: ['BORRADOR', 'SOLICITADO', 'APROBADO', 'RECHAZADO', 'EMITIDO', 'ANULADO'] },
          },
        },
        tags: ['Administrative - Certificados'],
        summary: 'Listar plantillas de certificados',
        security: [{ bearerAuth: [] }],
      },
      preHandler,
    },
    listarPlantillasHandler,
  )

  // GET /api/v1/plantillas-certificados/:id - Obtener plantilla por ID
  fastify.get(
    '/plantillas-certificados/:id',
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
        summary: 'Obtener una plantilla por ID',
        security: [{ bearerAuth: [] }],
      },
      preHandler,
    },
    obtenerPlantillaHandler,
  )

  // POST /api/v1/plantillas-certificados - Crear plantilla
  fastify.post(
    '/plantillas-certificados',
    {
      schema: {
        body: {
          type: 'object',
          required: ['tipo', 'nombre', 'contenido'],
          properties: {
            tipo: { type: 'string', enum: ['ESTUDIOS', 'MATRICULA', 'NO_ADEUDO', 'CONDUCTA', 'OTRO'] },
            nombre: { type: 'string', minLength: 1, maxLength: 100 },
            contenido: { type: 'string', minLength: 1 },
            activa: { type: 'boolean', default: true },
          },
        },
        tags: ['Administrative - Certificados'],
        summary: 'Crear una plantilla de certificado',
        security: [{ bearerAuth: [] }],
      },
      preHandler,
    },
    crearPlantillaHandler,
  )

  // PATCH /api/v1/plantillas-certificados/:id - Actualizar plantilla
  fastify.patch(
    '/plantillas-certificados/:id',
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
            nombre: { type: 'string', minLength: 1, maxLength: 100 },
            contenido: { type: 'string', minLength: 1 },
            activa: { type: 'boolean' },
          },
        },
        tags: ['Administrative - Certificados'],
        summary: 'Actualizar una plantilla de certificado',
        security: [{ bearerAuth: [] }],
      },
      preHandler,
    },
    actualizarPlantillaHandler,
  )

  // DELETE /api/v1/plantillas-certificados/:id - Eliminar plantilla
  fastify.delete(
    '/plantillas-certificados/:id',
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
          204: { type: 'null' },
        },
        tags: ['Administrative - Certificados'],
        summary: 'Eliminar una plantilla de certificado',
        security: [{ bearerAuth: [] }],
      },
      preHandler,
    },
    eliminarPlantillaHandler,
  )

  // POST /api/v1/plantillas-certificados/:id/preview - Preview de plantilla
  fastify.post(
    '/plantillas-certificados/:id/preview',
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
            variables: {
              type: 'object',
              additionalProperties: { type: 'string' },
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              plantilla: { type: 'object', additionalProperties: true },
              variablesFaltantes: { type: 'array', items: { type: 'string' } },
            },
          },
        },
        tags: ['Administrative - Certificados'],
        summary: 'Generar preview de plantilla con variables de prueba',
        security: [{ bearerAuth: [] }],
      },
      preHandler,
    },
    previewPlantillaHandler,
  )
}

export default plantillaRoutes