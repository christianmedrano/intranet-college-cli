import type { FastifyInstance } from 'fastify'
import { jwtVerify } from 'jose'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../../src/app.js'
import { hashPassword } from '../../src/core/auth/password.js'
import { JWT_AUDIENCE, JWT_ISSUER } from '../../src/core/auth/tokens.js'
import { createTestPrisma, limpiarBaseDePruebas } from '../helpers/test-db.js'

const PASSWORD = 'ClaveSegura123'

/** Une las cabeceras `Set-Cookie` sin depender de si supertest las agrupa. */
function leerCookies(headers: Record<string, unknown>): string {
  const valor = headers['set-cookie']

  if (Array.isArray(valor)) {
    return valor.filter((item) => typeof item === 'string').join('; ')
  }

  return typeof valor === 'string' ? valor : ''
}

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'POST /api/v1/auth/login',
  () => {
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

    interface OpcionesUsuario {
      username?: string
      email?: string
      documento?: string
      tipoDocumento?: string
      activo?: boolean
    }

    async function crearUsuario(opciones: OpcionesUsuario = {}) {
      const persona = await prisma.persona.create({
        data: {
          nombres: 'Ana',
          apellidos: 'Pérez',
          tipoDocumento: opciones.tipoDocumento ?? 'DNI',
          numeroDocumento: opciones.documento ?? '12345678',
        },
      })

      return prisma.usuario.create({
        data: {
          personaId: persona.id,
          username: opciones.username ?? 'ana.perez',
          email: opciones.email ?? 'ana@ejemplo.edu.pe',
          passwordHash: hash,
          activo: opciones.activo ?? true,
        },
      })
    }

    function iniciarSesion(identificador: string, password = PASSWORD) {
      return request(app.server)
        .post('/api/v1/auth/login')
        .send({ identifier: identificador, password })
    }

    it('autentica con nombre de usuario y entrega el refresh en cookie httpOnly', async () => {
      const usuario = await crearUsuario()

      const respuesta = await iniciarSesion('ana.perez')

      expect(respuesta.status).toBe(200)
      expect(respuesta.body).toMatchObject({ tokenType: 'Bearer' })
      expect(respuesta.body.accessToken).toEqual(expect.any(String))
      expect(respuesta.body.expiresIn).toBeGreaterThan(0)
      expect(respuesta.body).not.toHaveProperty('refresh')

      const cookies = leerCookies(respuesta.headers)
      expect(cookies).toContain('refresh_token=')
      expect(cookies).toContain('HttpOnly')
      expect(cookies).toContain('Path=/api/v1/auth')
      expect(cookies).toContain('SameSite=Lax')

      const sesion = await prisma.sesionRefresh.findFirstOrThrow()
      expect(sesion.usuarioId).toBe(usuario.id)
      expect(sesion.revocadoEn).toBeNull()
      expect(sesion.tokenHash).toHaveLength(64)

      const clave = new TextEncoder().encode(process.env.JWT_SECRET ?? '')
      const { payload } = await jwtVerify(respuesta.body.accessToken, clave)
      expect(payload.sub).toBe(usuario.id)
      expect(payload.iss).toBe(JWT_ISSUER)
      expect(payload.aud).toBe(JWT_AUDIENCE)
    })

    it('autentica con correo electrónico', async () => {
      await crearUsuario()

      const respuesta = await iniciarSesion('ana@ejemplo.edu.pe')

      expect(respuesta.status).toBe(200)
      expect(respuesta.body.accessToken).toEqual(expect.any(String))
    })

    it('autentica con número de documento', async () => {
      await crearUsuario({ documento: '87654321' })

      const respuesta = await iniciarSesion('87654321')

      expect(respuesta.status).toBe(200)
    })

    it('rechaza una contraseña incorrecta sin emitir cookie', async () => {
      await crearUsuario()

      const respuesta = await iniciarSesion('ana.perez', 'ClaveEquivocada123')

      expect(respuesta.status).toBe(401)
      expect(respuesta.body).toMatchObject({
        error: { code: 'UNAUTHORIZED', message: 'Credenciales inválidas.' },
      })
      expect(respuesta.headers['set-cookie']).toBeUndefined()
      await expect(prisma.sesionRefresh.count()).resolves.toBe(0)
    })

    it('responde igual ante un identificador inexistente', async () => {
      const respuesta = await iniciarSesion('no.existe')

      expect(respuesta.status).toBe(401)
      expect(respuesta.body).toMatchObject({
        error: { code: 'UNAUTHORIZED', message: 'Credenciales inválidas.' },
      })
    })

    it('rechaza a un usuario inactivo', async () => {
      await crearUsuario({ activo: false })

      const respuesta = await iniciarSesion('ana.perez')

      expect(respuesta.status).toBe(401)
      expect(respuesta.body).toMatchObject({ error: { code: 'UNAUTHORIZED' } })
    })

    it('rechaza a un usuario con borrado lógico', async () => {
      const usuario = await crearUsuario()

      await prisma.usuario.update({
        where: { id: usuario.id },
        data: { deletedAt: new Date() },
      })

      const respuesta = await iniciarSesion('ana.perez')

      expect(respuesta.status).toBe(401)
    })

    it('devuelve 409 si el documento coincide con más de un usuario', async () => {
      await crearUsuario({
        username: 'ana.perez',
        email: 'ana@ejemplo.edu.pe',
        documento: '12345678',
        tipoDocumento: 'DNI',
      })
      await crearUsuario({
        username: 'ana.perez.ce',
        email: 'ana.ce@ejemplo.edu.pe',
        documento: '12345678',
        tipoDocumento: 'CE',
      })

      const respuesta = await iniciarSesion('12345678')

      expect(respuesta.status).toBe(409)
      expect(respuesta.body).toMatchObject({ error: { code: 'CONFLICT' } })
    })

    it('devuelve 400 si el cuerpo no cumple el esquema', async () => {
      const respuesta = await request(app.server)
        .post('/api/v1/auth/login')
        .send({ identifier: 'ana.perez' })

      expect(respuesta.status).toBe(400)
      expect(respuesta.body).toMatchObject({
        error: { code: 'VALIDATION_ERROR' },
      })
    })
  },
)
