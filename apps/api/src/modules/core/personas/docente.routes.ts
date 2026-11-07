import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../../../core/auth/guards.js'
import { requirePermission } from '../../../core/rbac.js'
import {
  actualizarDocenteController,
  crearDocenteController,
  listarDocentesController,
} from './docente.controller.js'

/**
 * Rutas de docentes. Se registran bajo `/api/v1`.
 *
 * Exigen `core.usuarios.gestionar` (RF-CORE-013).
 */
export async function docenteRoutes(app: FastifyInstance): Promise<void> {
  const preHandler = [requireAuth, requirePermission('core.usuarios.gestionar')]

  app.get('/docentes', { preHandler }, listarDocentesController)
  app.post('/docentes', { preHandler }, crearDocenteController)
  app.patch('/docentes/:id', { preHandler }, actualizarDocenteController)
}
