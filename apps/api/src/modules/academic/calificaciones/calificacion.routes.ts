import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../../../core/auth/guards.js'
import { requirePermission } from '../../../core/rbac.js'
import {
  listarCalificacionesController,
  resumenCalificacionesController,
} from './calificacion.controller.js'

/**
 * Rutas de consulta de calificaciones. Se registran bajo `/api/v1`.
 *
 * La consulta exige `academic.calificaciones.leer`; el alcance por vínculo se
 * resuelve en el servicio (RF-ACAD-003).
 */
export async function calificacionRoutes(
  app: FastifyInstance,
): Promise<void> {
  const preHandler = [
    requireAuth,
    requirePermission('academic.calificaciones.leer'),
  ]

  app.get(
    '/periodos/:periodoId/calificaciones',
    { preHandler },
    listarCalificacionesController,
  )

  app.get(
    '/periodos/:periodoId/calificaciones/resumen',
    { preHandler },
    resumenCalificacionesController,
  )
}
