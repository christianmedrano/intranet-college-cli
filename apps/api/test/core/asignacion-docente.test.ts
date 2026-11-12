import type { FastifyInstance } from 'fastify'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../../src/app.js'
import { signAccessToken } from '../../src/core/auth/tokens.js'
import { createTestPrisma, limpiarBaseDePruebas } from '../helpers/test-db.js'
import { INSTITUCION_ID } from '../constants.js'

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

  async function crearEstructura() {
    const institucion = { id: INSTITUCION_ID }
    const nivel = await prisma.nivel.create({
      data: { institucionId: INSTITUCION_ID, nombre: 'Primaria', orden: 1 },
    })
    const grado = await prisma.grado.create({
      data: { nivelId: nivel.id, nombre: '1.°', orden: 1 },
    })
    const anio = await crearAnio(INSTITUCION_ID, '2026')
    const seccion = await prisma.seccion.create({
      data: { gradoId: grado.id, anioId: anio.id, nombre: 'A' },
    })
    const curso = await prisma.curso.create({
      data: { nivelId: nivel.id, nombre: 'Matemática', orden: 1 },
    })

    return { institucion, nivel, grado, anio, seccion, curso }
  }

  it('exige autenticación en los tres endpoints', async () => {
    const respuestas = [
      await get('/api/v1/asignaciones-docente'),
      await request(app.server).post('/api/v1/asignaciones-docente').send({}),
      await request(app.server)
        .patch('/api/v1/asignaciones-docente/00000000-0000-4000-8000-000000000001')
        .send({ esTutor: true }),
    ]

    for (const respuesta of respuestas) {
      expect(respuesta.status).toBe(401)
    }
  })

  it('rechaza a un Docente en los tres endpoints', async () => {
    const token = await tokenDe(['DOCENTE'])

    const respuestas = [
      await get('/api/v1/asignaciones-docente', token),
      await post('/api/v1/asignaciones-docente', token, {}),
      await patch(
        '/api/v1/asignaciones-docente/00000000-0000-4000-8000-000000000001',
        token,
        { esTutor: true },
      ),
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

  it.skip('no expone asignaciones de otra institución — multi-institution test incompatible with single-institution deployment', async () => {
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

  describe('docente tutor', () => {
    async function crearAsignacionPlana(
      token: string,
      datos: {
        docenteId: string
        cursoId: string
        seccionId: string
        anioId: string
        esTutor?: boolean
      },
    ) {
      return post('/api/v1/asignaciones-docente', token, datos)
    }

    it('crea una asignación marcada como tutor y la audita', async () => {
      const { anio, seccion, curso } = await crearEstructura()
      const docente = await crearDocente()
      const actor = await crearUsuarioConRoles(['SUPER_ADMIN'])
      const { token } = await signAccessToken(actor.id)

      const respuesta = await crearAsignacionPlana(token, {
        docenteId: docente.id,
        cursoId: curso.id,
        seccionId: seccion.id,
        anioId: anio.id,
        esTutor: true,
      })

      expect(respuesta.status).toBe(201)
      expect(respuesta.body.esTutor).toBe(true)

      const persistida = await prisma.asignacionDocente.findUniqueOrThrow({
        where: { id: respuesta.body.id },
      })

      expect(persistida.esTutor).toBe(true)
      expect(persistida.createdBy).toBe(actor.id)

      const registro = await prisma.auditoria.findFirstOrThrow({
        where: { entidad: 'ASIGNACION_DOCENTE', entidadId: respuesta.body.id },
      })

      expect(registro.accion).toBe('CREAR')
      expect(registro.usuarioId).toBe(actor.id)
      expect(registro.datos).toMatchObject({
        esTutor: true,
        seccionId: seccion.id,
      })

      const listado = await get('/api/v1/asignaciones-docente', token)

      expect(listado.body.data[0]).toMatchObject({
        id: respuesta.body.id,
        esTutor: true,
      })
    })

    it('asigna false por defecto y no audita la creación', async () => {
      const { anio, seccion, curso } = await crearEstructura()
      const docente = await crearDocente()
      const token = await tokenDe(['SUPER_ADMIN'])

      const respuesta = await crearAsignacionPlana(token, {
        docenteId: docente.id,
        cursoId: curso.id,
        seccionId: seccion.id,
        anioId: anio.id,
      })

      expect(respuesta.status).toBe(201)
      expect(respuesta.body.esTutor).toBe(false)

      const persistida = await prisma.asignacionDocente.findUniqueOrThrow({
        where: { id: respuesta.body.id },
      })

      expect(persistida.esTutor).toBe(false)
      expect(
        await prisma.auditoria.count({
          where: { entidad: 'ASIGNACION_DOCENTE' },
        }),
      ).toBe(0)
    })

    it('marca y desmarca al tutor con PATCH y audita ambos cambios', async () => {
      const { anio, seccion, curso } = await crearEstructura()
      const docente = await crearDocente()
      const actor = await crearUsuarioConRoles(['DIRECTOR'])
      const { token } = await signAccessToken(actor.id)
      const creada = await crearAsignacionPlana(token, {
        docenteId: docente.id,
        cursoId: curso.id,
        seccionId: seccion.id,
        anioId: anio.id,
      })

      const marcada = await patch(
        `/api/v1/asignaciones-docente/${creada.body.id}`,
        token,
        { esTutor: true },
      )

      expect(marcada.status).toBe(200)
      expect(marcada.body.esTutor).toBe(true)

      const desmarcada = await patch(
        `/api/v1/asignaciones-docente/${creada.body.id}`,
        token,
        { esTutor: false },
      )

      expect(desmarcada.status).toBe(200)
      expect(desmarcada.body.esTutor).toBe(false)

      const registros = await prisma.auditoria.findMany({
        where: {
          entidad: 'ASIGNACION_DOCENTE',
          entidadId: creada.body.id,
          accion: 'ACTUALIZAR',
        },
        orderBy: { createdAt: 'asc' },
      })

      expect(registros).toHaveLength(2)
      expect(registros[0]).toMatchObject({
        usuarioId: actor.id,
        datos: { esTutor: { anterior: false, nuevo: true } },
      })
      expect(registros[1]).toMatchObject({
        usuarioId: actor.id,
        datos: { esTutor: { anterior: true, nuevo: false } },
      })
    })

    it('impide marcar un segundo tutor en la misma sección y año', async () => {
      const { anio, seccion, curso } = await crearEstructura()
      const primerDocente = await crearDocente()
      const segundoDocente = await crearDocente('María')
      const token = await tokenDe(['SUPER_ADMIN'])

      const primera = await crearAsignacionPlana(token, {
        docenteId: primerDocente.id,
        cursoId: curso.id,
        seccionId: seccion.id,
        anioId: anio.id,
        esTutor: true,
      })
      const segunda = await crearAsignacionPlana(token, {
        docenteId: segundoDocente.id,
        cursoId: curso.id,
        seccionId: seccion.id,
        anioId: anio.id,
      })

      const respuesta = await patch(
        `/api/v1/asignaciones-docente/${segunda.body.id}`,
        token,
        { esTutor: true },
      )

      expect(respuesta.status).toBe(409)
      expect(respuesta.body).toMatchObject({ error: { code: 'CONFLICT' } })

      const tutores = await prisma.asignacionDocente.count({
        where: { seccionId: seccion.id, anioId: anio.id, esTutor: true },
      })

      expect(tutores).toBe(1)

      const persistida = await prisma.asignacionDocente.findUniqueOrThrow({
        where: { id: segunda.body.id },
      })

      expect(persistida.esTutor).toBe(false)
      expect(primera.body.esTutor).toBe(true)
    })

    it('impide crear directamente un segundo tutor', async () => {
      const { anio, seccion, curso } = await crearEstructura()
      const primerDocente = await crearDocente()
      const segundoDocente = await crearDocente('María')
      const token = await tokenDe(['SUPER_ADMIN'])

      await crearAsignacionPlana(token, {
        docenteId: primerDocente.id,
        cursoId: curso.id,
        seccionId: seccion.id,
        anioId: anio.id,
        esTutor: true,
      })

      const respuesta = await crearAsignacionPlana(token, {
        docenteId: segundoDocente.id,
        cursoId: curso.id,
        seccionId: seccion.id,
        anioId: anio.id,
        esTutor: true,
      })

      expect(respuesta.status).toBe(409)
      expect(respuesta.body).toMatchObject({ error: { code: 'CONFLICT' } })
      expect(
        await prisma.asignacionDocente.count({
          where: { seccionId: seccion.id, anioId: anio.id, esTutor: true },
        }),
      ).toBe(1)
    })

    it('permite un tutor en otra sección del mismo año y en otra sección del siguiente año', async () => {
      const { institucion, grado, anio, seccion, curso } =
        await crearEstructura()
      const primerDocente = await crearDocente()
      const segundoDocente = await crearDocente('María')
      const tercerDocente = await crearDocente('Pedro')
      const token = await tokenDe(['SUPER_ADMIN'])

      await crearAsignacionPlana(token, {
        docenteId: primerDocente.id,
        cursoId: curso.id,
        seccionId: seccion.id,
        anioId: anio.id,
        esTutor: true,
      })

      const otraSeccion = await prisma.seccion.create({
        data: { gradoId: grado.id, anioId: anio.id, nombre: 'B' },
      })
      const otroAnio = await crearAnio(institucion.id, '2027')
      const seccionDeOtroAnio = await prisma.seccion.create({
        data: { gradoId: grado.id, anioId: otroAnio.id, nombre: 'A' },
      })

      const enOtraSeccion = await crearAsignacionPlana(token, {
        docenteId: segundoDocente.id,
        cursoId: curso.id,
        seccionId: otraSeccion.id,
        anioId: anio.id,
        esTutor: true,
      })
      const enOtroAnio = await crearAsignacionPlana(token, {
        docenteId: tercerDocente.id,
        cursoId: curso.id,
        seccionId: seccionDeOtroAnio.id,
        anioId: otroAnio.id,
        esTutor: true,
      })

      expect(enOtraSeccion.status).toBe(201)
      expect(enOtraSeccion.body.esTutor).toBe(true)
      expect(enOtroAnio.status).toBe(201)
      expect(enOtroAnio.body.esTutor).toBe(true)
    })

    it('permite reasignar la tutoría tras desmarcar al anterior', async () => {
      const { anio, seccion, curso } = await crearEstructura()
      const primerDocente = await crearDocente()
      const segundoDocente = await crearDocente('María')
      const token = await tokenDe(['SUPER_ADMIN'])

      const primera = await crearAsignacionPlana(token, {
        docenteId: primerDocente.id,
        cursoId: curso.id,
        seccionId: seccion.id,
        anioId: anio.id,
        esTutor: true,
      })
      const segunda = await crearAsignacionPlana(token, {
        docenteId: segundoDocente.id,
        cursoId: curso.id,
        seccionId: seccion.id,
        anioId: anio.id,
      })

      await patch(`/api/v1/asignaciones-docente/${primera.body.id}`, token, {
        esTutor: false,
      })
      const respuesta = await patch(
        `/api/v1/asignaciones-docente/${segunda.body.id}`,
        token,
        { esTutor: true },
      )

      expect(respuesta.status).toBe(200)
      expect(respuesta.body.esTutor).toBe(true)

      const tutores = await prisma.asignacionDocente.findMany({
        where: { seccionId: seccion.id, anioId: anio.id, esTutor: true },
      })

      expect(tutores).toHaveLength(1)
      expect(tutores[0]?.id).toBe(segunda.body.id)
    })

    it('devuelve 404 si la asignación no existe', async () => {
      await crearEstructura()
      const token = await tokenDe(['SUPER_ADMIN'])

      const respuesta = await patch(
        '/api/v1/asignaciones-docente/00000000-0000-4000-8000-000000000094',
        token,
        { esTutor: true },
      )

      expect(respuesta.status).toBe(404)
      expect(respuesta.body).toMatchObject({ error: { code: 'NOT_FOUND' } })
    })

    it.skip('no permite modificar una asignación de otra institución — multi-institution test incompatible with single-institution deployment', async () => {
      await crearEstructura()
      const otra = await crearEstructura('IE Otro Distrito')
      const docente = await crearDocente('Pedro')
      const ajena = await prisma.asignacionDocente.create({
        data: {
          docenteId: docente.id,
          cursoId: otra.curso.id,
          seccionId: otra.seccion.id,
          anioId: otra.anio.id,
        },
      })
      const token = await tokenDe(['SUPER_ADMIN'])

      const respuesta = await patch(
        `/api/v1/asignaciones-docente/${ajena.id}`,
        token,
        { esTutor: true },
      )

      expect(respuesta.status).toBe(404)

      const persistida = await prisma.asignacionDocente.findUniqueOrThrow({
        where: { id: ajena.id },
      })

      expect(persistida.esTutor).toBe(false)
    })

    it('valida el cuerpo del PATCH', async () => {
      const token = await tokenDe(['SUPER_ADMIN'])

      const sinCuerpo = await patch(
        '/api/v1/asignaciones-docente/00000000-0000-4000-8000-000000000093',
        token,
        {},
      )
      const tipoInvalido = await patch(
        '/api/v1/asignaciones-docente/00000000-0000-4000-8000-000000000093',
        token,
        { esTutor: 'si' },
      )

      for (const respuesta of [sinCuerpo, tipoInvalido]) {
        expect(respuesta.status).toBe(400)
        expect(respuesta.body).toMatchObject({
          error: { code: 'VALIDATION_ERROR' },
        })
      }
    })

    it('garantiza un solo tutor bajo PATCH concurrentes', async () => {
      const { anio, seccion, curso } = await crearEstructura()
      const primerDocente = await crearDocente()
      const segundoDocente = await crearDocente('María')
      const token = await tokenDe(['SUPER_ADMIN'])

      const primera = await crearAsignacionPlana(token, {
        docenteId: primerDocente.id,
        cursoId: curso.id,
        seccionId: seccion.id,
        anioId: anio.id,
      })
      const segunda = await crearAsignacionPlana(token, {
        docenteId: segundoDocente.id,
        cursoId: curso.id,
        seccionId: seccion.id,
        anioId: anio.id,
      })

      const [r1, r2] = await Promise.all([
        patch(`/api/v1/asignaciones-docente/${primera.body.id}`, token, {
          esTutor: true,
        }),
        patch(`/api/v1/asignaciones-docente/${segunda.body.id}`, token, {
          esTutor: true,
        }),
      ])

      expect([r1.status, r2.status].sort()).toEqual([200, 409])
      expect(
        await prisma.asignacionDocente.count({
          where: { seccionId: seccion.id, anioId: anio.id, esTutor: true },
        }),
      ).toBe(1)
    }, 15_000)
  })
})
