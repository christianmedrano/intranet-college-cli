import type { FastifyInstance } from 'fastify'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../../src/app.js'
import { signAccessToken } from '../../src/core/auth/tokens.js'
import { createTestPrisma, limpiarBaseDePruebas } from '../helpers/test-db.js'

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'GET y PATCH /api/v1/institucion',
  () => {
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
          numeroDocumento: String(20_000_000 + secuencia),
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

    async function crearInstitucion(
      datos: Partial<{
        nombre: string
        direccion: string | null
        telefono: string | null
        email: string | null
        logoUrl: string | null
      }> = {},
    ) {
      return prisma.institucion.create({
        data: {
          nombre: 'IE San Martín',
          direccion: 'Av. Los Próceres 123',
          telefono: '01-555-0101',
          email: 'contacto@sanmartin.edu.pe',
          logoUrl: 'https://cdn.sanmartin.edu.pe/logo.png',
          ...datos,
        },
      })
    }

    async function tokenDe(roles: string[]): Promise<string> {
      const usuario = await crearUsuarioConRoles(roles)
      const { token } = await signAccessToken(usuario.id)

      return token
    }

    function consultar(token?: string) {
      const peticion = request(app.server).get('/api/v1/institucion')

      return token ? peticion.set('Authorization', `Bearer ${token}`) : peticion
    }

    function editar(token: string, cuerpo: unknown) {
      return request(app.server)
        .patch('/api/v1/institucion')
        .set('Authorization', `Bearer ${token}`)
        .send(cuerpo as object)
    }

    it('exige autenticación para consultar', async () => {
      const respuesta = await consultar()

      expect(respuesta.status).toBe(401)
      expect(respuesta.body).toMatchObject({
        error: { code: 'UNAUTHORIZED' },
      })
    })

    it('permite consultar al SuperAdmin', async () => {
      await crearInstitucion()
      const token = await tokenDe(['SUPER_ADMIN'])

      const respuesta = await consultar(token)

      expect(respuesta.status).toBe(200)
      expect(respuesta.body).toMatchObject({
        nombre: 'IE San Martín',
        direccion: 'Av. Los Próceres 123',
        telefono: '01-555-0101',
        email: 'contacto@sanmartin.edu.pe',
        logoUrl: 'https://cdn.sanmartin.edu.pe/logo.png',
      })
    })

    it('permite consultar al Director', async () => {
      await crearInstitucion()
      const token = await tokenDe(['DIRECTOR'])

      const respuesta = await consultar(token)

      expect(respuesta.status).toBe(200)
    })

    it('rechaza la consulta de un Docente', async () => {
      await crearInstitucion()
      const token = await tokenDe(['DOCENTE'])

      const respuesta = await consultar(token)

      expect(respuesta.status).toBe(403)
      expect(respuesta.body).toMatchObject({ error: { code: 'FORBIDDEN' } })
    })

    it('rechaza la consulta de Apoderado y Alumno', async () => {
      await crearInstitucion()

      for (const rol of ['APODERADO', 'ALUMNO']) {
        const token = await tokenDe([rol])
        const respuesta = await consultar(token)

        expect(respuesta.status, rol).toBe(403)
      }
    })

    it('devuelve 404 si no hay institución configurada', async () => {
      const token = await tokenDe(['SUPER_ADMIN'])

      const respuesta = await consultar(token)

      expect(respuesta.status).toBe(404)
      expect(respuesta.body).toMatchObject({ error: { code: 'NOT_FOUND' } })
    })

    it('no expone marcas de auditoría ni borrado lógico', async () => {
      await crearInstitucion()
      const token = await tokenDe(['SUPER_ADMIN'])

      const respuesta = await consultar(token)

      expect(respuesta.body).not.toHaveProperty('createdBy')
      expect(respuesta.body).not.toHaveProperty('updatedBy')
      expect(respuesta.body).not.toHaveProperty('deletedAt')
      expect(respuesta.body).not.toHaveProperty('createdAt')
    })

    it('rechaza la edición de un Docente', async () => {
      const institucion = await crearInstitucion()
      const token = await tokenDe(['DOCENTE'])

      const respuesta = await editar(token, { nombre: 'Nombre cambiado' })

      expect(respuesta.status).toBe(403)

      const sinCambios = await prisma.institucion.findUniqueOrThrow({
        where: { id: institucion.id },
      })

      expect(sinCambios.nombre).toBe('IE San Martín')
    })

    it('actualiza los campos enviados, los persiste y registra al editor', async () => {
      const institucion = await crearInstitucion()
      const usuario = await crearUsuarioConRoles(['DIRECTOR'])
      const { token } = await signAccessToken(usuario.id)

      const respuesta = await editar(token, {
        nombre: 'IE San Martín de Porres',
        direccion: null,
        telefono: '01-555-0202',
        email: 'nuevo@sanmartin.edu.pe',
        logoUrl: 'https://cdn.sanmartin.edu.pe/nuevo-logo.png',
      })

      expect(respuesta.status).toBe(200)
      expect(respuesta.body).toMatchObject({
        nombre: 'IE San Martín de Porres',
        direccion: null,
        telefono: '01-555-0202',
        email: 'nuevo@sanmartin.edu.pe',
        logoUrl: 'https://cdn.sanmartin.edu.pe/nuevo-logo.png',
      })

      const persistida = await prisma.institucion.findUniqueOrThrow({
        where: { id: institucion.id },
      })

      expect(persistida.nombre).toBe('IE San Martín de Porres')
      expect(persistida.updatedBy).toBe(usuario.id)
    })

    it('conserva los campos no enviados', async () => {
      await crearInstitucion()
      const token = await tokenDe(['SUPER_ADMIN'])

      const respuesta = await editar(token, { telefono: '01-555-0303' })

      expect(respuesta.status).toBe(200)
      expect(respuesta.body).toMatchObject({
        nombre: 'IE San Martín',
        direccion: 'Av. Los Próceres 123',
        telefono: '01-555-0303',
        email: 'contacto@sanmartin.edu.pe',
      })
    })

    it('permite vaciar campos opcionales con null', async () => {
      await crearInstitucion()
      const token = await tokenDe(['SUPER_ADMIN'])

      const respuesta = await editar(token, {
        direccion: null,
        telefono: null,
        email: null,
        logoUrl: null,
      })

      expect(respuesta.status).toBe(200)
      expect(respuesta.body).toMatchObject({
        nombre: 'IE San Martín',
        direccion: null,
        telefono: null,
        email: null,
        logoUrl: null,
      })
    })

    it('rechaza un correo inválido con 400', async () => {
      await crearInstitucion()
      const token = await tokenDe(['SUPER_ADMIN'])

      const respuesta = await editar(token, { email: 'no-es-un-correo' })

      expect(respuesta.status).toBe(400)
      expect(respuesta.body.error.code).toBe('VALIDATION_ERROR')
      expect(respuesta.body.error.details).toEqual(
        expect.arrayContaining([expect.stringContaining('email')]),
      )
    })

    it('rechaza un cuerpo vacío con 400', async () => {
      await crearInstitucion()
      const token = await tokenDe(['SUPER_ADMIN'])

      const respuesta = await editar(token, {})

      expect(respuesta.status).toBe(400)
      expect(respuesta.body.error.code).toBe('VALIDATION_ERROR')
    })

    it('rechaza un nombre vacío con 400', async () => {
      await crearInstitucion()
      const token = await tokenDe(['SUPER_ADMIN'])

      const respuesta = await editar(token, { nombre: '   ' })

      expect(respuesta.status).toBe(400)
      expect(respuesta.body.error.code).toBe('VALIDATION_ERROR')
    })

    it('rechaza una URL de logo inválida con 400', async () => {
      await crearInstitucion()
      const token = await tokenDe(['SUPER_ADMIN'])

      const respuesta = await editar(token, { logoUrl: 'no-es-url' })

      expect(respuesta.status).toBe(400)
      expect(respuesta.body.error.code).toBe('VALIDATION_ERROR')
    })
  },
)
