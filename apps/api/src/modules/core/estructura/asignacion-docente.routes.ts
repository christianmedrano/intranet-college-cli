import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../../../core/auth/guards.js'
import { requirePermission } from '../../../core/rbac.js'
import {
  actualizarAsignacionDocenteController,
  crearAsignacionDocenteController,
  listarAsignacionesDocenteController,
} from './asignacion-docente.controller.js'

/**
 * Rutas de asignaciones docente–curso–sección–año. Se registran bajo
 * `/api/v1`.
 *
 * Todas exigen `core.estructura.gestionar` (RF-CORE-011).
 */
export async function asignacionDocenteRoutes(
  app: FastifyInstance,
): Promise<void> {
  const preHandler = [
    requireAuth,
    requirePermission('core.estructura.gestionar'),
  ]

  app.get(
    '/asignaciones-docente',
    { preHandler },
    listarAsignacionesDocenteController,
  )
  app.post(
    '/asignaciones-docente',
    { preHandler },
    crearAsignacionDocenteController,
  )
  app.patch(
    '/asignaciones-docente/:id',
    { preHandler },
    actualizarAsignacionDocenteController,
  )
}
