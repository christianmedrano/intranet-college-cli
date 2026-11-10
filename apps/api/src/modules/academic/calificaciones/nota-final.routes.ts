import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../../../core/auth/guards.js'
import { requireAnyPermission, requirePermission } from '../../../core/rbac.js'
import {
  actualizarNotaFinalController,
  crearNotaFinalController,
  listarNotasFinalesController,
} from './nota-final.controller.js'

/**
 * Rutas de notas finales. Se registran bajo `/api/v1`.
 *
 * La consulta exige `academic.calificaciones.leer`; el alta, `gestionar`; la
 * edición admite `gestionar` con el período abierto o `corregir` con el período
 * cerrado, y el servicio decide cuál corresponde (RF-ACAD-002, RF-ACAD-003).
 */
export async function notaFinalRoutes(app: FastifyInstance): Promise<void> {
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
    '/periodos/:periodoId/notas-finales',
    { preHandler: lectura },
    listarNotasFinalesController,
  )

  app.post('/notas-finales', { preHandler: alta }, crearNotaFinalController)

  app.patch(
    '/notas-finales/:id',
    { preHandler: edicion },
    actualizarNotaFinalController,
  )
}
