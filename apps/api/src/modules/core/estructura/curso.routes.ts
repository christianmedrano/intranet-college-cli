import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../../../core/auth/guards.js'
import { requirePermission } from '../../../core/rbac.js'
import {
  actualizarCursoController,
  crearCursoController,
  listarCursosController,
} from './curso.controller.js'

/**
 * Rutas de cursos. Se registran bajo `/api/v1`.
 *
 * Todas exigen `core.estructura.gestionar` (RF-CORE-011).
 */
export async function cursoRoutes(app: FastifyInstance): Promise<void> {
  const preHandler = [
    requireAuth,
    requirePermission('core.estructura.gestionar'),
  ]

  app.get('/cursos', { preHandler }, listarCursosController)
  app.post('/cursos', { preHandler }, crearCursoController)
  app.patch('/cursos/:id', { preHandler }, actualizarCursoController)
}
