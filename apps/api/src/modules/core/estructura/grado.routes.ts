import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../../../core/auth/guards.js'
import { requirePermission } from '../../../core/rbac.js'
import {
  actualizarGradoController,
  crearGradoController,
  listarGradosController,
} from './grado.controller.js'

/**
 * Rutas de grados. Se registran bajo `/api/v1`.
 *
 * Todas exigen `core.estructura.gestionar` (RF-CORE-010).
 */
export async function gradoRoutes(app: FastifyInstance): Promise<void> {
  const preHandler = [
    requireAuth,
    requirePermission('core.estructura.gestionar'),
  ]

  app.get('/grados', { preHandler }, listarGradosController)
  app.post('/grados', { preHandler }, crearGradoController)
  app.patch('/grados/:id', { preHandler }, actualizarGradoController)
}
