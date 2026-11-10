import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../../../core/auth/guards.js'
import { requirePermission } from '../../../core/rbac.js'
import { listarNotasFinalesController } from './nota-final.controller.js'

/**
 * Rutas de consulta de notas finales. Se registran bajo `/api/v1`.
 *
 * La consulta exige `academic.calificaciones.leer`; el alcance por vínculo se
 * resuelve en el servicio (RF-ACAD-003).
 */
export async function notaFinalRoutes(app: FastifyInstance): Promise<void> {
  const preHandler = [
    requireAuth,
    requirePermission('academic.calificaciones.leer'),
  ]

  app.get(
    '/periodos/:periodoId/notas-finales',
    { preHandler },
    listarNotasFinalesController,
  )
}
