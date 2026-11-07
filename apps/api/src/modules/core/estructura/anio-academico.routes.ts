import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../../../core/auth/guards.js'
import { requirePermission } from '../../../core/rbac.js'
import {
  activarAnioController,
  actualizarAnioController,
  crearAnioController,
  listarAniosController,
} from './anio-academico.controller.js'

/**
 * Rutas de años académicos. Se registran bajo `/api/v1`.
 *
 * Todas exigen `core.estructura.gestionar`, que la matriz RBAC solo concede a
 * SuperAdmin y Director (RF-CORE-008).
 */
export async function anioAcademicoRoutes(
  app: FastifyInstance,
): Promise<void> {
  const preHandler = [requireAuth, requirePermission('core.estructura.gestionar')]

  app.get('/anios-academicos', { preHandler }, listarAniosController)
  app.post('/anios-academicos', { preHandler }, crearAnioController)
  app.patch('/anios-academicos/:id', { preHandler }, actualizarAnioController)
  app.post(
    '/anios-academicos/:id/activar',
    { preHandler },
    activarAnioController,
  )
}
