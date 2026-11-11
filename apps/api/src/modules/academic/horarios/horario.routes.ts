import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../../../core/auth/guards.js'
import { requirePermission } from '../../../core/rbac.js'
import {
  actualizarHorarioController,
  crearHorarioController,
  eliminarHorarioController,
  listarHorariosController,
} from './horario.controller.js'

/**
 * Rutas de horarios. Se registran bajo `/api/v1`.
 *
 * Consultar exige `academic.horarios.leer`; crear, editar y eliminar exigen
 * `academic.horarios.gestionar`. El alcance por vínculo se resuelve en el
 * servicio (RF-ACAD-010, RF-ACAD-011).
 */
export async function horarioRoutes(app: FastifyInstance): Promise<void> {
  const gestionar = [
    requireAuth,
    requirePermission('academic.horarios.gestionar'),
  ]

  app.get(
    '/horarios',
    {
      preHandler: [
        requireAuth,
        requirePermission('academic.horarios.leer'),
      ],
    },
    listarHorariosController,
  )

  app.post(
    '/horarios',
    { preHandler: gestionar },
    crearHorarioController,
  )

  app.patch(
    '/horarios/:id',
    { preHandler: gestionar },
    actualizarHorarioController,
  )

  app.delete(
    '/horarios/:id',
    { preHandler: gestionar },
    eliminarHorarioController,
  )
}
