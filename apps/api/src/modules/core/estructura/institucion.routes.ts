import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../../../core/auth/guards.js'
import { requirePermission } from '../../../core/rbac.js'
import {
  getInstitucionController,
  updateInstitucionController,
} from './institucion.controller.js'

/**
 * Rutas de configuración institucional. Se registran bajo `/api/v1`.
 *
 * Consultar y editar comparten el permiso `core.institucion.editar`, tal como
 * fija la spec §7. Docentes, apoderados y alumnos reciben `403` (RF-CORE-001).
 */
export async function institucionRoutes(app: FastifyInstance): Promise<void> {
  const preHandler = [
    requireAuth,
    requirePermission('core.institucion.editar'),
  ]

  app.get('/institucion', { preHandler }, getInstitucionController)
  app.patch('/institucion', { preHandler }, updateInstitucionController)
}
