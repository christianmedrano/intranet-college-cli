import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../../../core/auth/guards.js'
import { loginController, meController } from './auth.controller.js'

/**
 * Rutas de autenticación. Se registran bajo el prefijo `/api/v1`.
 */
export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post('/auth/login', loginController)

  app.get('/me', { preHandler: requireAuth }, meController)
}
