import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../../../core/auth/guards.js'
import { requirePermission } from '../../../core/rbac.js'
import {
  changePasswordController,
  forgotPasswordController,
  issueRecoveryTokenController,
  loginController,
  logoutController,
  meController,
  refreshController,
  resetPasswordController,
} from './auth.controller.js'

/**
 * Rutas de autenticación. Se registran bajo el prefijo `/api/v1`.
 */
export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post('/auth/login', loginController)
  app.post('/auth/refresh', refreshController)
  app.post('/auth/logout', { preHandler: requireAuth }, logoutController)

  app.post('/auth/forgot-password', forgotPasswordController)
  app.post('/auth/reset-password', resetPasswordController)
  app.post(
    '/auth/change-password',
    { preHandler: requireAuth },
    changePasswordController,
  )

  app.post(
    '/usuarios/:id/token-recuperacion',
    {
      preHandler: [requireAuth, requirePermission('core.usuarios.gestionar')],
    },
    issueRecoveryTokenController,
  )

  app.get('/me', { preHandler: requireAuth }, meController)
}
