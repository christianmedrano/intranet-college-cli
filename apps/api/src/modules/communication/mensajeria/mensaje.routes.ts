import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../../../core/auth/guards.js'
import { requirePermission } from '../../../core/rbac.js'
import {
  archivarMensajeController,
  enviarMensajeController,
  listarMensajesController,
} from './mensaje.controller.js'

/**
 * Rutas de mensajería. Se registran bajo `/api/v1`.
 *
 * Escritura y lectura exigen `communication.mensajeria.gestionar`;
 * el alcance por vínculo se resuelve en el servicio (RF-COM-004, RF-COM-005).
 */
export async function mensajeRoutes(app: FastifyInstance): Promise<void> {
  const gestionar = [
    requireAuth,
    requirePermission('communication.mensajeria.gestionar'),
  ]

  app.post('/secciones/:id/mensajes', { preHandler: gestionar }, enviarMensajeController)

  app.get('/secciones/:id/mensajes', { preHandler: gestionar }, listarMensajesController)

  app.delete('/mensajes/:id', { preHandler: gestionar }, archivarMensajeController)
}