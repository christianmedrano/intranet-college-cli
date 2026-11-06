import type { FastifyInstance } from 'fastify'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../../src/app.js'
import { hashPassword } from '../../src/core/auth/password.js'
import {
  createRecoveryToken,
  hashToken,
  RECOVERY_TOKEN_TTL_MS,
  signAccessToken,
} from '../../src/core/auth/tokens.js'
import { createTestPrisma, limpiarBaseDePruebas } from '../helpers/test-db.js'

const PASSWORD_INICIAL = 'ClaveInicial123'
const PASSWORD_NUEVA = 'ClaveDefinitiva456'

describe.skipIf(!process.env.TEST_DATABASE_URL)('recuperación de contraseña', () => {
  let app: FastifyInstance
  let prisma: ReturnType<typeof createTestPrisma>
  let hashInicial: string

  beforeAll(async () => {
    prisma = createTestPrisma()
    hashInicial = await hashPassword(PASSWORD_INICIAL)
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
  }

  async function crearUsuario(opciones: OpcionesUsuario = {}) {
    const persona = await prisma.persona.create({
      data: {
        nombres: 'Ana',
        apellidos: 'Pérez',
        tipoDocumento: 'DNI',
        numeroDocumento: opciones.documento ?? '12345678',
      },
    })

    return prisma.usuario.create({
      data: {
        personaId: persona.id,
        username: opciones.username ?? 'ana.perez',
        email: opciones.email ?? 'ana@ejemplo.edu.pe',
        passwordHash: hashInicial,
        debeCambiarPassword: true,
        activo: opciones.activo ?? true,
      },
    })
  }

  async function crearUsuarioConRol(
    rol: string,
    opciones: OpcionesUsuario = {},
  ) {
    const usuario = await crearUsuario(opciones)
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
    identifier = 'ana.perez',
    password = PASSWORD_INICIAL,
  ) {
    const respuesta = await request(app.server)
      .post('/api/v1/auth/login')
      .send({ identifier, password })

    const cookies = respuesta.headers['set-cookie']
    const texto = Array.isArray(cookies) ? cookies.join('; ') : String(cookies ?? '')

    return {
      status: respuesta.status,
      accessToken: respuesta.body.accessToken as string | undefined,
      refresh: /refresh_token=([^;]+)/.exec(texto)?.[1] ?? '',
    }
  }

  async function tokenDeAdministracion(): Promise<string> {
    const admin = await crearUsuarioConRol('SUPER_ADMIN', {
      username: 'root.admin',
      email: 'root@ejemplo.edu.pe',
      documento: '00000000',
    })
    const { token } = await signAccessToken(admin.id)

    return token
  }

  function emitirToken(adminToken: string, usuarioId: string) {
    return request(app.server)
      .post(`/api/v1/usuarios/${usuarioId}/token-recuperacion`)
      .set('Authorization', `Bearer ${adminToken}`)
  }

  describe('POST /api/v1/auth/forgot-password', () => {
    it('responde 202 y guarda solo el hash cuando el correo existe', async () => {
      const usuario = await crearUsuario()

      const respuesta = await request(app.server)
        .post('/api/v1/auth/forgot-password')
        .send({ email: usuario.email })

      expect(respuesta.status).toBe(202)
      expect(respuesta.body.message).toEqual(expect.any(String))

      const registros = await prisma.tokenRecuperacion.findMany()
      expect(registros).toHaveLength(1)
      expect(registros[0]?.usuarioId).toBe(usuario.id)
      expect(registros[0]?.tokenHash).toMatch(/^[0-9a-f]{64}$/)
      expect(registros[0]?.usadoEn).toBeNull()
      expect(registros[0]?.expiraEn.getTime()).toBeGreaterThan(Date.now())
    })

    it('responde 202 sin generar token cuando el correo no existe', async () => {
      await crearUsuario()

      const respuesta = await request(app.server)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'nadie@ejemplo.edu.pe' })

      expect(respuesta.status).toBe(202)
      expect(respuesta.body.message).toEqual(expect.any(String))
      expect(await prisma.tokenRecuperacion.count()).toBe(0)
    })

    it('no genera token para un usuario inactivo', async () => {
      const usuario = await crearUsuario({ activo: false })

      const respuesta = await request(app.server)
        .post('/api/v1/auth/forgot-password')
        .send({ email: usuario.email })

      expect(respuesta.status).toBe(202)
      expect(await prisma.tokenRecuperacion.count()).toBe(0)
    })

    it('rechaza un correo con formato inválido', async () => {
      const respuesta = await request(app.server)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'no-es-un-correo' })

      expect(respuesta.status).toBe(400)
      expect(respuesta.body).toMatchObject({
        error: { code: 'VALIDATION_ERROR' },
      })
    })

    it('invalida el token anterior al emitir uno nuevo', async () => {
      const usuario = await crearUsuario()

      await request(app.server)
        .post('/api/v1/auth/forgot-password')
        .send({ email: usuario.email })
      await request(app.server)
        .post('/api/v1/auth/forgot-password')
        .send({ email: usuario.email })

      const registros = await prisma.tokenRecuperacion.findMany({
        orderBy: { createdAt: 'asc' },
      })

      expect(registros).toHaveLength(2)
      expect(registros[0]?.usadoEn).not.toBeNull()
      expect(registros[1]?.usadoEn).toBeNull()
    })
  })

  describe('POST /api/v1/usuarios/:id/token-recuperacion', () => {
    it('exige autenticación', async () => {
      const usuario = await crearUsuario()

      const respuesta = await request(app.server).post(
        `/api/v1/usuarios/${usuario.id}/token-recuperacion`,
      )

      expect(respuesta.status).toBe(401)
    })

    it('exige el permiso core.usuarios.gestionar', async () => {
      const usuario = await crearUsuario()
      const docente = await crearUsuarioConRol('DOCENTE', {
        username: 'docente.uno',
        email: 'docente@ejemplo.edu.pe',
        documento: '87654321',
      })
      const { token } = await signAccessToken(docente.id)

      const respuesta = await request(app.server)
        .post(`/api/v1/usuarios/${usuario.id}/token-recuperacion`)
        .set('Authorization', `Bearer ${token}`)

      expect(respuesta.status).toBe(403)
      expect(respuesta.body).toMatchObject({ error: { code: 'FORBIDDEN' } })
    })

    it('devuelve el token en claro una sola vez y guarda su hash', async () => {
      const usuario = await crearUsuario()
      const admin = await tokenDeAdministracion()

      const respuesta = await emitirToken(admin, usuario.id)

      expect(respuesta.status).toBe(200)
      expect(respuesta.body.token).toEqual(expect.any(String))
      expect(respuesta.body.expiresAt).toEqual(expect.any(String))

      const registro = await prisma.tokenRecuperacion.findFirstOrThrow()
      expect(registro.tokenHash).toBe(hashToken(respuesta.body.token))
      expect(registro.tokenHash).not.toBe(respuesta.body.token)
    })

    it('invalida el token anterior sin usar', async () => {
      const usuario = await crearUsuario()
      const admin = await tokenDeAdministracion()

      const primero = await emitirToken(admin, usuario.id)
      const segundo = await emitirToken(admin, usuario.id)

      const registros = await prisma.tokenRecuperacion.findMany({
        orderBy: { createdAt: 'asc' },
      })

      expect(registros).toHaveLength(2)
      expect(registros[0]?.usadoEn).not.toBeNull()
      expect(registros[1]?.usadoEn).toBeNull()
      expect(segundo.body.token).not.toBe(primero.body.token)
    })

    it('devuelve 404 si el usuario no está vigente', async () => {
      const usuario = await crearUsuario({ activo: false })
      const admin = await tokenDeAdministracion()

      const respuesta = await emitirToken(admin, usuario.id)

      expect(respuesta.status).toBe(404)
      expect(respuesta.body).toMatchObject({ error: { code: 'NOT_FOUND' } })
    })

    it('devuelve 400 si el identificador no es un UUID', async () => {
      const admin = await tokenDeAdministracion()

      const respuesta = await request(app.server)
        .post('/api/v1/usuarios/no-es-uuid/token-recuperacion')
        .set('Authorization', `Bearer ${admin}`)

      expect(respuesta.status).toBe(400)
    })
  })

  describe('POST /api/v1/auth/reset-password', () => {
    it('cambia la contraseña, consume el token y habilita el acceso', async () => {
      const usuario = await crearUsuario()
      const admin = await tokenDeAdministracion()
      const emision = await emitirToken(admin, usuario.id)

      const respuesta = await request(app.server)
        .post('/api/v1/auth/reset-password')
        .send({ token: emision.body.token, password: PASSWORD_NUEVA })

      expect(respuesta.status).toBe(200)

      const actualizado = await prisma.usuario.findUniqueOrThrow({
        where: { id: usuario.id },
      })
      expect(actualizado.debeCambiarPassword).toBe(false)

      const registro = await prisma.tokenRecuperacion.findFirstOrThrow()
      expect(registro.usadoEn).not.toBeNull()

      const acceso = await iniciarSesion('ana.perez', PASSWORD_NUEVA)
      expect(acceso.status).toBe(200)
    })

    it('revoca las sesiones activas del usuario', async () => {
      const usuario = await crearUsuario()
      const sesion = await iniciarSesion()
      expect(sesion.status).toBe(200)

      const admin = await tokenDeAdministracion()
      const emision = await emitirToken(admin, usuario.id)

      await request(app.server)
        .post('/api/v1/auth/reset-password')
        .send({ token: emision.body.token, password: PASSWORD_NUEVA })

      const renovacion = await request(app.server)
        .post('/api/v1/auth/refresh')
        .set('Cookie', `refresh_token=${sesion.refresh}`)

      expect(renovacion.status).toBe(401)
    })

    it('rechaza un token ya usado', async () => {
      const usuario = await crearUsuario()
      const admin = await tokenDeAdministracion()
      const emision = await emitirToken(admin, usuario.id)

      await request(app.server)
        .post('/api/v1/auth/reset-password')
        .send({ token: emision.body.token, password: PASSWORD_NUEVA })

      const reutilizado = await request(app.server)
        .post('/api/v1/auth/reset-password')
        .send({ token: emision.body.token, password: 'OtraClaveLarga789' })

      expect(reutilizado.status).toBe(400)
      expect(reutilizado.body).toMatchObject({
        error: { code: 'VALIDATION_ERROR' },
      })
    })

    it('rechaza un token expirado', async () => {
      const usuario = await crearUsuario()
      const admin = await tokenDeAdministracion()
      const emision = await emitirToken(admin, usuario.id)

      await prisma.tokenRecuperacion.updateMany({
        data: { expiraEn: new Date(Date.now() - 1_000) },
      })

      const respuesta = await request(app.server)
        .post('/api/v1/auth/reset-password')
        .send({ token: emision.body.token, password: PASSWORD_NUEVA })

      expect(respuesta.status).toBe(400)
    })

    it('rechaza un token desconocido', async () => {
      const respuesta = await request(app.server)
        .post('/api/v1/auth/reset-password')
        .send({ token: 'token-que-no-existe', password: PASSWORD_NUEVA })

      expect(respuesta.status).toBe(400)
    })

    it('rechaza una contraseña de menos de 10 caracteres sin consumir el token', async () => {
      const usuario = await crearUsuario()
      const admin = await tokenDeAdministracion()
      const emision = await emitirToken(admin, usuario.id)

      const respuesta = await request(app.server)
        .post('/api/v1/auth/reset-password')
        .send({ token: emision.body.token, password: 'Corta123' })

      expect(respuesta.status).toBe(400)

      const registro = await prisma.tokenRecuperacion.findFirstOrThrow()
      expect(registro.usadoEn).toBeNull()
    })

    it('rechaza una contraseña igual al usuario', async () => {
      const usuario = await crearUsuario({ username: 'anaperez123' })
      const admin = await tokenDeAdministracion()
      const emision = await emitirToken(admin, usuario.id)

      const respuesta = await request(app.server)
        .post('/api/v1/auth/reset-password')
        .send({ token: emision.body.token, password: 'anaperez123' })

      expect(respuesta.status).toBe(400)
      expect(respuesta.body.error.details).toEqual(
        expect.arrayContaining([expect.stringContaining('usuario')]),
      )
    })

    it('rechaza una contraseña igual al documento', async () => {
      const usuario = await crearUsuario({ documento: '1234567890' })
      const admin = await tokenDeAdministracion()
      const emision = await emitirToken(admin, usuario.id)

      const respuesta = await request(app.server)
        .post('/api/v1/auth/reset-password')
        .send({ token: emision.body.token, password: '1234567890' })

      expect(respuesta.status).toBe(400)
    })
  })

  describe('createRecoveryToken', () => {
    it('genera un token opaco válido durante 30 minutos', () => {
      const ahora = new Date('2026-11-05T12:00:00.000Z')
      const token = createRecoveryToken(ahora)

      expect(token.token).toMatch(/^[A-Za-z0-9_-]+$/)
      expect(token.tokenHash).toBe(hashToken(token.token))
      expect(token.expiraEn.toISOString()).toBe('2026-11-05T12:30:00.000Z')
      expect(RECOVERY_TOKEN_TTL_MS).toBe(30 * 60 * 1_000)
    })
  })
})
