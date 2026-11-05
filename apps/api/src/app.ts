import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import Fastify, { type FastifyInstance } from 'fastify'
import { loadConfig } from './core/config.js'
import { healthRoutes } from './routes/health.js'

export async function buildApp(): Promise<FastifyInstance> {
  const config = loadConfig()

  const app = Fastify({
    logger: config.NODE_ENV !== 'test',
  })

  await app.register(cors, { origin: config.CORS_ORIGIN })
  await app.register(rateLimit, { max: 100, timeWindow: '1 minute' })
  await app.register(healthRoutes)

  return app
}
