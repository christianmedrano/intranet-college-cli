import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../../../core/auth/guards.js'
import { requirePermission } from '../../../core/rbac.js'
import { listarAlertasController } from './alerta.controller.js'

/**
 * Rutas de alertas de inasistencias. Se registran bajo `/api/v1`.
 *
 * La consulta exige `academic.asistencias.leer`; el alcance por vínculo se
 * resuelve en el servicio (RF-ACAD-009).
 */
export async function alertaRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/alertas-asistencia',
    {
      preHandler: [
        requireAuth,
        requirePermission('academic.asistencias.leer'),
      ],
    },
    listarAlertasController,
  )
}
