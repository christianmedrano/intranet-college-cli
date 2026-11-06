import cookie from '@fastify/cookie'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import Fastify, { type FastifyInstance } from 'fastify'
import { loadConfig } from './core/config.js'
import { AppError, registerErrorHandler } from './core/errors.js'
import { authRoutes } from './modules/core/auth/auth.routes.js'
import { healthRoutes } from './routes/health.js'

export async function buildApp(): Promise<FastifyInstance> {
  const config = loadConfig()

  const app = Fastify({
    logger:
      config.NODE_ENV === 'test'
        ? false
        : {
            redact: {
              paths: [
                'req.headers.authorization',
                'req.headers.cookie',
                'res.headers["set-cookie"]',
                '*.password',
                '*.passwordHash',
                '*.token',
                '*.tokenHash',
                '*.refreshToken',
                '*.accessToken',
              ],
              censor: '[REDACTADO]',
            },
          },
  })

  registerErrorHandler(app)

  await app.register(cors, { origin: config.CORS_ORIGIN })
  await app.register(cookie)
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    // Mantiene el sobre de error estándar también en los 429 del plugin.
    errorResponseBuilder: () => new AppError('RATE_LIMITED'),
  })
  await app.register(healthRoutes)
  await app.register(authRoutes, { prefix: '/api/v1' })

  return app
}
