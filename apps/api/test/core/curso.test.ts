import type { FastifyInstance } from 'fastify'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../../src/app.js'
import { signAccessToken } from '../../src/core/auth/tokens.js'
import { createTestPrisma, limpiarBaseDePruebas } from '../helpers/test-db.js'

describe.skipIf(!process.env.TEST_DATABASE_URL)('cursos', () => {
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

  async function crearInstitucion(
    nombre = 'IE San Martín',
    createdAt = '2026-01-01T00:00:00.000Z',
  ) {
    return prisma.institucion.create({
      data: { nombre, createdAt: new Date(createdAt) },
    })
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

  async function crearCurso(
    nivelId: string,
    nombre = 'Matemática',
    orden = 1,
  ) {
    return prisma.curso.create({
      data: { nivelId, nombre, orden },
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

  it('exige autenticación para listar', async () => {
    const respuesta = await get('/api/v1/cursos')

    expect(respuesta.status).toBe(401)
  })

  it('rechaza a un Docente en todos los endpoints', async () => {
    const institucion = await crearInstitucion()
    const nivel = await crearNivel(institucion.id)
    const curso = await crearCurso(nivel.id)
    const token = await tokenDe(['DOCENTE'])

    const respuestas = [
      await get('/api/v1/cursos', token),
      await post('/api/v1/cursos', token, {
        nivelId: nivel.id,
        nombre: 'Comunicación',
        orden: 2,
      }),
      await patch(`/api/v1/cursos/${curso.id}`, token, { orden: 2 }),
    ]

    for (const respuesta of respuestas) {
      expect(respuesta.status).toBe(403)
      expect(respuesta.body).toMatchObject({ error: { code: 'FORBIDDEN' } })
    }
  })

  it('devuelve un listado vacío paginado', async () => {
    await crearInstitucion()
    const token = await tokenDe(['SUPER_ADMIN'])

    const respuesta = await get('/api/v1/cursos', token)

    expect(respuesta.status).toBe(200)
    expect(respuesta.body).toEqual({
      data: [],
      meta: { page: 1, pageSize: 20, total: 0 },
    })
  })

  it('crea un curso con área y lo persiste', async () => {
    const institucion = await crearInstitucion()
    const nivel = await crearNivel(institucion.id)
    const usuario = await crearUsuarioConRoles(['DIRECTOR'])
    const { token } = await signAccessToken(usuario.id)

    const respuesta = await post('/api/v1/cursos', token, {
      nivelId: nivel.id,
      nombre: 'Matemática',
      area: 'Ciencia y Tecnología',
      orden: 1,
    })

    expect(respuesta.status).toBe(201)
    expect(respuesta.body).toMatchObject({
      nivelId: nivel.id,
      nombre: 'Matemática',
      area: 'Ciencia y Tecnología',
      orden: 1,
    })

    const persistido = await prisma.curso.findUniqueOrThrow({
      where: { id: respuesta.body.id },
    })

    expect(persistido.createdBy).toBe(usuario.id)
  })

  it('crea un curso sin área y la devuelve en null', async () => {
    const institucion = await crearInstitucion()
    const nivel = await crearNivel(institucion.id)
    const token = await tokenDe(['SUPER_ADMIN'])

    const respuesta = await post('/api/v1/cursos', token, {
      nivelId: nivel.id,
      nombre: 'Comunicación',
      orden: 2,
    })

    expect(respuesta.status).toBe(201)
    expect(respuesta.body.area).toBeNull()
  })

  it('devuelve 404 si el nivel no existe', async () => {
    await crearInstitucion()
    const token = await tokenDe(['SUPER_ADMIN'])

    const respuesta = await post('/api/v1/cursos', token, {
      nivelId: '00000000-0000-4000-8000-000000000099',
      nombre: 'Matemática',
      orden: 1,
    })

    expect(respuesta.status).toBe(404)
  })

  it('rechaza un nombre duplicado en el mismo nivel con 409', async () => {
    const institucion = await crearInstitucion()
    const nivel = await crearNivel(institucion.id)
    await crearCurso(nivel.id, 'Matemática', 1)
    const token = await tokenDe(['SUPER_ADMIN'])

    const respuesta = await post('/api/v1/cursos', token, {
      nivelId: nivel.id,
      nombre: 'Matemática',
      orden: 2,
    })

    expect(respuesta.status).toBe(409)
    expect(respuesta.body).toMatchObject({ error: { code: 'CONFLICT' } })
  })

  it('permite el mismo nombre en niveles distintos', async () => {
    const institucion = await crearInstitucion()
    const primaria = await crearNivel(institucion.id, 'Primaria', 1)
    const secundaria = await crearNivel(institucion.id, 'Secundaria', 2)
    await crearCurso(primaria.id, 'Matemática', 1)
    const token = await tokenDe(['SUPER_ADMIN'])

    const respuesta = await post('/api/v1/cursos', token, {
      nivelId: secundaria.id,
      nombre: 'Matemática',
      orden: 1,
    })

    expect(respuesta.status).toBe(201)
  })

  it('lista los cursos de un nivel ordenados por orden', async () => {
    const institucion = await crearInstitucion()
    const primaria = await crearNivel(institucion.id, 'Primaria', 1)
    const secundaria = await crearNivel(institucion.id, 'Secundaria', 2)
    await crearCurso(primaria.id, 'Comunicación', 2)
    await crearCurso(primaria.id, 'Matemática', 1)
    await crearCurso(secundaria.id, 'Matemática', 1)
    const token = await tokenDe(['SUPER_ADMIN'])

    const respuesta = await get(
      `/api/v1/cursos?nivelId=${primaria.id}`,
      token,
    )

    expect(respuesta.status).toBe(200)
    expect(respuesta.body.meta.total).toBe(2)
    expect(
      respuesta.body.data.map((curso: { nombre: string }) => curso.nombre),
    ).toEqual(['Matemática', 'Comunicación'])
    expect(
      respuesta.body.data.every(
        (curso: { nivelId: string }) => curso.nivelId === primaria.id,
      ),
    ).toBe(true)
  })

  it('devuelve 404 al filtrar por un nivel inexistente', async () => {
    await crearInstitucion()
    const token = await tokenDe(['SUPER_ADMIN'])

    const respuesta = await get(
      '/api/v1/cursos?nivelId=00000000-0000-4000-8000-000000000099',
      token,
    )

    expect(respuesta.status).toBe(404)
  })

  it('actualiza parcialmente y permite vaciar el área', async () => {
    const institucion = await crearInstitucion()
    const nivel = await crearNivel(institucion.id)
    const curso = await prisma.curso.create({
      data: {
        nivelId: nivel.id,
        nombre: 'Matemática',
        area: 'Ciencia y Tecnología',
        orden: 1,
      },
    })
    const token = await tokenDe(['DIRECTOR'])

    const primera = await patch(`/api/v1/cursos/${curso.id}`, token, {
      nombre: 'Matemática aplicada',
    })
    const segunda = await patch(`/api/v1/cursos/${curso.id}`, token, {
      area: null,
    })

    expect(primera.status).toBe(200)
    expect(primera.body).toMatchObject({
      nombre: 'Matemática aplicada',
      area: 'Ciencia y Tecnología',
      orden: 1,
      nivelId: nivel.id,
    })
    expect(segunda.status).toBe(200)
    expect(segunda.body.area).toBeNull()
  })

  it('rechaza un nombre duplicado al editar con 409', async () => {
    const institucion = await crearInstitucion()
    const nivel = await crearNivel(institucion.id)
    await crearCurso(nivel.id, 'Matemática', 1)
    const segundo = await crearCurso(nivel.id, 'Comunicación', 2)
    const token = await tokenDe(['SUPER_ADMIN'])

    const respuesta = await patch(`/api/v1/cursos/${segundo.id}`, token, {
      nombre: 'Matemática',
    })

    expect(respuesta.status).toBe(409)
  })

  it('devuelve 404 al editar un curso inexistente', async () => {
    await crearInstitucion()
    const token = await tokenDe(['SUPER_ADMIN'])

    const respuesta = await patch(
      '/api/v1/cursos/00000000-0000-4000-8000-000000000099',
      token,
      { nombre: 'Inexistente' },
    )

    expect(respuesta.status).toBe(404)
  })

  it('oculta los cursos con borrado lógico', async () => {
    const institucion = await crearInstitucion()
    const nivel = await crearNivel(institucion.id)
    const curso = await crearCurso(nivel.id)
    const token = await tokenDe(['SUPER_ADMIN'])

    await prisma.curso.update({
      where: { id: curso.id },
      data: { deletedAt: new Date() },
    })

    const listado = await get('/api/v1/cursos', token)
    const edicion = await patch(`/api/v1/cursos/${curso.id}`, token, {
      orden: 2,
    })

    expect(listado.body.data).toEqual([])
    expect(edicion.status).toBe(404)
  })

  it('rechaza un cuerpo vacío al editar', async () => {
    const institucion = await crearInstitucion()
    const nivel = await crearNivel(institucion.id)
    const curso = await crearCurso(nivel.id)
    const token = await tokenDe(['SUPER_ADMIN'])

    const respuesta = await patch(`/api/v1/cursos/${curso.id}`, token, {})

    expect(respuesta.status).toBe(400)
  })

  it('no expone cursos de otra institución', async () => {
    const propia = await crearInstitucion('IE Propia')
    const ajena = await crearInstitucion(
      'IE Ajena',
      '2026-01-02T00:00:00.000Z',
    )
    const nivelPropio = await crearNivel(propia.id, 'Primaria', 1)
    const nivelAjeno = await crearNivel(ajena.id, 'Secundaria', 1)
    await prisma.curso.create({
      data: { nivelId: nivelPropio.id, nombre: 'Matemática', orden: 1 },
    })
    const cursoAjeno = await prisma.curso.create({
      data: { nivelId: nivelAjeno.id, nombre: 'Matemática', orden: 1 },
    })
    const token = await tokenDe(['SUPER_ADMIN'])

    const listado = await get('/api/v1/cursos', token)
    const creacion = await post('/api/v1/cursos', token, {
      nivelId: nivelAjeno.id,
      nombre: 'Comunicación',
      orden: 2,
    })
    const edicion = await patch(
      `/api/v1/cursos/${cursoAjeno.id}`,
      token,
      { nombre: 'Intruso' },
    )

    expect(listado.body.data).toHaveLength(1)
    expect(listado.body.data[0].nivelId).toBe(nivelPropio.id)
    expect(creacion.status).toBe(404)
    expect(edicion.status).toBe(404)
  })
})
