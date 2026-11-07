import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../../../core/auth/guards.js'
import { requirePermission } from '../../../core/rbac.js'
import {
  actualizarAlumnoController,
  crearAlumnoController,
  listarAlumnosController,
} from './alumno.controller.js'

/**
 * Rutas de alumnos. Se registran bajo `/api/v1`.
 *
 * Exigen `core.usuarios.gestionar`, que la matriz RBAC concede a SuperAdmin y
 * Director (RF-CORE-012).
 */
export async function alumnoRoutes(app: FastifyInstance): Promise<void> {
  const preHandler = [requireAuth, requirePermission('core.usuarios.gestionar')]

  app.get('/alumnos', { preHandler }, listarAlumnosController)
  app.post('/alumnos', { preHandler }, crearAlumnoController)
  app.patch('/alumnos/:id', { preHandler }, actualizarAlumnoController)
}
