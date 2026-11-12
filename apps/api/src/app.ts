import cookie from '@fastify/cookie'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import multipart from '@fastify/multipart'
import Fastify, { type FastifyInstance } from 'fastify'
import { loadConfig } from './core/config.js'
import { AppError, registerErrorHandler } from './core/errors.js'
import { asistenciaRoutes } from './modules/academic/asistencias/asistencia.routes.js'
import { alertaRoutes } from './modules/academic/alertas/alerta.routes.js'
import { calificacionRoutes } from './modules/academic/calificaciones/calificacion.routes.js'
import { notaFinalRoutes } from './modules/academic/calificaciones/nota-final.routes.js'
import { justificacionRoutes } from './modules/academic/justificaciones/justificacion.routes.js'
import { horarioRoutes } from './modules/academic/horarios/horario.routes.js'
import { umbralRoutes } from './modules/academic/umbral/umbral.routes.js'
import { anuncioRoutes } from './modules/communication/anuncios/anuncio.routes.js'
import { mensajeRoutes } from './modules/communication/mensajeria/mensaje.routes.js'
import { adjuntoRoutes } from './modules/communication/adjuntos/adjunto.routes.js'
import { adjuntoVirtualRoutes } from './modules/virtual-classroom/adjuntos/adjunto.routes.js'
import { materialRoutes } from './modules/virtual-classroom/materiales/material.routes.js'
import { authRoutes } from './modules/core/auth/auth.routes.js'
import { auditoriaRoutes } from './modules/core/auditoria/auditoria.routes.js'
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
import { usuarioRoutes } from './modules/core/usuarios/usuario.routes.js'
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
  await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } })
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
  await app.register(auditoriaRoutes, { prefix: '/api/v1' })
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
  await app.register(usuarioRoutes, { prefix: '/api/v1' })
  await app.register(matriculaRoutes, { prefix: '/api/v1' })
  await app.register(calificacionRoutes, { prefix: '/api/v1' })
  await app.register(notaFinalRoutes, { prefix: '/api/v1' })
  await app.register(asistenciaRoutes, { prefix: '/api/v1' })
  await app.register(justificacionRoutes, { prefix: '/api/v1' })
  await app.register(umbralRoutes, { prefix: '/api/v1' })
  await app.register(alertaRoutes, { prefix: '/api/v1' })
  await app.register(horarioRoutes, { prefix: '/api/v1' })
  await app.register(anuncioRoutes, { prefix: '/api/v1' })
  await app.register(mensajeRoutes, { prefix: '/api/v1' })
  await app.register(adjuntoRoutes, { prefix: '/api/v1' })
  await app.register(materialRoutes, { prefix: '/api/v1' })
  await app.register(adjuntoVirtualRoutes, { prefix: '/api/v1' })

  return app
}