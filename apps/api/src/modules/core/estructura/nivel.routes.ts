import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../../../core/auth/guards.js'
import { requirePermission } from '../../../core/rbac.js'
import {
  actualizarNivelController,
  crearNivelController,
  listarNivelesController,
} from './nivel.controller.js'

/**
 * Rutas de niveles educativos. Se registran bajo `/api/v1`.
 *
 * Todas exigen `core.estructura.gestionar`, que la matriz RBAC solo concede a
 * SuperAdmin y Director (RF-CORE-010).
 */
export async function nivelRoutes(app: FastifyInstance): Promise<void> {
  const preHandler = [
    requireAuth,
    requirePermission('core.estructura.gestionar'),
  ]

  app.get('/niveles', { preHandler }, listarNivelesController)
  app.post('/niveles', { preHandler }, crearNivelController)
  app.patch('/niveles/:id', { preHandler }, actualizarNivelController)
}
