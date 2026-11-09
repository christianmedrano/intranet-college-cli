import { permissionsForRoles } from '@intranet/shared'
import type { FastifyInstance } from 'fastify'
import { SignJWT } from 'jose'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../../src/app.js'
import {
  JWT_AUDIENCE,
  JWT_ISSUER,
  signAccessToken,
} from '../../src/core/auth/tokens.js'
import { createTestPrisma, limpiarBaseDePruebas } from '../helpers/test-db.js'

describe.skipIf(!process.env.TEST_DATABASE_URL)('GET /api/v1/me', () => {
  let app: FastifyInstance
  let prisma: ReturnType<typeof createTestPrisma>

  beforeAll(async () => {
    prisma = createTestPrisma()
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
    debeCambiarPassword?: boolean
  }

  async function crearUsuarioConRoles(
    roles: string[],
    opciones: OpcionesUsuario = {},
  ) {
    const persona = await prisma.persona.create({
      data: {
        nombres: 'Root',
        apellidos: 'Admin',
        tipoDocumento: 'DNI',
        numeroDocumento: opciones.documento ?? '00000000',
      },
    })

    const usuario = await prisma.usuario.create({
      data: {
        personaId: persona.id,
        username: opciones.username ?? 'root.admin',
        email: opciones.email ?? 'root@ejemplo.edu.pe',
        passwordHash: '$argon2id$hash-de-prueba',
        debeCambiarPassword: opciones.debeCambiarPassword ?? false,
      },
    })

    for (const codigo of roles) {
      const rol = await prisma.rol.upsert({
        where: { codigo },
        create: { codigo, nombre: codigo },
        update: {},
      })

      await prisma.usuarioRol.create({
        data: { usuarioId: usuario.id, rolId: rol.id },
      })
    }

    return usuario
  }

  function pedirPerfil(token: string) {
    return request(app.server)
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${token}`)
  }

  function firmarToken(
    usuarioId: string,
    opciones: { secreto?: string; expiraEn?: number } = {},
  ) {
    const secreto = new TextEncoder().encode(
      opciones.secreto ?? process.env.JWT_SECRET ?? '',
    )

    return new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(usuarioId)
      .setIssuer(JWT_ISSUER)
      .setAudience(JWT_AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(
        opciones.expiraEn ?? Math.floor(Date.now() / 1_000) + 300,
      )
      .sign(secreto)
  }

  it('exige el token de acceso', async () => {
    const respuesta = await request(app.server).get('/api/v1/me')

    expect(respuesta.status).toBe(401)
    expect(respuesta.body).toMatchObject({ error: { code: 'UNAUTHORIZED' } })
  })

  it('rechaza un esquema de autorización distinto de Bearer', async () => {
    const respuesta = await request(app.server)
      .get('/api/v1/me')
      .set('Authorization', 'Basic abc123')

    expect(respuesta.status).toBe(401)
  })

  it('rechaza un token firmado con otro secreto', async () => {
    const usuario = await crearUsuarioConRoles(['ALUMNO'])
    const token = await firmarToken(usuario.id, {
      secreto: 'otro-secreto-de-pruebas-con-32-caracteres',
    })

    const respuesta = await pedirPerfil(token)

    expect(respuesta.status).toBe(401)
  })

  it('rechaza un token expirado', async () => {
    const usuario = await crearUsuarioConRoles(['ALUMNO'])
    const token = await firmarToken(usuario.id, {
      expiraEn: Math.floor(Date.now() / 1_000) - 60,
    })

    const respuesta = await pedirPerfil(token)

    expect(respuesta.status).toBe(401)
  })

  it('rechaza un token de un usuario que ya no existe', async () => {
    const token = await firmarToken('00000000-0000-4000-8000-000000000099')

    const respuesta = await pedirPerfil(token)

    expect(respuesta.status).toBe(401)
  })

  it('devuelve persona, roles y permisos efectivos', async () => {
    const usuario = await crearUsuarioConRoles(['SUPER_ADMIN'])
    const { token } = await signAccessToken(usuario.id)

    const respuesta = await pedirPerfil(token)

    expect(respuesta.status).toBe(200)
    expect(respuesta.body).toMatchObject({
      id: usuario.id,
      username: 'root.admin',
      email: 'root@ejemplo.edu.pe',
      debeCambiarPassword: false,
      persona: {
        nombres: 'Root',
        apellidos: 'Admin',
        tipoDocumento: 'DNI',
        numeroDocumento: '00000000',
      },
      roles: ['SUPER_ADMIN'],
    })
    expect(respuesta.body.permissions).toEqual(
      permissionsForRoles(['SUPER_ADMIN']),
    )
    expect(respuesta.body).not.toHaveProperty('passwordHash')
  })

  it('une los permisos de varios roles sin duplicados', async () => {
    const usuario = await crearUsuarioConRoles(['DOCENTE', 'APODERADO'])
    const { token } = await signAccessToken(usuario.id)

    const respuesta = await pedirPerfil(token)

    expect(respuesta.status).toBe(200)
    expect(respuesta.body.roles).toEqual(['DOCENTE', 'APODERADO'])
    expect(respuesta.body.permissions).toEqual(
      permissionsForRoles(['DOCENTE', 'APODERADO']),
    )
  })

  it('revoca el acceso si el usuario se desactiva después de emitir el token', async () => {
    const usuario = await crearUsuarioConRoles(['DOCENTE'])
    const { token } = await signAccessToken(usuario.id)

    await prisma.usuario.update({
      where: { id: usuario.id },
      data: { activo: false },
    })

    const respuesta = await pedirPerfil(token)

    expect(respuesta.status).toBe(401)
  })
})
