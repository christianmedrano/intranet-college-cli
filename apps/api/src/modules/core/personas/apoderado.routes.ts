import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../../../core/auth/guards.js'
import { requirePermission } from '../../../core/rbac.js'
import {
  actualizarApoderadoController,
  crearApoderadoController,
  listarApoderadosController,
  vincularAlumnoController,
} from './apoderado.controller.js'

/**
 * Rutas de apoderados y sus vínculos con alumnos. Se registran bajo
 * `/api/v1`.
 *
 * Exigen `core.usuarios.gestionar` (RF-CORE-014).
 */
export async function apoderadoRoutes(app: FastifyInstance): Promise<void> {
  const preHandler = [requireAuth, requirePermission('core.usuarios.gestionar')]

  app.get('/apoderados', { preHandler }, listarApoderadosController)
  app.post('/apoderados', { preHandler }, crearApoderadoController)
  app.patch('/apoderados/:id', { preHandler }, actualizarApoderadoController)
  app.post(
    '/apoderados/:id/alumnos',
    { preHandler },
    vincularAlumnoController,
  )
}
