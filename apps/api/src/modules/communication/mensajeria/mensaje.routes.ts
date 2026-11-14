import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../../../core/auth/guards.js'
import { requireAnyPermission, requirePermission } from '../../../core/rbac.js'
import {
  archivarMensajeController,
  enviarMensajeController,
  listarMensajesController,
} from './mensaje.controller.js'

/**
 * Rutas de mensajería. Se registran bajo `/api/v1`.
 *
 * La escritura exige `communication.mensajeria.gestionar`; la lectura admite
 * `gestionar` (tutor/apoderado) o `supervisar` (Director/SuperAdmin). El alcance
 * por vínculo se resuelve en el servicio (RF-COM-004, RF-COM-005).
 */
export async function mensajeRoutes(app: FastifyInstance): Promise<void> {
  const gestionar = [
    requireAuth,
    requirePermission('communication.mensajeria.gestionar'),
  ]

  const leer = [
    requireAuth,
    requireAnyPermission([
      'communication.mensajeria.gestionar',
      'communication.mensajeria.supervisar',
    ]),
  ]

  app.post('/secciones/:id/mensajes', { preHandler: gestionar }, enviarMensajeController)

  app.get('/secciones/:id/mensajes', { preHandler: leer }, listarMensajesController)

  app.delete('/mensajes/:id', { preHandler: gestionar }, archivarMensajeController)
}