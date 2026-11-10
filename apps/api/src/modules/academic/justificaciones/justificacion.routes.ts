import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../../../core/auth/guards.js'
import { requirePermission } from '../../../core/rbac.js'
import {
  aprobarJustificacionController,
  listarJustificacionesController,
  rechazarJustificacionController,
  solicitarJustificacionController,
} from './justificacion.controller.js'

/**
 * Rutas de justificaciones. Se registran bajo `/api/v1`.
 *
 * Solicitar exige `academic.asistencias.solicitar`; aprobar y rechazar,
 * `academic.asistencias.justificar`; consultar, `academic.asistencias.leer`. El
 * alcance por vínculo se resuelve en el servicio (RF-ACAD-006, RF-ACAD-007).
 */
export async function justificacionRoutes(
  app: FastifyInstance,
): Promise<void> {
  const solicitar = [
    requireAuth,
    requirePermission('academic.asistencias.solicitar'),
  ]
  const justificar = [
    requireAuth,
    requirePermission('academic.asistencias.justificar'),
  ]
  const lectura = [
    requireAuth,
    requirePermission('academic.asistencias.leer'),
  ]

  app.post(
    '/asistencias/:id/justificaciones',
    { preHandler: solicitar },
    solicitarJustificacionController,
  )

  app.get(
    '/justificaciones',
    { preHandler: lectura },
    listarJustificacionesController,
  )

  app.post(
    '/justificaciones/:id/aprobar',
    { preHandler: justificar },
    aprobarJustificacionController,
  )

  app.post(
    '/justificaciones/:id/rechazar',
    { preHandler: justificar },
    rechazarJustificacionController,
  )
}
