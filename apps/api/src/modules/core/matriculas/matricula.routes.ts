import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../../../core/auth/guards.js'
import { requirePermission } from '../../../core/rbac.js'
import {
  actualizarMatriculaController,
  crearMatriculaController,
  listarMatriculasController,
} from './matricula.controller.js'

/**
 * Rutas de matrículas. Se registran bajo `/api/v1`.
 *
 * Exigen `core.matriculas.gestionar`, que la matriz RBAC concede a SuperAdmin
 * y Director (RF-CORE-015).
 */
export async function matriculaRoutes(app: FastifyInstance): Promise<void> {
  const preHandler = [requireAuth, requirePermission('core.matriculas.gestionar')]

  app.get('/matriculas', { preHandler }, listarMatriculasController)
  app.post('/matriculas', { preHandler }, crearMatriculaController)
  app.patch('/matriculas/:id', { preHandler }, actualizarMatriculaController)
}
