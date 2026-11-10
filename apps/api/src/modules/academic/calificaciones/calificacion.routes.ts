import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../../../core/auth/guards.js'
import { requireAnyPermission, requirePermission } from '../../../core/rbac.js'
import {
  actualizarCalificacionController,
  crearCalificacionController,
  listarCalificacionesController,
  resumenCalificacionesController,
} from './calificacion.controller.js'

/**
 * Rutas de calificaciones. Se registran bajo `/api/v1`.
 *
 * La consulta exige `academic.calificaciones.leer`; el alta, `gestionar`; la
 * edición admite `gestionar` con el período abierto o `corregir` con el período
 * cerrado, y el servicio decide cuál corresponde (RF-ACAD-001, RF-ACAD-003).
 */
export async function calificacionRoutes(
  app: FastifyInstance,
): Promise<void> {
  const lectura = [
    requireAuth,
    requirePermission('academic.calificaciones.leer'),
  ]
  const alta = [
    requireAuth,
    requirePermission('academic.calificaciones.gestionar'),
  ]
  const edicion = [
    requireAuth,
    requireAnyPermission([
      'academic.calificaciones.gestionar',
      'academic.calificaciones.corregir',
    ]),
  ]

  app.get(
    '/periodos/:periodoId/calificaciones',
    { preHandler: lectura },
    listarCalificacionesController,
  )

  app.get(
    '/periodos/:periodoId/calificaciones/resumen',
    { preHandler: lectura },
    resumenCalificacionesController,
  )

  app.post('/calificaciones', { preHandler: alta }, crearCalificacionController)

  app.patch(
    '/calificaciones/:id',
    { preHandler: edicion },
    actualizarCalificacionController,
  )
}
