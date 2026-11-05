import type { FastifyInstance } from 'fastify'

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/v1/health', async () => ({
    status: 'ok',
    service: 'intranet-api',
    timestamp: new Date().toISOString(),
  }))
}
