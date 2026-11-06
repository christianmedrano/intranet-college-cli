import type { FastifyInstance } from 'fastify'
import { jwtVerify } from 'jose'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../../src/app.js'
import { hashPassword } from '../../src/core/auth/password.js'
import { createTestPrisma, limpiarBaseDePruebas } from '../helpers/test-db.js'

const PASSWORD = 'ClaveSegura123'

/** Une las cabeceras `Set-Cookie` sin depender de cómo las agrupe supertest. */
function leerCookies(headers: Record<string, unknown>): string {
  const valor = headers['set-cookie']

  if (Array.isArray(valor)) {
    return valor.filter((item) => typeof item === 'string').join('; ')
  }

  return typeof valor === 'string' ? valor : ''
}

/** Extrae el valor del refresh token de las cabeceras de respuesta. */
function extraerRefresh(headers: Record<string, unknown>): string {
  return /refresh_token=([^;]+)/.exec(leerCookies(headers))?.[1] ?? ''
}

describe.skipIf(!process.env.TEST_DATABASE_URL)('sesión', () => {
  let app: FastifyInstance
  let prisma: ReturnType<typeof createTestPrisma>
  let hash: string

  beforeAll(async () => {
    prisma = createTestPrisma()
    hash = await hashPassword(PASSWORD)
    app = await buildApp()
    await app.ready()
  })

  beforeEach(async () => {
    await limpiarBaseDePruebas(prisma)
  })

  afterAll(async () => {
    await app.close()
    await prisma.$disconnect()
  })

  async function crearUsuario(activo = true) {
    const persona = await prisma.persona.create({
      data: {
        nombres: 'Ana',
        apellidos: 'Pérez',
        tipoDocumento: 'DNI',
        numeroDocumento: '12345678',
      },
    })

    return prisma.usuario.create({
      data: {
        personaId: persona.id,
        username: 'ana.perez',
        email: 'ana@ejemplo.edu.pe',
        passwordHash: hash,
        activo,
      },
    })
  }

  async function iniciarSesion(): Promise<{
    accessToken: string
    refresh: string
  }> {
    const respuesta = await request(app.server)
      .post('/api/v1/auth/login')
      .send({ identifier: 'ana.perez', password: PASSWORD })

    return {
      accessToken: respuesta.body.accessToken,
      refresh: extraerRefresh(respuesta.headers),
    }
  }

  function renovar(refresh: string) {
    return request(app.server)
      .post('/api/v1/auth/refresh')
      .set('Cookie', `refresh_token=${refresh}`)
  }

  describe('POST /api/v1/auth/refresh', () => {
    it('entrega un access token nuevo y rota el refresh', async () => {
      await crearUsuario()
      const { refresh } = await iniciarSesion()

      const respuesta = await renovar(refresh)

      expect(respuesta.status).toBe(200)
      expect(respuesta.body.accessToken).toEqual(expect.any(String))
      expect(respuesta.body).not.toHaveProperty('refresh')

      const refreshNuevo = extraerRefresh(respuesta.headers)
      expect(refreshNuevo).not.toBe('')
      expect(refreshNuevo).not.toBe(refresh)

      const clave = new TextEncoder().encode(process.env.JWT_SECRET ?? '')
      const { payload } = await jwtVerify(respuesta.body.accessToken, clave)
      expect(payload.sub).toEqual(expect.any(String))

      const sesiones = await prisma.sesionRefresh.findMany({
        orderBy: { createdAt: 'asc' },
      })
      expect(sesiones).toHaveLength(2)
      expect(sesiones[0]?.revocadoEn).not.toBeNull()
      expect(sesiones[1]?.revocadoEn).toBeNull()
    })

    it('rechaza la reutilización de un refresh ya rotado', async () => {
      await crearUsuario()
      const { refresh } = await iniciarSesion()

      await renovar(refresh)
      const reutilizado = await renovar(refresh)

      expect(reutilizado.status).toBe(401)
      expect(reutilizado.body).toMatchObject({
        error: { code: 'UNAUTHORIZED' },
      })
    })

    it('rechaza la renovación sin cookie', async () => {
      const respuesta = await request(app.server).post('/api/v1/auth/refresh')

      expect(respuesta.status).toBe(401)
    })

    it('rechaza un refresh desconocido', async () => {
      const respuesta = await renovar('token-que-no-existe')

      expect(respuesta.status).toBe(401)
    })

    it('rechaza una sesión expirada', async () => {
      await crearUsuario()
      const { refresh } = await iniciarSesion()

      await prisma.sesionRefresh.updateMany({
        data: { expiraEn: new Date(Date.now() - 1_000) },
      })

      const respuesta = await renovar(refresh)

      expect(respuesta.status).toBe(401)
    })

    it('rechaza la renovación de un usuario desactivado', async () => {
      const usuario = await crearUsuario()
      const { refresh } = await iniciarSesion()

      await prisma.usuario.update({
        where: { id: usuario.id },
        data: { activo: false },
      })

      const respuesta = await renovar(refresh)

      expect(respuesta.status).toBe(401)
    })
  })

  describe('POST /api/v1/auth/logout', () => {
    it('revoca la sesión, limpia la cookie y bloquea la renovación', async () => {
      await crearUsuario()
      const { accessToken, refresh } = await iniciarSesion()

      const salida = await request(app.server)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Cookie', `refresh_token=${refresh}`)

      expect(salida.status).toBe(204)
      expect(leerCookies(salida.headers)).toContain('refresh_token=;')
      expect(leerCookies(salida.headers)).toContain('Path=/api/v1/auth')

      const sesion = await prisma.sesionRefresh.findFirstOrThrow()
      expect(sesion.revocadoEn).not.toBeNull()

      const renovacion = await renovar(refresh)
      expect(renovacion.status).toBe(401)
    })

    it('exige un token de acceso válido', async () => {
      const respuesta = await request(app.server).post('/api/v1/auth/logout')

      expect(respuesta.status).toBe(401)
    })

    it('es idempotente cuando no hay cookie de refresh', async () => {
      await crearUsuario()
      const { accessToken } = await iniciarSesion()

      const respuesta = await request(app.server)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)

      expect(respuesta.status).toBe(204)
    })
  })
})
