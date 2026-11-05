import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import Fastify, { type FastifyInstance } from 'fastify'
import { loadConfig } from './core/config.js'
import { registerErrorHandler } from './core/errors.js'
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
  await app.register(rateLimit, { max: 100, timeWindow: '1 minute' })
  await app.register(healthRoutes)

  return app
}
