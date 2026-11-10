import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../../../core/auth/guards.js'
import { requirePermission } from '../../../core/rbac.js'
import {
  corregirAsistenciaController,
  listarAsistenciasController,
} from './asistencia.controller.js'

/**
 * Rutas de asistencia. Se registran bajo `/api/v1`.
 *
 * La consulta exige `academic.asistencias.leer`; la corrección,
 * `academic.asistencias.gestionar`; el alcance por vínculo se resuelve en el
 * servicio (RF-ACAD-005, RF-ACAD-007).
 */
export async function asistenciaRoutes(app: FastifyInstance): Promise<void> {
  const lectura = [
    requireAuth,
    requirePermission('academic.asistencias.leer'),
  ]
  const gestion = [
    requireAuth,
    requirePermission('academic.asistencias.gestionar'),
  ]

  app.get('/asistencias', { preHandler: lectura }, listarAsistenciasController)

  app.patch(
    '/asistencias/:id',
    { preHandler: gestion },
    corregirAsistenciaController,
  )
}
