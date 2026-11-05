import Fastify, { type FastifyInstance } from 'fastify'
import { afterEach, describe, expect, it } from 'vitest'
import { AppError, registerErrorHandler } from '../../src/core/errors.js'

let app: FastifyInstance | undefined

function buildTestApp(): FastifyInstance {
  const instance = Fastify()
  registerErrorHandler(instance)

  instance.get('/prohibido', async () => {
    throw new AppError('FORBIDDEN')
  })

  instance.get('/conflicto', async () => {
    throw new AppError('CONFLICT', 'El alumno ya está matriculado.', [
      'alumno_id duplicado',
    ])
  })

  instance.get(
    '/validacion',
    {
      schema: {
        querystring: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string' } },
        },
      },
    },
    async () => ({ ok: true }),
  )

  instance.get('/inesperado', async () => {
    throw new Error('fallo-interno-secreto')
  })

  app = instance
  return instance
}

afterEach(async () => {
  await app?.close()
  app = undefined
})

describe('manejador global de errores', () => {
  it('traduce un AppError a su código y estado', async () => {
    const response = await buildTestApp().inject({
      method: 'GET',
      url: '/prohibido',
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({
      error: {
        code: 'FORBIDDEN',
        message: 'No tienes permiso para realizar esta acción.',
        details: [],
      },
    })
  })

  it('conserva el mensaje y los detalles de un conflicto', async () => {
    const response = await buildTestApp().inject({
      method: 'GET',
      url: '/conflicto',
    })

    expect(response.statusCode).toBe(409)
    expect(response.json()).toMatchObject({
      error: {
        code: 'CONFLICT',
        message: 'El alumno ya está matriculado.',
        details: ['alumno_id duplicado'],
      },
    })
  })

  it('convierte un error de validación en 400', async () => {
    const response = await buildTestApp().inject({
      method: 'GET',
      url: '/validacion',
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toMatchObject({
      error: { code: 'VALIDATION_ERROR' },
    })
  })

  it('oculta los detalles de un error inesperado', async () => {
    const response = await buildTestApp().inject({
      method: 'GET',
      url: '/inesperado',
    })

    expect(response.statusCode).toBe(500)
    expect(response.json()).toEqual({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Ocurrió un error inesperado.',
        details: [],
      },
    })
    expect(response.body).not.toContain('fallo-interno-secreto')
  })
})
