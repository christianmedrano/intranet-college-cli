import cookie from '@fastify/cookie'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import Fastify, { type FastifyInstance } from 'fastify'
import { loadConfig } from './core/config.js'
import { AppError, registerErrorHandler } from './core/errors.js'
import { authRoutes } from './modules/core/auth/auth.routes.js'
import { anioAcademicoRoutes } from './modules/core/estructura/anio-academico.routes.js'
import { asignacionDocenteRoutes } from './modules/core/estructura/asignacion-docente.routes.js'
import { cursoRoutes } from './modules/core/estructura/curso.routes.js'
import { gradoRoutes } from './modules/core/estructura/grado.routes.js'
import { institucionRoutes } from './modules/core/estructura/institucion.routes.js'
import { nivelRoutes } from './modules/core/estructura/nivel.routes.js'
import { periodoAcademicoRoutes } from './modules/core/estructura/periodo-academico.routes.js'
import { seccionRoutes } from './modules/core/estructura/seccion.routes.js'
import { matriculaRoutes } from './modules/core/matriculas/matricula.routes.js'
import { alumnoRoutes } from './modules/core/personas/alumno.routes.js'
import { apoderadoRoutes } from './modules/core/personas/apoderado.routes.js'
import { docenteRoutes } from './modules/core/personas/docente.routes.js'
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
    // En pruebas la suite completa supera las 100 peticiones por minuto desde
    // la misma IP. El throttle específico de login (RF-CORE-004) se mantiene y
    // se prueba por separado.
    max: config.NODE_ENV === 'test' ? 10_000 : 100,
    timeWindow: '1 minute',
    // Mantiene el sobre de error estándar también en los 429 del plugin.
    errorResponseBuilder: () => new AppError('RATE_LIMITED'),
  })
  await app.register(healthRoutes)
  await app.register(authRoutes, { prefix: '/api/v1' })
  await app.register(institucionRoutes, { prefix: '/api/v1' })
  await app.register(anioAcademicoRoutes, { prefix: '/api/v1' })
  await app.register(asignacionDocenteRoutes, { prefix: '/api/v1' })
  await app.register(periodoAcademicoRoutes, { prefix: '/api/v1' })
  await app.register(nivelRoutes, { prefix: '/api/v1' })
  await app.register(gradoRoutes, { prefix: '/api/v1' })
  await app.register(seccionRoutes, { prefix: '/api/v1' })
  await app.register(cursoRoutes, { prefix: '/api/v1' })
  await app.register(alumnoRoutes, { prefix: '/api/v1' })
  await app.register(docenteRoutes, { prefix: '/api/v1' })
  await app.register(apoderadoRoutes, { prefix: '/api/v1' })
  await app.register(matriculaRoutes, { prefix: '/api/v1' })

  return app
}
