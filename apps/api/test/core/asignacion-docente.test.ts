import type { FastifyInstance } from 'fastify'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../../src/app.js'
import { signAccessToken } from '../../src/core/auth/tokens.js'
import { createTestPrisma, limpiarBaseDePruebas } from '../helpers/test-db.js'

describe.skipIf(!process.env.TEST_DATABASE_URL)('asignaciones de docente', () => {
  let app: FastifyInstance
  let prisma: ReturnType<typeof createTestPrisma>
  let secuencia = 0
  let documentos = 0

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

  function siguienteDocumento(): string {
    documentos += 1

    return String(73_000_000 + documentos)
  }

  async function crearUsuarioConRoles(roles: string[]) {
    secuencia += 1

    const persona = await prisma.persona.create({
      data: {
        nombres: `Usuario${secuencia}`,
        apellidos: 'De Prueba',
        tipoDocumento: 'DNI',
        numeroDocumento: String(41_000_000 + secuencia),
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

  async function crearAnio(
    institucionId: string,
    nombre = '2026',
    estado = 'ACTIVO',
  ) {
    return prisma.anioAcademico.create({
      data: {
        institucionId,
        nombre,
        fechaInicio: new Date(`${nombre}-03-01T00:00:00.000Z`),
        fechaFin: new Date(`${nombre}-12-15T00:00:00.000Z`),
        estado,
      },
    })
  }

  async function crearDocente(nombres = 'Luis') {
    const documento = siguienteDocumento()
    const persona = await prisma.persona.create({
      data: {
        nombres,
        apellidos: 'Vargas Torres',
        tipoDocumento: 'DNI',
        numeroDocumento: documento,
      },
    })

    return prisma.docente.create({
      data: {
        personaId: persona.id,
        codigoDocente: `DOC-${documento}`,
      },
      include: { persona: true },
    })
  }

  async function crearEstructura(nombreInstitucion = 'IE San Martín') {
    const institucion = await prisma.institucion.create({
      data: { nombre: nombreInstitucion },
    })
    const nivel = await prisma.nivel.create({
      data: { institucionId: institucion.id, nombre: 'Primaria', orden: 1 },
    })
    const grado = await prisma.grado.create({
      data: { nivelId: nivel.id, nombre: '1.°', orden: 1 },
    })
    const anio = await crearAnio(institucion.id, '2026')
    const seccion = await prisma.seccion.create({
      data: { gradoId: grado.id, anioId: anio.id, nombre: 'A' },
    })
    const curso = await prisma.curso.create({
      data: { nivelId: nivel.id, nombre: 'Matemática', orden: 1 },
    })

    return { institucion, nivel, grado, anio, seccion, curso }
  }

  it('exige autenticación en ambos endpoints', async () => {
    const respuestas = [
      await get('/api/v1/asignaciones-docente'),
      await request(app.server).post('/api/v1/asignaciones-docente').send({}),
    ]

    for (const respuesta of respuestas) {
      expect(respuesta.status).toBe(401)
    }
  })

  it('rechaza a un Docente en ambos endpoints', async () => {
    const token = await tokenDe(['DOCENTE'])

    const respuestas = [
      await get('/api/v1/asignaciones-docente', token),
      await post('/api/v1/asignaciones-docente', token, {}),
    ]

    for (const respuesta of respuestas) {
      expect(respuesta.status).toBe(403)
      expect(respuesta.body).toMatchObject({ error: { code: 'FORBIDDEN' } })
    }
  })

  it('devuelve un listado vacío paginado', async () => {
    await prisma.institucion.create({ data: { nombre: 'IE San Martín' } })
    const token = await tokenDe(['SUPER_ADMIN'])

    const respuesta = await get('/api/v1/asignaciones-docente', token)

    expect(respuesta.status).toBe(200)
    expect(respuesta.body).toEqual({
      data: [],
      meta: { page: 1, pageSize: 20, total: 0 },
    })
  })

  it('crea una asignación con docente, curso, sección y año', async () => {
    const { nivel, grado, anio, seccion, curso } = await crearEstructura()
    const docente = await crearDocente()
    const usuario = await crearUsuarioConRoles(['DIRECTOR'])
    const { token } = await signAccessToken(usuario.id)

    const respuesta = await post('/api/v1/asignaciones-docente', token, {
      docenteId: docente.id,
      cursoId: curso.id,
      seccionId: seccion.id,
      anioId: anio.id,
    })

    expect(respuesta.status).toBe(201)
    expect(respuesta.body).toMatchObject({
      docenteId: docente.id,
      cursoId: curso.id,
      seccionId: seccion.id,
      anioId: anio.id,
      docente: {
        id: docente.id,
        codigoDocente: docente.codigoDocente,
        persona: { nombres: 'Luis' },
      },
      curso: { id: curso.id, nombre: 'Matemática', nivelId: nivel.id },
      seccion: { id: seccion.id, nombre: 'A', gradoId: grado.id },
      anio: { id: anio.id, nombre: '2026' },
    })

    const persistida = await prisma.asignacionDocente.findUniqueOrThrow({
      where: { id: respuesta.body.id },
    })

    expect(persistida.createdBy).toBe(usuario.id)
  })

  it('rechaza una asignación duplicada con 409', async () => {
    const { anio, seccion, curso } = await crearEstructura()
    const docente = await crearDocente()
    const token = await tokenDe(['SUPER_ADMIN'])
    const cuerpo = {
      docenteId: docente.id,
      cursoId: curso.id,
      seccionId: seccion.id,
      anioId: anio.id,
    }

    await post('/api/v1/asignaciones-docente', token, cuerpo)
    const respuesta = await post('/api/v1/asignaciones-docente', token, cuerpo)

    expect(respuesta.status).toBe(409)
    expect(respuesta.body).toMatchObject({ error: { code: 'CONFLICT' } })
  })

  it('permite asignar el mismo docente a otra sección del mismo año', async () => {
    const { grado, anio, curso } = await crearEstructura()
    const otraSeccion = await prisma.seccion.create({
      data: { gradoId: grado.id, anioId: anio.id, nombre: 'B' },
    })
    const docente = await crearDocente()
    const token = await tokenDe(['SUPER_ADMIN'])

    const respuesta = await post('/api/v1/asignaciones-docente', token, {
      docenteId: docente.id,
      cursoId: curso.id,
      seccionId: otraSeccion.id,
      anioId: anio.id,
    })

    expect(respuesta.status).toBe(201)
    expect(respuesta.body.seccionId).toBe(otraSeccion.id)
  })

  it('permite asignar otro docente al mismo curso y sección', async () => {
    const { anio, seccion, curso } = await crearEstructura()
    const otroDocente = await crearDocente('María')
    const token = await tokenDe(['SUPER_ADMIN'])

    const respuesta = await post('/api/v1/asignaciones-docente', token, {
      docenteId: otroDocente.id,
      cursoId: curso.id,
      seccionId: seccion.id,
      anioId: anio.id,
    })

    expect(respuesta.status).toBe(201)
    expect(respuesta.body.docenteId).toBe(otroDocente.id)
  })

  it('devuelve 404 si el docente no existe', async () => {
    const { anio, seccion, curso } = await crearEstructura()
    const token = await tokenDe(['SUPER_ADMIN'])

    const respuesta = await post('/api/v1/asignaciones-docente', token, {
      docenteId: '00000000-0000-4000-8000-000000000099',
      cursoId: curso.id,
      seccionId: seccion.id,
      anioId: anio.id,
    })

    expect(respuesta.status).toBe(404)
    expect(respuesta.body).toMatchObject({ error: { code: 'NOT_FOUND' } })
  })

  it('devuelve 404 si el curso no existe', async () => {
    const { anio, seccion } = await crearEstructura()
    const docente = await crearDocente()
    const token = await tokenDe(['SUPER_ADMIN'])

    const respuesta = await post('/api/v1/asignaciones-docente', token, {
      docenteId: docente.id,
      cursoId: '00000000-0000-4000-8000-000000000098',
      seccionId: seccion.id,
      anioId: anio.id,
    })

    expect(respuesta.status).toBe(404)
  })

  it('devuelve 404 si la sección no existe', async () => {
    const { anio, curso } = await crearEstructura()
    const docente = await crearDocente()
    const token = await tokenDe(['SUPER_ADMIN'])

    const respuesta = await post('/api/v1/asignaciones-docente', token, {
      docenteId: docente.id,
      cursoId: curso.id,
      seccionId: '00000000-0000-4000-8000-000000000097',
      anioId: anio.id,
    })

    expect(respuesta.status).toBe(404)
  })

  it('devuelve 404 si el año no existe', async () => {
    const { seccion, curso } = await crearEstructura()
    const docente = await crearDocente()
    const token = await tokenDe(['SUPER_ADMIN'])

    const respuesta = await post('/api/v1/asignaciones-docente', token, {
      docenteId: docente.id,
      cursoId: curso.id,
      seccionId: seccion.id,
      anioId: '00000000-0000-4000-8000-000000000096',
    })

    expect(respuesta.status).toBe(404)
  })

  it('rechaza una sección que no pertenece al año indicado', async () => {
    const { institucion, grado, anio, curso } = await crearEstructura()
    const otroAnio = await crearAnio(institucion.id, '2027')
    const seccionDeOtroAnio = await prisma.seccion.create({
      data: { gradoId: grado.id, anioId: otroAnio.id, nombre: 'A' },
    })
    const docente = await crearDocente()
    const token = await tokenDe(['SUPER_ADMIN'])

    const respuesta = await post('/api/v1/asignaciones-docente', token, {
      docenteId: docente.id,
      cursoId: curso.id,
      seccionId: seccionDeOtroAnio.id,
      anioId: anio.id,
    })

    expect(respuesta.status).toBe(400)
    expect(respuesta.body).toMatchObject({
      error: { code: 'VALIDATION_ERROR' },
    })
  })

  it('rechaza un curso de un nivel distinto al de la sección', async () => {
    const { institucion, anio, seccion } = await crearEstructura()
    const otroNivel = await prisma.nivel.create({
      data: { institucionId: institucion.id, nombre: 'Secundaria', orden: 2 },
    })
    const cursoDeOtroNivel = await prisma.curso.create({
      data: { nivelId: otroNivel.id, nombre: 'Álgebra', orden: 1 },
    })
    const docente = await crearDocente()
    const token = await tokenDe(['SUPER_ADMIN'])

    const respuesta = await post('/api/v1/asignaciones-docente', token, {
      docenteId: docente.id,
      cursoId: cursoDeOtroNivel.id,
      seccionId: seccion.id,
      anioId: anio.id,
    })

    expect(respuesta.status).toBe(400)
    expect(respuesta.body).toMatchObject({
      error: { code: 'VALIDATION_ERROR' },
    })
  })

  it('valida el cuerpo de la petición', async () => {
    const token = await tokenDe(['SUPER_ADMIN'])

    const respuesta = await post('/api/v1/asignaciones-docente', token, {})

    expect(respuesta.status).toBe(400)
    expect(respuesta.body).toMatchObject({
      error: { code: 'VALIDATION_ERROR' },
    })
  })

  it('filtra por docente', async () => {
    const { anio, seccion, curso } = await crearEstructura()
    const docente = await crearDocente()
    const otroDocente = await crearDocente('María')
    const token = await tokenDe(['SUPER_ADMIN'])

    await post('/api/v1/asignaciones-docente', token, {
      docenteId: docente.id,
      cursoId: curso.id,
      seccionId: seccion.id,
      anioId: anio.id,
    })
    await post('/api/v1/asignaciones-docente', token, {
      docenteId: otroDocente.id,
      cursoId: curso.id,
      seccionId: seccion.id,
      anioId: anio.id,
    })

    const respuesta = await get(
      `/api/v1/asignaciones-docente?docenteId=${docente.id}`,
      token,
    )

    expect(respuesta.status).toBe(200)
    expect(respuesta.body.meta.total).toBe(1)
    expect(respuesta.body.data).toHaveLength(1)
    expect(respuesta.body.data[0].docenteId).toBe(docente.id)
  })

  it('filtra por curso, sección y año', async () => {
    const { anio, seccion, curso } = await crearEstructura()
    const docente = await crearDocente()
    const token = await tokenDe(['SUPER_ADMIN'])

    await post('/api/v1/asignaciones-docente', token, {
      docenteId: docente.id,
      cursoId: curso.id,
      seccionId: seccion.id,
      anioId: anio.id,
    })

    const respuesta = await get(
      `/api/v1/asignaciones-docente?cursoId=${curso.id}&seccionId=${seccion.id}&anioId=${anio.id}`,
      token,
    )

    expect(respuesta.status).toBe(200)
    expect(respuesta.body.meta.total).toBe(1)
  })

  it('devuelve 404 si el filtro de docente no existe', async () => {
    await crearEstructura()
    const token = await tokenDe(['SUPER_ADMIN'])

    const respuesta = await get(
      '/api/v1/asignaciones-docente?docenteId=00000000-0000-4000-8000-000000000095',
      token,
    )

    expect(respuesta.status).toBe(404)
  })

  it('no expone asignaciones de otra institución', async () => {
    const { anio, seccion, curso } = await crearEstructura()
    const docente = await crearDocente()
    const token = await tokenDe(['SUPER_ADMIN'])

    await post('/api/v1/asignaciones-docente', token, {
      docenteId: docente.id,
      cursoId: curso.id,
      seccionId: seccion.id,
      anioId: anio.id,
    })

    const otra = await crearEstructura('IE Otro Distrito')
    const docenteAjeno = await crearDocente('Pedro')
    const tokenAjeno = await tokenDe(['SUPER_ADMIN'])

    const respuestaAjena = await post(
      '/api/v1/asignaciones-docente',
      tokenAjeno,
      {
        docenteId: docenteAjeno.id,
        cursoId: otra.curso.id,
        seccionId: otra.seccion.id,
        anioId: otra.anio.id,
      },
    )

    // La institución actual es la primera creada; la otra queda fuera de
    // alcance y no se puede usar para crear asignaciones.
    expect(respuestaAjena.status).toBe(404)

    const respuesta = await get('/api/v1/asignaciones-docente', token)

    expect(respuesta.status).toBe(200)
    expect(respuesta.body.meta.total).toBe(1)
    expect(respuesta.body.data[0].seccionId).toBe(seccion.id)
  })

  it('pagina los resultados', async () => {
    const { anio, seccion, curso } = await crearEstructura()
    const token = await tokenDe(['SUPER_ADMIN'])

    for (const nombres of ['Luis', 'María', 'Pedro']) {
      const docente = await crearDocente(nombres)

      await post('/api/v1/asignaciones-docente', token, {
        docenteId: docente.id,
        cursoId: curso.id,
        seccionId: seccion.id,
        anioId: anio.id,
      })
    }

    const primera = await get(
      '/api/v1/asignaciones-docente?page=1&pageSize=2',
      token,
    )
    const segunda = await get(
      '/api/v1/asignaciones-docente?page=2&pageSize=2',
      token,
    )

    expect(primera.status).toBe(200)
    expect(primera.body.meta).toEqual({ page: 1, pageSize: 2, total: 3 })
    expect(primera.body.data).toHaveLength(2)
    expect(segunda.body.meta).toEqual({ page: 2, pageSize: 2, total: 3 })
    expect(segunda.body.data).toHaveLength(1)
  })
})
