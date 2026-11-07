import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../../../core/auth/guards.js'
import { requirePermission } from '../../../core/rbac.js'
import {
  actualizarPeriodoController,
  cerrarPeriodoController,
  crearPeriodoController,
  listarPeriodosController,
} from './periodo-academico.controller.js'

/**
 * Rutas de períodos académicos. Se registran bajo `/api/v1`.
 *
 * La spec §7 agrupa `GET`, `POST` y `PATCH` bajo
 * `/anios-academicos/:id/periodos`; la edición y el cierre se exponen sobre
 * `/periodos/:id`, el mismo espacio que usa `POST /periodos/:id/cerrar`.
 * Todas exigen `core.estructura.gestionar` (RF-CORE-009).
 */
export async function periodoAcademicoRoutes(
  app: FastifyInstance,
): Promise<void> {
  const preHandler = [
    requireAuth,
    requirePermission('core.estructura.gestionar'),
  ]

  app.get(
    '/anios-academicos/:id/periodos',
    { preHandler },
    listarPeriodosController,
  )
  app.post(
    '/anios-academicos/:id/periodos',
    { preHandler },
    crearPeriodoController,
  )
  app.patch('/periodos/:id', { preHandler }, actualizarPeriodoController)
  app.post('/periodos/:id/cerrar', { preHandler }, cerrarPeriodoController)
}
