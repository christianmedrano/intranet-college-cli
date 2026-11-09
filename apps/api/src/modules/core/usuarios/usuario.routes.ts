import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../../../core/auth/guards.js'
import { requirePermission } from '../../../core/rbac.js'
import {
  actualizarUsuarioController,
  crearUsuarioController,
  listarUsuariosController,
} from './usuario.controller.js'

/**
 * Rutas de cuentas de usuario (RF-CORE-002). Se registran bajo `/api/v1`.
 *
 * Exigen `core.usuarios.gestionar`; el servicio aplica el alcance adicional del
 * Director: solo Docente, Apoderado y Alumno.
 */
export async function usuarioRoutes(app: FastifyInstance): Promise<void> {
  const preHandler = [requireAuth, requirePermission('core.usuarios.gestionar')]

  app.get('/usuarios', { preHandler }, listarUsuariosController)
  app.post('/usuarios', { preHandler }, crearUsuarioController)
  app.patch('/usuarios/:id', { preHandler }, actualizarUsuarioController)
}
