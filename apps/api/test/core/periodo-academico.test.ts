import type { FastifyInstance } from 'fastify'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../../src/app.js'
import { signAccessToken } from '../../src/core/auth/tokens.js'
import { createTestPrisma, limpiarBaseDePruebas } from '../helpers/test-db.js'

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'períodos académicos',
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

    async function crearInstitucion() {
      return prisma.institucion.create({
        data: { nombre: 'IE San Martín' },
      })
    }

    async function crearAnio(institucionId: string, nombre = '2026') {
      return prisma.anioAcademico.create({
        data: {
          institucionId,
          nombre,
          fechaInicio: new Date('2026-03-01T00:00:00.000Z'),
          fechaFin: new Date('2026-12-15T00:00:00.000Z'),
        },
      })
    }

    async function crearUsuarioConRoles(roles: string[]) {
      secuencia += 1

      const persona = await prisma.persona.create({
        data: {
          nombres: `Usuario${secuencia}`,
          apellidos: 'De Prueba',
          tipoDocumento: 'DNI',
          numeroDocumento: String(40_000_000 + secuencia),
        },
      })

      const usuario = await prisma.usuario.create({
        data: {
          personaId: persona.id,
          username: `usuario.${secuencia}`,
          email: `usuario.${secuencia}@ejemplo.edu.pe`,
          passwordHash: '$argon2id$hash-de-prueba',
          debeCambiarPassword: false,
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

    async function crearPeriodo(
      anioId: string,
      datos: {
        nombre: string
        orden: number
        fechaInicio?: string
        fechaFin?: string
        estado?: string
      },
    ) {
      return prisma.periodoAcademico.create({
        data: {
          anioId,
          nombre: datos.nombre,
          orden: datos.orden,
          fechaInicio: new Date(
            `${datos.fechaInicio ?? '2026-03-01'}T00:00:00.000Z`,
          ),
          fechaFin: new Date(`${datos.fechaFin ?? '2026-04-15'}T00:00:00.000Z`),
          estado: datos.estado ?? 'PLANIFICADO',
        },
      })
    }

    function listar(token: string | undefined, anioId: string, query = '') {
      const peticion = request(app.server).get(
        `/api/v1/anios-academicos/${anioId}/periodos${query}`,
      )

      return token ? peticion.set('Authorization', `Bearer ${token}`) : peticion
    }

    function crear(token: string, anioId: string, cuerpo: unknown) {
      return request(app.server)
        .post(`/api/v1/anios-academicos/${anioId}/periodos`)
        .set('Authorization', `Bearer ${token}`)
        .send(cuerpo as object)
    }

    function actualizar(token: string, id: string, cuerpo: unknown) {
      return request(app.server)
        .patch(`/api/v1/periodos/${id}`)
        .set('Authorization', `Bearer ${token}`)
        .send(cuerpo as object)
    }

    function cerrar(token: string, id: string) {
      return request(app.server)
        .post(`/api/v1/periodos/${id}/cerrar`)
        .set('Authorization', `Bearer ${token}`)
    }

    it('exige autenticación para listar', async () => {
      const institucion = await crearInstitucion()
      const anio = await crearAnio(institucion.id)

      const respuesta = await listar(undefined, anio.id)

      expect(respuesta.status).toBe(401)
    })

    it('rechaza a un Docente en todos los endpoints', async () => {
      const institucion = await crearInstitucion()
      const anio = await crearAnio(institucion.id)
      const periodo = await crearPeriodo(anio.id, {
        nombre: 'Bimestre 1',
        orden: 1,
      })
      const token = await tokenDe(['DOCENTE'])

      const listado = await listar(token, anio.id)
      const creacion = await crear(token, anio.id, {
        nombre: 'Bimestre 2',
        orden: 2,
        fechaInicio: '2026-05-01',
        fechaFin: '2026-06-15',
      })
      const edicion = await actualizar(token, periodo.id, {
        nombre: 'Bimestre 1-B',
      })
      const cierre = await cerrar(token, periodo.id)

      for (const respuesta of [listado, creacion, edicion, cierre]) {
        expect(respuesta.status).toBe(403)
        expect(respuesta.body).toMatchObject({ error: { code: 'FORBIDDEN' } })
      }
    })

    it('devuelve un listado vacío paginado', async () => {
      const institucion = await crearInstitucion()
      const anio = await crearAnio(institucion.id)
      const token = await tokenDe(['SUPER_ADMIN'])

      const respuesta = await listar(token, anio.id)

      expect(respuesta.status).toBe(200)
      expect(respuesta.body).toEqual({
        data: [],
        meta: { page: 1, pageSize: 20, total: 0 },
      })
    })

    it('crea un período PLANIFICADO y lo persiste', async () => {
      const institucion = await crearInstitucion()
      const anio = await crearAnio(institucion.id)
      const usuario = await crearUsuarioConRoles(['DIRECTOR'])
      const { token } = await signAccessToken(usuario.id)

      const respuesta = await crear(token, anio.id, {
        nombre: 'Bimestre 1',
        orden: 1,
        fechaInicio: '2026-03-01',
        fechaFin: '2026-04-15',
      })

      expect(respuesta.status).toBe(201)
      expect(respuesta.body).toMatchObject({
        anioId: anio.id,
        nombre: 'Bimestre 1',
        orden: 1,
        fechaInicio: '2026-03-01',
        fechaFin: '2026-04-15',
        estado: 'PLANIFICADO',
      })

      const persistido = await prisma.periodoAcademico.findUniqueOrThrow({
        where: { id: respuesta.body.id },
      })

      expect(persistido.createdBy).toBe(usuario.id)
    })

    it('rechaza un orden duplicado con 409', async () => {
      const institucion = await crearInstitucion()
      const anio = await crearAnio(institucion.id)
      await crearPeriodo(anio.id, { nombre: 'Bimestre 1', orden: 1 })
      const token = await tokenDe(['SUPER_ADMIN'])

      const respuesta = await crear(token, anio.id, {
        nombre: 'Bimestre 2',
        orden: 1,
        fechaInicio: '2026-05-01',
        fechaFin: '2026-06-15',
      })

      expect(respuesta.status).toBe(409)
      expect(respuesta.body).toMatchObject({ error: { code: 'CONFLICT' } })
    })

    it('rechaza un nombre duplicado con 409', async () => {
      const institucion = await crearInstitucion()
      const anio = await crearAnio(institucion.id)
      await crearPeriodo(anio.id, { nombre: 'Bimestre 1', orden: 1 })
      const token = await tokenDe(['SUPER_ADMIN'])

      const respuesta = await crear(token, anio.id, {
        nombre: 'Bimestre 1',
        orden: 2,
        fechaInicio: '2026-05-01',
        fechaFin: '2026-06-15',
      })

      expect(respuesta.status).toBe(409)
    })

    it('rechaza fechas invertidas al crear', async () => {
      const institucion = await crearInstitucion()
      const anio = await crearAnio(institucion.id)
      const token = await tokenDe(['SUPER_ADMIN'])

      const respuesta = await crear(token, anio.id, {
        nombre: 'Bimestre 1',
        orden: 1,
        fechaInicio: '2026-04-15',
        fechaFin: '2026-03-01',
      })

      expect(respuesta.status).toBe(400)
      expect(respuesta.body.error.code).toBe('VALIDATION_ERROR')
    })

    it('devuelve 404 si el año no existe', async () => {
      const token = await tokenDe(['SUPER_ADMIN'])

      const respuesta = await crear(
        token,
        '00000000-0000-4000-8000-000000000099',
        {
          nombre: 'Bimestre 1',
          orden: 1,
          fechaInicio: '2026-03-01',
          fechaFin: '2026-04-15',
        },
      )

      expect(respuesta.status).toBe(404)
    })

    it('devuelve 404 si el año tiene borrado lógico', async () => {
      const institucion = await crearInstitucion()
      const anio = await crearAnio(institucion.id)
      const token = await tokenDe(['SUPER_ADMIN'])

      await prisma.anioAcademico.update({
        where: { id: anio.id },
        data: { deletedAt: new Date() },
      })

      const listado = await listar(token, anio.id)
      const creacion = await crear(token, anio.id, {
        nombre: 'Bimestre 1',
        orden: 1,
        fechaInicio: '2026-03-01',
        fechaFin: '2026-04-15',
      })

      expect(listado.status).toBe(404)
      expect(creacion.status).toBe(404)
    })

    it('lista cuatro períodos ordenados del 1 al 4', async () => {
      const institucion = await crearInstitucion()
      const anio = await crearAnio(institucion.id)

      for (const orden of [3, 1, 4, 2]) {
        await crearPeriodo(anio.id, {
          nombre: `Bimestre ${orden}`,
          orden,
        })
      }

      const token = await tokenDe(['SUPER_ADMIN'])
      const respuesta = await listar(token, anio.id)

      expect(respuesta.status).toBe(200)
      expect(respuesta.body.meta.total).toBe(4)
      expect(
        respuesta.body.data.map((periodo: { orden: number }) => periodo.orden),
      ).toEqual([1, 2, 3, 4])
    })

    it('lista tres períodos ordenados del 1 al 3', async () => {
      const institucion = await crearInstitucion()
      const anio = await crearAnio(institucion.id)

      for (const orden of [2, 3, 1]) {
        await crearPeriodo(anio.id, {
          nombre: `Trimestre ${orden}`,
          orden,
        })
      }

      const token = await tokenDe(['SUPER_ADMIN'])
      const respuesta = await listar(token, anio.id)

      expect(respuesta.status).toBe(200)
      expect(respuesta.body.meta.total).toBe(3)
      expect(
        respuesta.body.data.map((periodo: { orden: number }) => periodo.orden),
      ).toEqual([1, 2, 3])
    })

    it('pagina el listado con metadatos', async () => {
      const institucion = await crearInstitucion()
      const anio = await crearAnio(institucion.id)

      for (const orden of [1, 2, 3]) {
        await crearPeriodo(anio.id, {
          nombre: `Bimestre ${orden}`,
          orden,
        })
      }

      const token = await tokenDe(['SUPER_ADMIN'])
      const respuesta = await listar(token, anio.id, '?page=2&pageSize=1')

      expect(respuesta.status).toBe(200)
      expect(respuesta.body.meta).toEqual({
        page: 2,
        pageSize: 1,
        total: 3,
      })
      expect(respuesta.body.data).toHaveLength(1)
      expect(respuesta.body.data[0].orden).toBe(2)
    })

    it('actualiza parcialmente y conserva los campos no enviados', async () => {
      const institucion = await crearInstitucion()
      const anio = await crearAnio(institucion.id)
      const periodo = await crearPeriodo(anio.id, {
        nombre: 'Bimestre 1',
        orden: 1,
      })
      const token = await tokenDe(['DIRECTOR'])

      const respuesta = await actualizar(token, periodo.id, {
        nombre: 'Primer bimestre',
        fechaFin: '2026-04-20',
      })

      expect(respuesta.status).toBe(200)
      expect(respuesta.body).toMatchObject({
        nombre: 'Primer bimestre',
        orden: 1,
        fechaInicio: '2026-03-01',
        fechaFin: '2026-04-20',
        estado: 'PLANIFICADO',
      })
    })

    it('bloquea la edición de un período CERRADO con 409', async () => {
      const institucion = await crearInstitucion()
      const anio = await crearAnio(institucion.id)
      const periodo = await crearPeriodo(anio.id, {
        nombre: 'Bimestre 1',
        orden: 1,
        estado: 'CERRADO',
      })
      const token = await tokenDe(['SUPER_ADMIN'])

      const respuesta = await actualizar(token, periodo.id, {
        nombre: 'Intento de cambio',
      })

      expect(respuesta.status).toBe(409)
      expect(respuesta.body).toMatchObject({ error: { code: 'CONFLICT' } })

      const persistido = await prisma.periodoAcademico.findUniqueOrThrow({
        where: { id: periodo.id },
      })

      expect(persistido.nombre).toBe('Bimestre 1')
    })

    it('rechaza un orden duplicado al editar con 409', async () => {
      const institucion = await crearInstitucion()
      const anio = await crearAnio(institucion.id)
      await crearPeriodo(anio.id, { nombre: 'Bimestre 1', orden: 1 })
      const segundo = await crearPeriodo(anio.id, {
        nombre: 'Bimestre 2',
        orden: 2,
      })
      const token = await tokenDe(['SUPER_ADMIN'])

      const respuesta = await actualizar(token, segundo.id, { orden: 1 })

      expect(respuesta.status).toBe(409)
    })

    it('devuelve 404 al editar un período inexistente', async () => {
      const token = await tokenDe(['SUPER_ADMIN'])

      const respuesta = await actualizar(
        token,
        '00000000-0000-4000-8000-000000000099',
        { nombre: 'Bimestre 1' },
      )

      expect(respuesta.status).toBe(404)
    })

    it('rechaza un cuerpo vacío al editar', async () => {
      const institucion = await crearInstitucion()
      const anio = await crearAnio(institucion.id)
      const periodo = await crearPeriodo(anio.id, {
        nombre: 'Bimestre 1',
        orden: 1,
      })
      const token = await tokenDe(['SUPER_ADMIN'])

      const respuesta = await actualizar(token, periodo.id, {})

      expect(respuesta.status).toBe(400)
    })

    it('cierra un período y lo persiste', async () => {
      const institucion = await crearInstitucion()
      const anio = await crearAnio(institucion.id)
      const periodo = await crearPeriodo(anio.id, {
        nombre: 'Bimestre 1',
        orden: 1,
      })
      const usuario = await crearUsuarioConRoles(['SUPER_ADMIN'])
      const { token } = await signAccessToken(usuario.id)

      const respuesta = await cerrar(token, periodo.id)

      expect(respuesta.status).toBe(200)
      expect(respuesta.body.estado).toBe('CERRADO')

      const persistido = await prisma.periodoAcademico.findUniqueOrThrow({
        where: { id: periodo.id },
      })

      expect(persistido.estado).toBe('CERRADO')
      expect(persistido.updatedBy).toBe(usuario.id)
    })

    it('no cierra los demás períodos al cerrar uno', async () => {
      const institucion = await crearInstitucion()
      const anio = await crearAnio(institucion.id)
      const primero = await crearPeriodo(anio.id, {
        nombre: 'Bimestre 1',
        orden: 1,
      })
      const segundo = await crearPeriodo(anio.id, {
        nombre: 'Bimestre 2',
        orden: 2,
      })
      const token = await tokenDe(['SUPER_ADMIN'])

      await cerrar(token, primero.id)

      const otro = await prisma.periodoAcademico.findUniqueOrThrow({
        where: { id: segundo.id },
      })

      expect(otro.estado).toBe('PLANIFICADO')
    })

    it('es idempotente al cerrar un período ya cerrado', async () => {
      const institucion = await crearInstitucion()
      const anio = await crearAnio(institucion.id)
      const periodo = await crearPeriodo(anio.id, {
        nombre: 'Bimestre 1',
        orden: 1,
      })
      const token = await tokenDe(['SUPER_ADMIN'])

      const primera = await cerrar(token, periodo.id)
      const segunda = await cerrar(token, periodo.id)

      expect(primera.status).toBe(200)
      expect(segunda.status).toBe(200)
      expect(segunda.body.estado).toBe('CERRADO')
    })

    it('devuelve 404 al cerrar un período inexistente', async () => {
      const token = await tokenDe(['SUPER_ADMIN'])

      const respuesta = await cerrar(
        token,
        '00000000-0000-4000-8000-000000000099',
      )

      expect(respuesta.status).toBe(404)
    })
  },
)
