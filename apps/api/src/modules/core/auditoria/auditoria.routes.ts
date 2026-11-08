import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../../../core/auth/guards.js'
import { requirePermission } from '../../../core/rbac.js'
import { listarAuditoriaController } from './auditoria.controller.js'

/**
 * Rutas de auditoría. Se registran bajo `/api/v1`.
 *
 * Solo expone `GET`: la auditoría es de solo inserción (RN-CORE-012) y no se
 * edita ni se elimina desde la API (RF-CORE-016).
 */
export async function auditoriaRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/auditoria',
    { preHandler: [requireAuth, requirePermission('core.auditoria.leer')] },
    listarAuditoriaController,
  )
}
