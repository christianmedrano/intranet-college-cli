import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../../../core/auth/guards.js'
import { requirePermission } from '../../../core/rbac.js'
import {
  actualizarSeccionController,
  crearSeccionController,
  listarSeccionesController,
} from './seccion.controller.js'

/**
 * Rutas de secciones. Se registran bajo `/api/v1`.
 *
 * Todas exigen `core.estructura.gestionar` (RF-CORE-010).
 */
export async function seccionRoutes(app: FastifyInstance): Promise<void> {
  const preHandler = [
    requireAuth,
    requirePermission('core.estructura.gestionar'),
  ]

  app.get('/secciones', { preHandler }, listarSeccionesController)
  app.post('/secciones', { preHandler }, crearSeccionController)
  app.patch('/secciones/:id', { preHandler }, actualizarSeccionController)
}
