import type { FastifyInstance } from 'fastify'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../../src/app.js'
import { signAccessToken } from '../../src/core/auth/tokens.js'
import { createTestPrisma, limpiarBaseDePruebas } from '../helpers/test-db.js'

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'años académicos',
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

    async function crearUsuarioConRoles(roles: string[]) {
      secuencia += 1

      const persona = await prisma.persona.create({
        data: {
          nombres: `Usuario${secuencia}`,
          apellidos: 'De Prueba',
          tipoDocumento: 'DNI',
          numeroDocumento: String(30_000_000 + secuencia),
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

    async function crearAnio(
      institucionId: string,
      datos: {
        nombre: string
        fechaInicio: string
        fechaFin: string
        estado?: string
      },
    ) {
      return prisma.anioAcademico.create({
        data: {
          institucionId,
          nombre: datos.nombre,
          fechaInicio: new Date(`${datos.fechaInicio}T00:00:00.000Z`),
          fechaFin: new Date(`${datos.fechaFin}T00:00:00.000Z`),
          estado: datos.estado ?? 'PLANIFICADO',
        },
      })
    }

    function listar(token?: string, query = '') {
      const peticion = request(app.server).get(
        `/api/v1/anios-academicos${query}`,
      )

      return token ? peticion.set('Authorization', `Bearer ${token}`) : peticion
    }

    function crear(token: string, cuerpo: unknown) {
      return request(app.server)
        .post('/api/v1/anios-academicos')
        .set('Authorization', `Bearer ${token}`)
        .send(cuerpo as object)
    }

    function actualizar(token: string, id: string, cuerpo: unknown) {
      return request(app.server)
        .patch(`/api/v1/anios-academicos/${id}`)
        .set('Authorization', `Bearer ${token}`)
        .send(cuerpo as object)
    }

    function activar(token: string, id: string) {
      return request(app.server)
        .post(`/api/v1/anios-academicos/${id}/activar`)
        .set('Authorization', `Bearer ${token}`)
    }

    it('exige autenticación para listar', async () => {
      const respuesta = await listar()

      expect(respuesta.status).toBe(401)
    })

    it('rechaza a un Docente en todos los endpoints de escritura y lectura', async () => {
      const institucion = await crearInstitucion()
      const anio = await crearAnio(institucion.id, {
        nombre: '2026',
        fechaInicio: '2026-03-01',
        fechaFin: '2026-12-15',
      })
      const token = await tokenDe(['DOCENTE'])

      const listado = await listar(token)
      const creacion = await crear(token, {
        nombre: '2027',
        fechaInicio: '2027-03-01',
        fechaFin: '2027-12-15',
      })
      const edicion = await actualizar(token, anio.id, { nombre: '2026-B' })
      const activacion = await activar(token, anio.id)

      for (const respuesta of [listado, creacion, edicion, activacion]) {
        expect(respuesta.status).toBe(403)
        expect(respuesta.body).toMatchObject({ error: { code: 'FORBIDDEN' } })
      }
    })

    it('devuelve un listado vacío paginado', async () => {
      await crearInstitucion()
      const token = await tokenDe(['SUPER_ADMIN'])

      const respuesta = await listar(token)

      expect(respuesta.status).toBe(200)
      expect(respuesta.body).toEqual({
        data: [],
        meta: { page: 1, pageSize: 20, total: 0 },
      })
    })

    it('crea un año en estado PLANIFICADO y lo persiste', async () => {
      const institucion = await crearInstitucion()
      const usuario = await crearUsuarioConRoles(['DIRECTOR'])
      const { token } = await signAccessToken(usuario.id)

      const respuesta = await crear(token, {
        nombre: '2026',
        fechaInicio: '2026-03-01',
        fechaFin: '2026-12-15',
      })

      expect(respuesta.status).toBe(201)
      expect(respuesta.body).toMatchObject({
        nombre: '2026',
        fechaInicio: '2026-03-01',
        fechaFin: '2026-12-15',
        estado: 'PLANIFICADO',
      })
      expect(respuesta.body).not.toHaveProperty('institucionId')

      const persistido = await prisma.anioAcademico.findUniqueOrThrow({
        where: { id: respuesta.body.id },
      })

      expect(persistido.institucionId).toBe(institucion.id)
      expect(persistido.createdBy).toBe(usuario.id)
      expect(persistido.estado).toBe('PLANIFICADO')
    })

    it('ignora un estado enviado en la creación', async () => {
      await crearInstitucion()
      const token = await tokenDe(['SUPER_ADMIN'])

      const respuesta = await crear(token, {
        nombre: '2026',
        fechaInicio: '2026-03-01',
        fechaFin: '2026-12-15',
        estado: 'ACTIVO',
      })

      expect(respuesta.status).toBe(201)
      expect(respuesta.body.estado).toBe('PLANIFICADO')
    })

    it('rechaza un nombre duplicado con 409', async () => {
      const institucion = await crearInstitucion()
      await crearAnio(institucion.id, {
        nombre: '2026',
        fechaInicio: '2026-03-01',
        fechaFin: '2026-12-15',
      })
      const token = await tokenDe(['SUPER_ADMIN'])

      const respuesta = await crear(token, {
        nombre: '2026',
        fechaInicio: '2026-03-01',
        fechaFin: '2026-12-15',
      })

      expect(respuesta.status).toBe(409)
      expect(respuesta.body).toMatchObject({ error: { code: 'CONFLICT' } })
    })

    it('rechaza fechas invertidas al crear', async () => {
      await crearInstitucion()
      const token = await tokenDe(['SUPER_ADMIN'])

      const respuesta = await crear(token, {
        nombre: '2026',
        fechaInicio: '2026-12-15',
        fechaFin: '2026-03-01',
      })

      expect(respuesta.status).toBe(400)
      expect(respuesta.body.error.code).toBe('VALIDATION_ERROR')
    })

    it('rechaza una fecha con formato inválido', async () => {
      await crearInstitucion()
      const token = await tokenDe(['SUPER_ADMIN'])

      const respuesta = await crear(token, {
        nombre: '2026',
        fechaInicio: '15/03/2026',
        fechaFin: '2026-12-15',
      })

      expect(respuesta.status).toBe(400)
      expect(respuesta.body.error.code).toBe('VALIDATION_ERROR')
    })

    it('devuelve 404 al crear si no hay institución', async () => {
      const token = await tokenDe(['SUPER_ADMIN'])

      const respuesta = await crear(token, {
        nombre: '2026',
        fechaInicio: '2026-03-01',
        fechaFin: '2026-12-15',
      })

      expect(respuesta.status).toBe(404)
      expect(respuesta.body).toMatchObject({ error: { code: 'NOT_FOUND' } })
    })

    it('actualiza parcialmente y conserva los campos no enviados', async () => {
      const institucion = await crearInstitucion()
      const anio = await crearAnio(institucion.id, {
        nombre: '2026',
        fechaInicio: '2026-03-01',
        fechaFin: '2026-12-15',
      })
      const token = await tokenDe(['DIRECTOR'])

      const respuesta = await actualizar(token, anio.id, {
        nombre: '2026-B',
        fechaFin: '2026-12-20',
      })

      expect(respuesta.status).toBe(200)
      expect(respuesta.body).toMatchObject({
        nombre: '2026-B',
        fechaInicio: '2026-03-01',
        fechaFin: '2026-12-20',
        estado: 'PLANIFICADO',
      })
    })

    it('rechaza un rango invertido al cambiar solo fechaFin', async () => {
      const institucion = await crearInstitucion()
      const anio = await crearAnio(institucion.id, {
        nombre: '2026',
        fechaInicio: '2026-03-01',
        fechaFin: '2026-12-15',
      })
      const token = await tokenDe(['SUPER_ADMIN'])

      const respuesta = await actualizar(token, anio.id, {
        fechaFin: '2026-02-01',
      })

      expect(respuesta.status).toBe(400)
      expect(respuesta.body.error.code).toBe('VALIDATION_ERROR')
    })

    it('rechaza un nombre duplicado al editar con 409', async () => {
      const institucion = await crearInstitucion()
      await crearAnio(institucion.id, {
        nombre: '2026',
        fechaInicio: '2026-03-01',
        fechaFin: '2026-12-15',
      })
      const anio = await crearAnio(institucion.id, {
        nombre: '2027',
        fechaInicio: '2027-03-01',
        fechaFin: '2027-12-15',
      })
      const token = await tokenDe(['SUPER_ADMIN'])

      const respuesta = await actualizar(token, anio.id, { nombre: '2026' })

      expect(respuesta.status).toBe(409)
      expect(respuesta.body).toMatchObject({ error: { code: 'CONFLICT' } })
    })

    it('devuelve 404 al editar un año inexistente', async () => {
      const token = await tokenDe(['SUPER_ADMIN'])

      const respuesta = await actualizar(
        token,
        '00000000-0000-4000-8000-000000000099',
        { nombre: '2026' },
      )

      expect(respuesta.status).toBe(404)
    })

    it('rechaza un cuerpo vacío al editar', async () => {
      const institucion = await crearInstitucion()
      const anio = await crearAnio(institucion.id, {
        nombre: '2026',
        fechaInicio: '2026-03-01',
        fechaFin: '2026-12-15',
      })
      const token = await tokenDe(['SUPER_ADMIN'])

      const respuesta = await actualizar(token, anio.id, {})

      expect(respuesta.status).toBe(400)
    })

    it('activa un año y cierra el anterior en la misma operación', async () => {
      const institucion = await crearInstitucion()
      const primero = await crearAnio(institucion.id, {
        nombre: '2026',
        fechaInicio: '2026-03-01',
        fechaFin: '2026-12-15',
      })
      const segundo = await crearAnio(institucion.id, {
        nombre: '2027',
        fechaInicio: '2027-03-01',
        fechaFin: '2027-12-15',
      })
      const token = await tokenDe(['SUPER_ADMIN'])

      const activacionPrimero = await activar(token, primero.id)
      expect(activacionPrimero.status).toBe(200)
      expect(activacionPrimero.body.estado).toBe('ACTIVO')

      const activacionSegundo = await activar(token, segundo.id)
      expect(activacionSegundo.status).toBe(200)
      expect(activacionSegundo.body.estado).toBe('ACTIVO')

      const filas = await prisma.anioAcademico.findMany({
        where: { institucionId: institucion.id },
        orderBy: { nombre: 'asc' },
      })

      expect(filas).toHaveLength(2)
      expect(filas[0]).toMatchObject({ nombre: '2026', estado: 'CERRADO' })
      expect(filas[1]).toMatchObject({ nombre: '2027', estado: 'ACTIVO' })
    })

    it('es idempotente al activar el año que ya está activo', async () => {
      const institucion = await crearInstitucion()
      const anio = await crearAnio(institucion.id, {
        nombre: '2026',
        fechaInicio: '2026-03-01',
        fechaFin: '2026-12-15',
      })
      const token = await tokenDe(['SUPER_ADMIN'])

      const primera = await activar(token, anio.id)
      const segunda = await activar(token, anio.id)

      expect(primera.status).toBe(200)
      expect(segunda.status).toBe(200)
      expect(segunda.body.estado).toBe('ACTIVO')
    })

    it('devuelve 404 al activar un año inexistente', async () => {
      const token = await tokenDe(['SUPER_ADMIN'])

      const respuesta = await activar(
        token,
        '00000000-0000-4000-8000-000000000099',
      )

      expect(respuesta.status).toBe(404)
    })

    it('mantiene un solo año activo bajo activaciones concurrentes', async () => {
      const institucion = await crearInstitucion()
      const primero = await crearAnio(institucion.id, {
        nombre: '2026',
        fechaInicio: '2026-03-01',
        fechaFin: '2026-12-15',
      })
      const segundo = await crearAnio(institucion.id, {
        nombre: '2027',
        fechaInicio: '2027-03-01',
        fechaFin: '2027-12-15',
      })
      const token = await tokenDe(['SUPER_ADMIN'])

      const [r1, r2] = await Promise.all([
        activar(token, primero.id),
        activar(token, segundo.id),
      ])

      expect(r1.status).toBe(200)
      expect(r2.status).toBe(200)

      const activos = await prisma.anioAcademico.findMany({
        where: { institucionId: institucion.id, estado: 'ACTIVO' },
      })

      expect(activos).toHaveLength(1)
    }, 15_000)

    it('pagina el listado con metadatos', async () => {
      const institucion = await crearInstitucion()
      await crearAnio(institucion.id, {
        nombre: '2024',
        fechaInicio: '2024-03-01',
        fechaFin: '2024-12-15',
      })
      await crearAnio(institucion.id, {
        nombre: '2025',
        fechaInicio: '2025-03-01',
        fechaFin: '2025-12-15',
      })
      await crearAnio(institucion.id, {
        nombre: '2026',
        fechaInicio: '2026-03-01',
        fechaFin: '2026-12-15',
      })
      const token = await tokenDe(['SUPER_ADMIN'])

      const respuesta = await listar(token, '?page=2&pageSize=1')

      expect(respuesta.status).toBe(200)
      expect(respuesta.body.meta).toEqual({
        page: 2,
        pageSize: 1,
        total: 3,
      })
      expect(respuesta.body.data).toHaveLength(1)
      expect(respuesta.body.data[0].nombre).toBe('2025')
    })

    it('excluye los años con borrado lógico', async () => {
      const institucion = await crearInstitucion()
      const anio = await crearAnio(institucion.id, {
        nombre: '2026',
        fechaInicio: '2026-03-01',
        fechaFin: '2026-12-15',
      })
      const token = await tokenDe(['SUPER_ADMIN'])

      await prisma.anioAcademico.update({
        where: { id: anio.id },
        data: { deletedAt: new Date() },
      })

      const respuesta = await listar(token)

      expect(respuesta.status).toBe(200)
      expect(respuesta.body.data).toEqual([])
      expect(respuesta.body.meta.total).toBe(0)
    })
  },
)
