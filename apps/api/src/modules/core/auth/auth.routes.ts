import type { FastifyInstance } from 'fastify'
import { loginController } from './auth.controller.js'

/**
 * Rutas de autenticación. Se registran bajo el prefijo `/api/v1`.
 */
export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post('/auth/login', loginController)
}
