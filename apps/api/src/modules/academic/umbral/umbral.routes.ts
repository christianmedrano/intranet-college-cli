import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../../../core/auth/guards.js'
import { requirePermission } from '../../../core/rbac.js'
import {
  guardarUmbralController,
  obtenerUmbralController,
} from './umbral.controller.js'

/**
 * Rutas del umbral de inasistencias. Se registran bajo `/api/v1`.
 *
 * Reutiliza `core.estructura.gestionar` (SuperAdmin y Director) para no ampliar
 * la matriz RBAC con una acción inexistente (RF-ACAD-008).
 */
export async function umbralRoutes(app: FastifyInstance): Promise<void> {
  const gestionar = [
    requireAuth,
    requirePermission('core.estructura.gestionar'),
  ]

  app.get(
    '/anios-academicos/:id/umbral-asistencia',
    { preHandler: gestionar },
    obtenerUmbralController,
  )

  app.put(
    '/anios-academicos/:id/umbral-asistencia',
    { preHandler: gestionar },
    guardarUmbralController,
  )
}
