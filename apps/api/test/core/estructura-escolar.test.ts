import type { FastifyInstance } from 'fastify'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../../src/app.js'
import { signAccessToken } from '../../src/core/auth/tokens.js'
import { createTestPrisma, limpiarBaseDePruebas } from '../helpers/test-db.js'
import { INSTITUCION_ID } from '../constants.js'

describe.skipIf(!process.env.TEST_DATABASE_URL)('estructura escolar', () => {
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
    return { id: INSTITUCION_ID }
  }

  async function crearNivel(
    institucionId: string,
    nombre = 'Primaria',
    orden = 1,
  ) {
    return prisma.nivel.create({
      data: { institucionId, nombre, orden },
    })
  }

  async function crearGrado(nivelId: string, nombre = '1.°', orden = 1) {
    return prisma.grado.create({
      data: { nivelId, nombre, orden },
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

  async function crearSeccion(
    gradoId: string,
    anioId: string,
    nombre = 'A',
    capacidad: number | null = null,
  ) {
    return prisma.seccion.create({
      data: { gradoId, anioId, nombre, capacidad },
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

  function get(ruta: string, token?: string) {
    const peticion = request(app.server).get(ruta)

    return token ? peticion.set('Authorization', `Bearer ${token}`) : peticion
  }

  function post(ruta: string, token: string, cuerpo: unknown) {
    return request(app.server)
      .post(ruta)
      .set('Authorization', `Bearer ${token}`)
      .send(cuerpo as object)
  }

  function patch(ruta: string, token: string, cuerpo: unknown) {
    return request(app.server)
      .patch(ruta)
      .set('Authorization', `Bearer ${token}`)
      .send(cuerpo as object)
  }

  describe('niveles', () => {
    it('exige autenticación para listar', async () => {
      const respuesta = await get('/api/v1/niveles')

      expect(respuesta.status).toBe(401)
    })

    it('rechaza a un Docente en los nueve endpoints de estructura', async () => {
      const institucion = await crearInstitucion()
      const nivel = await crearNivel(institucion.id)
      const grado = await crearGrado(nivel.id)
      const anio = await crearAnio(institucion.id)
      const seccion = await crearSeccion(grado.id, anio.id)
      const token = await tokenDe(['DOCENTE'])

      const respuestas = [
        await get('/api/v1/niveles', token),
        await post('/api/v1/niveles', token, { nombre: 'Inicial', orden: 2 }),
        await patch(`/api/v1/niveles/${nivel.id}`, token, { orden: 2 }),
        await get('/api/v1/grados', token),
        await post('/api/v1/grados', token, {
          nivelId: nivel.id,
          nombre: '2.°',
          orden: 2,
        }),
        await patch(`/api/v1/grados/${grado.id}`, token, { orden: 2 }),
        await get('/api/v1/secciones', token),
        await post('/api/v1/secciones', token, {
          gradoId: grado.id,
          anioId: anio.id,
          nombre: 'B',
        }),
        await patch(`/api/v1/secciones/${seccion.id}`, token, {
          nombre: 'B',
        }),
      ]

      for (const respuesta of respuestas) {
        expect(respuesta.status).toBe(403)
        expect(respuesta.body).toMatchObject({ error: { code: 'FORBIDDEN' } })
      }
    })

    it('devuelve un listado vacío paginado', async () => {
      await crearInstitucion()
      const token = await tokenDe(['SUPER_ADMIN'])

      const respuesta = await get('/api/v1/niveles', token)

      expect(respuesta.status).toBe(200)
      expect(respuesta.body).toEqual({
        data: [],
        meta: { page: 1, pageSize: 20, total: 0 },
      })
    })

    it('crea un nivel y lo persiste', async () => {
      const institucion = await crearInstitucion()
      const usuario = await crearUsuarioConRoles(['DIRECTOR'])
      const { token } = await signAccessToken(usuario.id)

      const respuesta = await post('/api/v1/niveles', token, {
        nombre: 'Primaria',
        orden: 1,
      })

      expect(respuesta.status).toBe(201)
      expect(respuesta.body).toMatchObject({ nombre: 'Primaria', orden: 1 })

      const persistido = await prisma.nivel.findUniqueOrThrow({
        where: { id: respuesta.body.id },
      })

      expect(persistido.institucionId).toBe(institucion.id)
      expect(persistido.createdBy).toBe(usuario.id)
    })

    it('rechaza un nombre duplicado con 409', async () => {
      const institucion = await crearInstitucion()
      await crearNivel(institucion.id, 'Primaria', 1)
      const token = await tokenDe(['SUPER_ADMIN'])

      const respuesta = await post('/api/v1/niveles', token, {
        nombre: 'Primaria',
        orden: 2,
      })

      expect(respuesta.status).toBe(409)
      expect(respuesta.body).toMatchObject({ error: { code: 'CONFLICT' } })
    })

    it('lista los niveles ordenados por orden', async () => {
      const institucion = await crearInstitucion()

      for (const orden of [3, 1, 2]) {
        await crearNivel(institucion.id, `Nivel ${orden}`, orden)
      }

      const token = await tokenDe(['SUPER_ADMIN'])
      const respuesta = await get('/api/v1/niveles', token)

      expect(respuesta.status).toBe(200)
      expect(
        respuesta.body.data.map((nivel: { orden: number }) => nivel.orden),
      ).toEqual([1, 2, 3])
    })

    it('actualiza parcialmente y conserva los campos no enviados', async () => {
      const institucion = await crearInstitucion()
      const nivel = await crearNivel(institucion.id, 'Primaria', 1)
      const token = await tokenDe(['DIRECTOR'])

      const respuesta = await patch(`/api/v1/niveles/${nivel.id}`, token, {
        nombre: 'Nivel Primaria',
      })

      expect(respuesta.status).toBe(200)
      expect(respuesta.body).toMatchObject({
        nombre: 'Nivel Primaria',
        orden: 1,
      })
    })

    it('rechaza un nombre duplicado al editar con 409', async () => {
      const institucion = await crearInstitucion()
      await crearNivel(institucion.id, 'Primaria', 1)
      const segundo = await crearNivel(institucion.id, 'Secundaria', 2)
      const token = await tokenDe(['SUPER_ADMIN'])

      const respuesta = await patch(`/api/v1/niveles/${segundo.id}`, token, {
        nombre: 'Primaria',
      })

      expect(respuesta.status).toBe(409)
    })

    it('devuelve 404 al editar un nivel inexistente', async () => {
      await crearInstitucion()
      const token = await tokenDe(['SUPER_ADMIN'])

      const respuesta = await patch(
        '/api/v1/niveles/00000000-0000-4000-8000-000000000099',
        token,
        { nombre: 'Inexistente' },
      )

      expect(respuesta.status).toBe(404)
    })

    it('oculta los niveles con borrado lógico', async () => {
      const institucion = await crearInstitucion()
      const nivel = await crearNivel(institucion.id)
      const token = await tokenDe(['SUPER_ADMIN'])

      await prisma.nivel.update({
        where: { id: nivel.id },
        data: { deletedAt: new Date() },
      })

      const listado = await get('/api/v1/niveles', token)
      const edicion = await patch(`/api/v1/niveles/${nivel.id}`, token, {
        orden: 2,
      })

      expect(listado.body.data).toEqual([])
      expect(edicion.status).toBe(404)
    })

    it('rechaza un cuerpo vacío al editar', async () => {
      const institucion = await crearInstitucion()
      const nivel = await crearNivel(institucion.id)
      const token = await tokenDe(['SUPER_ADMIN'])

      const respuesta = await patch(`/api/v1/niveles/${nivel.id}`, token, {})

      expect(respuesta.status).toBe(400)
    })

    it('valida que el nombre no sea vacío', async () => {
      await crearInstitucion()
      const token = await tokenDe(['SUPER_ADMIN'])

      const respuesta = await post('/api/v1/niveles', token, {
        nombre: '   ',
        orden: 1,
      })

      expect(respuesta.status).toBe(400)
      expect(respuesta.body.error.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('grados', () => {
    it('crea un grado asociado a un nivel', async () => {
      const institucion = await crearInstitucion()
      const nivel = await crearNivel(institucion.id)
      const usuario = await crearUsuarioConRoles(['DIRECTOR'])
      const { token } = await signAccessToken(usuario.id)

      const respuesta = await post('/api/v1/grados', token, {
        nivelId: nivel.id,
        nombre: '1.°',
        orden: 1,
      })

      expect(respuesta.status).toBe(201)
      expect(respuesta.body).toMatchObject({
        nivelId: nivel.id,
        nombre: '1.°',
        orden: 1,
      })

      const persistido = await prisma.grado.findUniqueOrThrow({
        where: { id: respuesta.body.id },
      })

      expect(persistido.createdBy).toBe(usuario.id)
    })

    it('devuelve 404 si el nivel no existe', async () => {
      await crearInstitucion()
      const token = await tokenDe(['SUPER_ADMIN'])

      const respuesta = await post('/api/v1/grados', token, {
        nivelId: '00000000-0000-4000-8000-000000000099',
        nombre: '1.°',
        orden: 1,
      })

      expect(respuesta.status).toBe(404)
    })

    it('rechaza un orden duplicado en el mismo nivel con 409', async () => {
      const institucion = await crearInstitucion()
      const nivel = await crearNivel(institucion.id)
      await crearGrado(nivel.id, '1.°', 1)
      const token = await tokenDe(['SUPER_ADMIN'])

      const respuesta = await post('/api/v1/grados', token, {
        nivelId: nivel.id,
        nombre: '2.°',
        orden: 1,
      })

      expect(respuesta.status).toBe(409)
      expect(respuesta.body).toMatchObject({ error: { code: 'CONFLICT' } })
    })

    it('permite el mismo orden en niveles distintos', async () => {
      const institucion = await crearInstitucion()
      const primaria = await crearNivel(institucion.id, 'Primaria', 1)
      const secundaria = await crearNivel(institucion.id, 'Secundaria', 2)
      await crearGrado(primaria.id, '1.°', 1)
      const token = await tokenDe(['SUPER_ADMIN'])

      const respuesta = await post('/api/v1/grados', token, {
        nivelId: secundaria.id,
        nombre: '1.°',
        orden: 1,
      })

      expect(respuesta.status).toBe(201)
    })

    it('lista los grados de un nivel ordenados por orden', async () => {
      const institucion = await crearInstitucion()
      const primaria = await crearNivel(institucion.id, 'Primaria', 1)
      const secundaria = await crearNivel(institucion.id, 'Secundaria', 2)
      await crearGrado(primaria.id, '2.°', 2)
      await crearGrado(primaria.id, '1.°', 1)
      await crearGrado(secundaria.id, '1.°', 1)
      const token = await tokenDe(['SUPER_ADMIN'])

      const respuesta = await get(
        `/api/v1/grados?nivelId=${primaria.id}`,
        token,
      )

      expect(respuesta.status).toBe(200)
      expect(respuesta.body.meta.total).toBe(2)
      expect(
        respuesta.body.data.map((grado: { nombre: string }) => grado.nombre),
      ).toEqual(['1.°', '2.°'])
      expect(
        respuesta.body.data.every(
          (grado: { nivelId: string }) => grado.nivelId === primaria.id,
        ),
      ).toBe(true)
    })

    it('ordena el listado global por nivel y luego por orden', async () => {
      const institucion = await crearInstitucion()
      const primaria = await crearNivel(institucion.id, 'Primaria', 2)
      const inicial = await crearNivel(institucion.id, 'Inicial', 1)
      await crearGrado(primaria.id, '1.°', 1)
      await crearGrado(inicial.id, '3 años', 1)
      const token = await tokenDe(['SUPER_ADMIN'])

      const respuesta = await get('/api/v1/grados', token)

      expect(
        respuesta.body.data.map((grado: { nivelId: string }) => grado.nivelId),
      ).toEqual([inicial.id, primaria.id])
    })

    it('devuelve 404 al filtrar por un nivel inexistente', async () => {
      await crearInstitucion()
      const token = await tokenDe(['SUPER_ADMIN'])

      const respuesta = await get(
        '/api/v1/grados?nivelId=00000000-0000-4000-8000-000000000099',
        token,
      )

      expect(respuesta.status).toBe(404)
    })

    it('actualiza parcialmente y conserva los campos no enviados', async () => {
      const institucion = await crearInstitucion()
      const nivel = await crearNivel(institucion.id)
      const grado = await crearGrado(nivel.id, '1.°', 1)
      const token = await tokenDe(['DIRECTOR'])

      const respuesta = await patch(`/api/v1/grados/${grado.id}`, token, {
        nombre: 'Primero',
      })

      expect(respuesta.status).toBe(200)
      expect(respuesta.body).toMatchObject({
        nivelId: nivel.id,
        nombre: 'Primero',
        orden: 1,
      })
    })

    it('rechaza un orden duplicado al editar con 409', async () => {
      const institucion = await crearInstitucion()
      const nivel = await crearNivel(institucion.id)
      await crearGrado(nivel.id, '1.°', 1)
      const segundo = await crearGrado(nivel.id, '2.°', 2)
      const token = await tokenDe(['SUPER_ADMIN'])

      const respuesta = await patch(`/api/v1/grados/${segundo.id}`, token, {
        orden: 1,
      })

      expect(respuesta.status).toBe(409)
    })

    it('devuelve 404 al editar un grado inexistente', async () => {
      await crearInstitucion()
      const token = await tokenDe(['SUPER_ADMIN'])

      const respuesta = await patch(
        '/api/v1/grados/00000000-0000-4000-8000-000000000099',
        token,
        { nombre: 'Inexistente' },
      )

      expect(respuesta.status).toBe(404)
    })

    it('rechaza un cuerpo vacío al editar', async () => {
      const institucion = await crearInstitucion()
      const nivel = await crearNivel(institucion.id)
      const grado = await crearGrado(nivel.id)
      const token = await tokenDe(['SUPER_ADMIN'])

      const respuesta = await patch(`/api/v1/grados/${grado.id}`, token, {})

      expect(respuesta.status).toBe(400)
    })

    it.skip('no expone grados de otra institución — multi-institution test incompatible with single-institution deployment', async () => {
      const propia = await crearInstitucion('IE Propia')
      const ajena = await crearInstitucion(
        'IE Ajena',
        '2026-01-02T00:00:00.000Z',
      )
      const nivelPropio = await crearNivel(propia.id, 'Primaria', 1)
      const nivelAjeno = await crearNivel(ajena.id, 'Secundaria', 1)
      await crearGrado(nivelPropio.id, '1.°', 1)
      const gradoAjeno = await crearGrado(nivelAjeno.id, '1.°', 1)
      const token = await tokenDe(['SUPER_ADMIN'])

      const listado = await get('/api/v1/grados', token)
      const creacion = await post('/api/v1/grados', token, {
        nivelId: nivelAjeno.id,
        nombre: '2.°',
        orden: 2,
      })
      const edicion = await patch(
        `/api/v1/grados/${gradoAjeno.id}`,
        token,
        { nombre: 'Intruso' },
      )

      expect(listado.body.data).toHaveLength(1)
      expect(listado.body.data[0].nivelId).toBe(nivelPropio.id)
      expect(creacion.status).toBe(404)
      expect(edicion.status).toBe(404)
    })
  })

  describe('secciones', () => {
    it('crea una sección con grado y año', async () => {
      const institucion = await crearInstitucion()
      const nivel = await crearNivel(institucion.id)
      const grado = await crearGrado(nivel.id)
      const anio = await crearAnio(institucion.id)
      const usuario = await crearUsuarioConRoles(['DIRECTOR'])
      const { token } = await signAccessToken(usuario.id)

      const respuesta = await post('/api/v1/secciones', token, {
        gradoId: grado.id,
        anioId: anio.id,
        nombre: 'A',
        capacidad: 30,
      })

      expect(respuesta.status).toBe(201)
      expect(respuesta.body).toMatchObject({
        gradoId: grado.id,
        anioId: anio.id,
        nombre: 'A',
        capacidad: 30,
      })

      const persistido = await prisma.seccion.findUniqueOrThrow({
        where: { id: respuesta.body.id },
      })

      expect(persistido.createdBy).toBe(usuario.id)
    })

    it('crea una sección sin capacidad y la devuelve en null', async () => {
      const institucion = await crearInstitucion()
      const nivel = await crearNivel(institucion.id)
      const grado = await crearGrado(nivel.id)
      const anio = await crearAnio(institucion.id)
      const token = await tokenDe(['SUPER_ADMIN'])

      const respuesta = await post('/api/v1/secciones', token, {
        gradoId: grado.id,
        anioId: anio.id,
        nombre: 'A',
      })

      expect(respuesta.status).toBe(201)
      expect(respuesta.body.capacidad).toBeNull()
    })

    it('devuelve 404 si el grado no existe', async () => {
      const institucion = await crearInstitucion()
      const anio = await crearAnio(institucion.id)
      const token = await tokenDe(['SUPER_ADMIN'])

      const respuesta = await post('/api/v1/secciones', token, {
        gradoId: '00000000-0000-4000-8000-000000000099',
        anioId: anio.id,
        nombre: 'A',
      })

      expect(respuesta.status).toBe(404)
    })

    it('devuelve 404 si el año no existe', async () => {
      const institucion = await crearInstitucion()
      const nivel = await crearNivel(institucion.id)
      const grado = await crearGrado(nivel.id)
      const token = await tokenDe(['SUPER_ADMIN'])

      const respuesta = await post('/api/v1/secciones', token, {
        gradoId: grado.id,
        anioId: '00000000-0000-4000-8000-000000000099',
        nombre: 'A',
      })

      expect(respuesta.status).toBe(404)
    })

    it('rechaza un nombre duplicado en el mismo grado y año con 409', async () => {
      const institucion = await crearInstitucion()
      const nivel = await crearNivel(institucion.id)
      const grado = await crearGrado(nivel.id)
      const anio = await crearAnio(institucion.id)
      await crearSeccion(grado.id, anio.id, 'A')
      const token = await tokenDe(['SUPER_ADMIN'])

      const respuesta = await post('/api/v1/secciones', token, {
        gradoId: grado.id,
        anioId: anio.id,
        nombre: 'A',
      })

      expect(respuesta.status).toBe(409)
      expect(respuesta.body).toMatchObject({ error: { code: 'CONFLICT' } })
    })

    it('permite el mismo nombre en años distintos', async () => {
      const institucion = await crearInstitucion()
      const nivel = await crearNivel(institucion.id)
      const grado = await crearGrado(nivel.id)
      const anio2026 = await crearAnio(institucion.id, '2026')
      const anio2027 = await crearAnio(institucion.id, '2027')
      await crearSeccion(grado.id, anio2026.id, 'A')
      const token = await tokenDe(['SUPER_ADMIN'])

      const respuesta = await post('/api/v1/secciones', token, {
        gradoId: grado.id,
        anioId: anio2027.id,
        nombre: 'A',
      })

      expect(respuesta.status).toBe(201)
    })

    it('lista las secciones filtradas por grado y año', async () => {
      const institucion = await crearInstitucion()
      const nivel = await crearNivel(institucion.id)
      const gradoA = await crearGrado(nivel.id, '1.°', 1)
      const gradoB = await crearGrado(nivel.id, '2.°', 2)
      const anio = await crearAnio(institucion.id)
      const otroAnio = await crearAnio(institucion.id, '2027')
      await crearSeccion(gradoA.id, anio.id, 'B')
      await crearSeccion(gradoA.id, anio.id, 'A')
      await crearSeccion(gradoB.id, anio.id, 'A')
      await crearSeccion(gradoA.id, otroAnio.id, 'A')
      const token = await tokenDe(['SUPER_ADMIN'])

      const respuesta = await get(
        `/api/v1/secciones?gradoId=${gradoA.id}&anioId=${anio.id}`,
        token,
      )

      expect(respuesta.status).toBe(200)
      expect(respuesta.body.meta.total).toBe(2)
      expect(
        respuesta.body.data.map(
          (seccion: { nombre: string }) => seccion.nombre,
        ),
      ).toEqual(['A', 'B'])
    })

    it('devuelve 404 al filtrar por un grado inexistente', async () => {
      const institucion = await crearInstitucion()
      const anio = await crearAnio(institucion.id)
      const token = await tokenDe(['SUPER_ADMIN'])

      const respuesta = await get(
        `/api/v1/secciones?gradoId=00000000-0000-4000-8000-000000000099&anioId=${anio.id}`,
        token,
      )

      expect(respuesta.status).toBe(404)
    })

    it('devuelve 404 al filtrar por un año inexistente', async () => {
      const institucion = await crearInstitucion()
      const nivel = await crearNivel(institucion.id)
      const grado = await crearGrado(nivel.id)
      const token = await tokenDe(['SUPER_ADMIN'])

      const respuesta = await get(
        `/api/v1/secciones?gradoId=${grado.id}&anioId=00000000-0000-4000-8000-000000000099`,
        token,
      )

      expect(respuesta.status).toBe(404)
    })

    it('actualiza el nombre y permite vaciar la capacidad', async () => {
      const institucion = await crearInstitucion()
      const nivel = await crearNivel(institucion.id)
      const grado = await crearGrado(nivel.id)
      const anio = await crearAnio(institucion.id)
      const seccion = await crearSeccion(grado.id, anio.id, 'A', 25)
      const token = await tokenDe(['DIRECTOR'])

      const primera = await patch(
        `/api/v1/secciones/${seccion.id}`,
        token,
        { nombre: 'B' },
      )
      const segunda = await patch(
        `/api/v1/secciones/${seccion.id}`,
        token,
        { capacidad: null },
      )

      expect(primera.status).toBe(200)
      expect(primera.body).toMatchObject({
        nombre: 'B',
        capacidad: 25,
        gradoId: grado.id,
        anioId: anio.id,
      })
      expect(segunda.status).toBe(200)
      expect(segunda.body.capacidad).toBeNull()
    })

    it('rechaza un nombre duplicado al editar con 409', async () => {
      const institucion = await crearInstitucion()
      const nivel = await crearNivel(institucion.id)
      const grado = await crearGrado(nivel.id)
      const anio = await crearAnio(institucion.id)
      await crearSeccion(grado.id, anio.id, 'A')
      const segunda = await crearSeccion(grado.id, anio.id, 'B')
      const token = await tokenDe(['SUPER_ADMIN'])

      const respuesta = await patch(
        `/api/v1/secciones/${segunda.id}`,
        token,
        { nombre: 'A' },
      )

      expect(respuesta.status).toBe(409)
    })

    it('devuelve 404 al editar una sección inexistente', async () => {
      await crearInstitucion()
      const token = await tokenDe(['SUPER_ADMIN'])

      const respuesta = await patch(
        '/api/v1/secciones/00000000-0000-4000-8000-000000000099',
        token,
        { nombre: 'A' },
      )

      expect(respuesta.status).toBe(404)
    })

    it('oculta las secciones con borrado lógico', async () => {
      const institucion = await crearInstitucion()
      const nivel = await crearNivel(institucion.id)
      const grado = await crearGrado(nivel.id)
      const anio = await crearAnio(institucion.id)
      const seccion = await crearSeccion(grado.id, anio.id)
      const token = await tokenDe(['SUPER_ADMIN'])

      await prisma.seccion.update({
        where: { id: seccion.id },
        data: { deletedAt: new Date() },
      })

      const listado = await get('/api/v1/secciones', token)
      const edicion = await patch(
        `/api/v1/secciones/${seccion.id}`,
        token,
        { nombre: 'B' },
      )

      expect(listado.body.data).toEqual([])
      expect(edicion.status).toBe(404)
    })

    it('rechaza una capacidad menor que uno', async () => {
      const institucion = await crearInstitucion()
      const nivel = await crearNivel(institucion.id)
      const grado = await crearGrado(nivel.id)
      const anio = await crearAnio(institucion.id)
      const token = await tokenDe(['SUPER_ADMIN'])

      const respuesta = await post('/api/v1/secciones', token, {
        gradoId: grado.id,
        anioId: anio.id,
        nombre: 'A',
        capacidad: 0,
      })

      expect(respuesta.status).toBe(400)
    })

    it('rechaza un cuerpo vacío al editar', async () => {
      const institucion = await crearInstitucion()
      const nivel = await crearNivel(institucion.id)
      const grado = await crearGrado(nivel.id)
      const anio = await crearAnio(institucion.id)
      const seccion = await crearSeccion(grado.id, anio.id)
      const token = await tokenDe(['SUPER_ADMIN'])

      const respuesta = await patch(
        `/api/v1/secciones/${seccion.id}`,
        token,
        {},
      )

      expect(respuesta.status).toBe(400)
    })
  })
})
