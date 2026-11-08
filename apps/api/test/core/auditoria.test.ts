import type { FastifyInstance } from 'fastify'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../../src/app.js'
import { registrarAuditoria } from '../../src/core/audit.js'
import { signAccessToken } from '../../src/core/auth/tokens.js'
import type { Prisma } from '../../src/generated/prisma/client.js'
import { createTestPrisma, limpiarBaseDePruebas } from '../helpers/test-db.js'

describe.skipIf(!process.env.TEST_DATABASE_URL)('auditoría (endpoint)', () => {
  let app: FastifyInstance
  let prisma: ReturnType<typeof createTestPrisma>
  let secuencia = 0

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

  async function crearUsuarioConRoles(roles: string[]) {
    secuencia += 1

    const persona = await prisma.persona.create({
      data: {
        nombres: `Usuario${secuencia}`,
        apellidos: 'De Prueba',
        tipoDocumento: 'DNI',
        numeroDocumento: String(44_000_000 + secuencia),
      },
    })

    const usuario = await prisma.usuario.create({
      data: {
        personaId: persona.id,
        username: `usuario.${secuencia}`,
        email: `usuario.${secuencia}@ejemplo.edu.pe`,
        passwordHash: '$argon2id$hash-de-prueba',
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

  async function tokenDe(roles: string[]): Promise<string> {
    const usuario = await crearUsuarioConRoles(roles)
    const { token } = await signAccessToken(usuario.id)

    return token
  }

  function get(ruta: string, token?: string) {
    const peticion = request(app.server).get(ruta)

    return token ? peticion.set('Authorization', `Bearer ${token}`) : peticion
  }

  async function insertarAuditoria(datos: {
    usuarioId?: string | null
    accion?: string
    entidad?: string
    entidadId?: string | null
    datos?: Prisma.InputJsonValue
    ip?: string | null
    userAgent?: string | null
    createdAt?: Date
  } = {}) {
    return prisma.auditoria.create({
      data: {
        usuarioId: datos.usuarioId ?? null,
        accion: datos.accion ?? 'CREAR',
        entidad: datos.entidad ?? 'ALUMNO',
        entidadId: datos.entidadId ?? null,
        ip: datos.ip ?? null,
        userAgent: datos.userAgent ?? null,
        ...(datos.datos !== undefined ? { datos: datos.datos } : {}),
        ...(datos.createdAt !== undefined
          ? { createdAt: datos.createdAt }
          : {}),
      },
    })
  }

  it('exige autenticación', async () => {
    const respuesta = await get('/api/v1/auditoria')

    expect(respuesta.status).toBe(401)
  })

  it('rechaza a Docente, Apoderado y Alumno', async () => {
    for (const rol of ['DOCENTE', 'APODERADO', 'ALUMNO']) {
      const token = await tokenDe([rol])
      const respuesta = await get('/api/v1/auditoria', token)

      expect(respuesta.status).toBe(403)
      expect(respuesta.body).toMatchObject({ error: { code: 'FORBIDDEN' } })
    }
  })

  it('permite a SuperAdmin y Director con listado vacío paginado', async () => {
    for (const rol of ['SUPER_ADMIN', 'DIRECTOR']) {
      const token = await tokenDe([rol])
      const respuesta = await get('/api/v1/auditoria', token)

      expect(respuesta.status).toBe(200)
      expect(respuesta.body).toEqual({
        data: [],
        meta: { page: 1, pageSize: 20, total: 0 },
      })
    }
  })

  it('lista de la más reciente a la más antigua', async () => {
    const primero = await insertarAuditoria({
      createdAt: new Date('2026-01-01T10:00:00.000Z'),
    })
    const segundo = await insertarAuditoria({
      createdAt: new Date('2026-01-01T11:00:00.000Z'),
    })
    const tercero = await insertarAuditoria({
      createdAt: new Date('2026-01-01T12:00:00.000Z'),
    })
    const token = await tokenDe(['SUPER_ADMIN'])

    const respuesta = await get('/api/v1/auditoria', token)

    expect(respuesta.status).toBe(200)
    expect(respuesta.body.meta.total).toBe(3)
    expect(
      respuesta.body.data.map((fila: { id: string }) => fila.id),
    ).toEqual([tercero.id, segundo.id, primero.id])
  })

  it('filtra por usuario, entidad, entidadId y acción', async () => {
    const usuario = await crearUsuarioConRoles(['DIRECTOR'])
    const entidadId = '00000000-0000-4000-8000-000000000010'
    const esperada = await insertarAuditoria({
      usuarioId: usuario.id,
      accion: 'APROBAR',
      entidad: 'MATRICULA',
      entidadId,
    })

    await insertarAuditoria({
      usuarioId: usuario.id,
      accion: 'CREAR',
      entidad: 'MATRICULA',
      entidadId,
    })
    await insertarAuditoria({
      usuarioId: usuario.id,
      accion: 'APROBAR',
      entidad: 'ALUMNO',
      entidadId,
    })

    const token = await tokenDe(['SUPER_ADMIN'])
    const respuesta = await get(
      `/api/v1/auditoria?usuarioId=${usuario.id}&entidad=MATRICULA&entidadId=${entidadId}&accion=APROBAR`,
      token,
    )

    expect(respuesta.status).toBe(200)
    expect(respuesta.body.meta.total).toBe(1)
    expect(respuesta.body.data[0].id).toBe(esperada.id)
  })

  it('filtra por rango de fechas', async () => {
    await insertarAuditoria({
      createdAt: new Date('2026-01-15T10:00:00.000Z'),
    })
    const esperada = await insertarAuditoria({
      createdAt: new Date('2026-02-15T10:00:00.000Z'),
    })
    await insertarAuditoria({
      createdAt: new Date('2026-03-15T10:00:00.000Z'),
    })
    const token = await tokenDe(['SUPER_ADMIN'])

    const respuesta = await get(
      '/api/v1/auditoria?desde=2026-02-01T00:00:00.000Z&hasta=2026-02-28T23:59:59.000Z',
      token,
    )

    expect(respuesta.status).toBe(200)
    expect(respuesta.body.meta.total).toBe(1)
    expect(respuesta.body.data[0].id).toBe(esperada.id)
  })

  it('pagina los resultados', async () => {
    for (const hora of [10, 11, 12]) {
      await insertarAuditoria({
        createdAt: new Date(`2026-01-01T${hora}:00:00.000Z`),
      })
    }

    const token = await tokenDe(['SUPER_ADMIN'])
    const primera = await get(
      '/api/v1/auditoria?page=1&pageSize=2',
      token,
    )
    const segunda = await get(
      '/api/v1/auditoria?page=2&pageSize=2',
      token,
    )

    expect(primera.status).toBe(200)
    expect(primera.body.meta).toEqual({ page: 1, pageSize: 2, total: 3 })
    expect(primera.body.data).toHaveLength(2)
    expect(segunda.body.meta).toEqual({ page: 2, pageSize: 2, total: 3 })
    expect(segunda.body.data).toHaveLength(1)
  })

  it('valida los filtros y la paginación', async () => {
    const token = await tokenDe(['SUPER_ADMIN'])

    const respuestas = [
      await get('/api/v1/auditoria?usuarioId=no-es-uuid', token),
      await get('/api/v1/auditoria?pageSize=1000', token),
      await get('/api/v1/auditoria?desde=2026-13-40', token),
    ]

    for (const respuesta of respuestas) {
      expect(respuesta.status).toBe(400)
      expect(respuesta.body).toMatchObject({
        error: { code: 'VALIDATION_ERROR' },
      })
    }
  })

  it('devuelve datos redactados, IP y user-agent', async () => {
    const usuario = await crearUsuarioConRoles(['SUPER_ADMIN'])

    await prisma.$transaction(async (tx) => {
      await registrarAuditoria(tx, {
        usuarioId: usuario.id,
        accion: 'CREAR',
        entidad: 'ALUMNO',
        entidadId: '00000000-0000-4000-8000-000000000011',
        datos: {
          codigoAlumno: 'AL-001',
          persona: { nombres: 'Ana', numeroDocumento: '12345678' },
        },
        ip: '127.0.0.1',
        userAgent: 'vitest',
      })
    })

    const token = await tokenDe(['SUPER_ADMIN'])
    const respuesta = await get('/api/v1/auditoria', token)

    expect(respuesta.status).toBe(200)
    expect(respuesta.body.data[0]).toMatchObject({
      usuarioId: usuario.id,
      accion: 'CREAR',
      entidad: 'ALUMNO',
      entidadId: '00000000-0000-4000-8000-000000000011',
      ip: '127.0.0.1',
      userAgent: 'vitest',
      datos: {
        codigoAlumno: 'AL-001',
        persona: {
          nombres: '[REDACTADO]',
          numeroDocumento: '[REDACTADO]',
        },
      },
    })
    expect(JSON.stringify(respuesta.body)).not.toContain('12345678')
  })
})
