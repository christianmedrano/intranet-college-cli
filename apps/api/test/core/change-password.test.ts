import type { FastifyInstance } from 'fastify'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../../src/app.js'
import { hashPassword, verifyPassword } from '../../src/core/auth/password.js'
import { createTestPrisma, limpiarBaseDePruebas } from '../helpers/test-db.js'

const PIN_TEMPORAL = '48291375'
const PASSWORD_NUEVA = 'ClaveDefinitiva456'

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'cambio de contraseña (RF-CORE-017)',
  () => {
    let app: FastifyInstance
    let prisma: ReturnType<typeof createTestPrisma>
    let hashTemporal: string

    beforeAll(async () => {
      prisma = createTestPrisma()
      hashTemporal = await hashPassword(PIN_TEMPORAL)
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
      activo?: boolean
      debeCambiarPassword?: boolean
    }

    async function crearUsuarioConRol(
      rol: string,
      opciones: OpcionesUsuario = {},
    ) {
      const persona = await prisma.persona.create({
        data: {
          nombres: 'Ana',
          apellidos: 'Pérez',
          tipoDocumento: 'DNI',
          numeroDocumento: opciones.documento ?? '12345678',
        },
      })

      const usuario = await prisma.usuario.create({
        data: {
          personaId: persona.id,
          username: opciones.username ?? 'ana.perez',
          email: opciones.email ?? 'ana@ejemplo.edu.pe',
          passwordHash: hashTemporal,
          debeCambiarPassword: opciones.debeCambiarPassword ?? true,
          activo: opciones.activo ?? true,
        },
      })

      const registroRol = await prisma.rol.upsert({
        where: { codigo: rol },
        create: { codigo: rol, nombre: rol },
        update: {},
      })

      await prisma.usuarioRol.create({
        data: { usuarioId: usuario.id, rolId: registroRol.id },
      })

      return usuario
    }

    async function iniciarSesion(
      password = PIN_TEMPORAL,
      identifier = 'ana.perez',
    ) {
      const respuesta = await request(app.server)
        .post('/api/v1/auth/login')
        .send({ identifier, password })

      const cookies = respuesta.headers['set-cookie']
      const texto = Array.isArray(cookies)
        ? cookies.join('; ')
        : String(cookies ?? '')

      return {
        status: respuesta.status,
        accessToken: respuesta.body.accessToken as string | undefined,
        refresh: /refresh_token=([^;]+)/.exec(texto)?.[1] ?? '',
      }
    }

    function cambiarPassword(accessToken: string, body: unknown) {
      return request(app.server)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(body)
    }

    it('exige autenticación', async () => {
      const respuesta = await request(app.server)
        .post('/api/v1/auth/change-password')
        .send({ currentPassword: PIN_TEMPORAL, newPassword: PASSWORD_NUEVA })

      expect(respuesta.status).toBe(401)
    })

    it('bloquea los recursos mientras el PIN temporal siga activo', async () => {
      await crearUsuarioConRol('SUPER_ADMIN')
      const sesion = await iniciarSesion()

      const bloqueado = await request(app.server)
        .get('/api/v1/auditoria')
        .set('Authorization', `Bearer ${sesion.accessToken}`)

      expect(bloqueado.status).toBe(403)
      expect(bloqueado.body).toMatchObject({
        error: {
          code: 'FORBIDDEN',
          message: expect.stringContaining('cambiar tu contraseña'),
        },
      })

      const perfil = await request(app.server)
        .get('/api/v1/me')
        .set('Authorization', `Bearer ${sesion.accessToken}`)

      expect(perfil.status).toBe(200)
      expect(perfil.body.debeCambiarPassword).toBe(true)
    })

    it('cambia la contraseña, desmarca el flag y revoca las sesiones', async () => {
      const usuario = await crearUsuarioConRol('SUPER_ADMIN')
      const sesion = await iniciarSesion()

      const respuesta = await cambiarPassword(sesion.accessToken!, {
        currentPassword: PIN_TEMPORAL,
        newPassword: PASSWORD_NUEVA,
      })

      expect(respuesta.status).toBe(200)
      expect(respuesta.body.message).toEqual(expect.any(String))

      const actualizado = await prisma.usuario.findUniqueOrThrow({
        where: { id: usuario.id },
      })
      expect(actualizado.debeCambiarPassword).toBe(false)
      expect(await verifyPassword(actualizado.passwordHash, PASSWORD_NUEVA)).toBe(
        true,
      )

      const renovacion = await request(app.server)
        .post('/api/v1/auth/refresh')
        .set('Cookie', `refresh_token=${sesion.refresh}`)

      expect(renovacion.status).toBe(401)

      const desbloqueado = await request(app.server)
        .get('/api/v1/auditoria')
        .set('Authorization', `Bearer ${sesion.accessToken}`)

      expect(desbloqueado.status).toBe(200)

      expect((await iniciarSesion(PIN_TEMPORAL)).status).toBe(401)
      expect((await iniciarSesion(PASSWORD_NUEVA)).status).toBe(200)
    })

    it('rechaza una contraseña actual incorrecta sin tocar la cuenta', async () => {
      const usuario = await crearUsuarioConRol('DOCENTE')
      const sesion = await iniciarSesion()

      const respuesta = await cambiarPassword(sesion.accessToken!, {
        currentPassword: 'PinEquivocado000',
        newPassword: PASSWORD_NUEVA,
      })

      expect(respuesta.status).toBe(401)
      expect(respuesta.body).toMatchObject({ error: { code: 'UNAUTHORIZED' } })

      const persistido = await prisma.usuario.findUniqueOrThrow({
        where: { id: usuario.id },
      })
      expect(persistido.debeCambiarPassword).toBe(true)
    })

    it('rechaza una nueva contraseña de menos de 10 caracteres', async () => {
      await crearUsuarioConRol('DOCENTE')
      const sesion = await iniciarSesion()

      const respuesta = await cambiarPassword(sesion.accessToken!, {
        currentPassword: PIN_TEMPORAL,
        newPassword: 'Corta123',
      })

      expect(respuesta.status).toBe(400)
      expect(respuesta.body).toMatchObject({
        error: { code: 'VALIDATION_ERROR' },
      })
    })

    it('rechaza una nueva contraseña igual al usuario', async () => {
      await crearUsuarioConRol('DOCENTE', { username: 'anaperez123' })
      const sesion = await iniciarSesion(PIN_TEMPORAL, 'anaperez123')

      const respuesta = await cambiarPassword(sesion.accessToken!, {
        currentPassword: PIN_TEMPORAL,
        newPassword: 'anaperez123',
      })

      expect(respuesta.status).toBe(400)
      expect(respuesta.body.error.details).toEqual(
        expect.arrayContaining([expect.stringContaining('usuario')]),
      )
    })

    it('rechaza una nueva contraseña igual al documento', async () => {
      await crearUsuarioConRol('DOCENTE', { documento: '1234567890' })
      const sesion = await iniciarSesion()

      const respuesta = await cambiarPassword(sesion.accessToken!, {
        currentPassword: PIN_TEMPORAL,
        newPassword: '1234567890',
      })

      expect(respuesta.status).toBe(400)
      expect(respuesta.body).toMatchObject({
        error: { code: 'VALIDATION_ERROR' },
      })
    })
  },
)
