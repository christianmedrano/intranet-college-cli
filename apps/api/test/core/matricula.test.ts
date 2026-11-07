import type { FastifyInstance } from 'fastify'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../../src/app.js'
import { signAccessToken } from '../../src/core/auth/tokens.js'
import { createTestPrisma, limpiarBaseDePruebas } from '../helpers/test-db.js'

describe.skipIf(!process.env.TEST_DATABASE_URL)('matrículas', () => {
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

    return String(72_000_000 + documentos)
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

  async function crearInstitucion(nombre = 'IE San Martín') {
    return prisma.institucion.create({ data: { nombre } })
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

  async function crearSeccion(
    gradoId: string,
    anioId: string,
    nombre = 'A',
  ) {
    return prisma.seccion.create({
      data: { gradoId, anioId, nombre },
    })
  }

  async function crearEstructura() {
    const institucion = await crearInstitucion()
    const nivel = await prisma.nivel.create({
      data: { institucionId: institucion.id, nombre: 'Primaria', orden: 1 },
    })
    const grado = await prisma.grado.create({
      data: { nivelId: nivel.id, nombre: '1.°', orden: 1 },
    })
    const anio = await crearAnio(institucion.id, '2026')
    const seccion = await crearSeccion(grado.id, anio.id)

    return { institucion, nivel, grado, anio, seccion }
  }

  async function crearAlumno(
    nombres = 'Ana',
    apellidos = 'Quispe Rojas',
  ) {
    const documento = siguienteDocumento()
    const persona = await prisma.persona.create({
      data: {
        nombres,
        apellidos,
        tipoDocumento: 'DNI',
        numeroDocumento: documento,
      },
    })

    return prisma.alumno.create({
      data: {
        personaId: persona.id,
        codigoAlumno: `AL-${documento}`,
      },
      include: { persona: true },
    })
  }

  async function crearApoderadoPrincipal(alumnoId: string) {
    const documento = siguienteDocumento()
    const persona = await prisma.persona.create({
      data: {
        nombres: 'Rosa',
        apellidos: 'Mendoza',
        tipoDocumento: 'DNI',
        numeroDocumento: documento,
      },
    })

    const apoderado = await prisma.apoderado.create({
      data: { personaId: persona.id },
    })

    await prisma.apoderadoAlumno.create({
      data: {
        apoderadoId: apoderado.id,
        alumnoId,
        parentesco: 'Madre',
        esPrincipal: true,
      },
    })

    return apoderado
  }

  it('exige autenticación en los tres endpoints', async () => {
    const id = '00000000-0000-4000-8000-000000000001'

    const respuestas = [
      await get('/api/v1/matriculas'),
      await request(app.server).post('/api/v1/matriculas').send({}),
      await request(app.server).patch(`/api/v1/matriculas/${id}`).send({}),
    ]

    for (const respuesta of respuestas) {
      expect(respuesta.status).toBe(401)
    }
  })

  it('rechaza a un Docente en todos los endpoints', async () => {
    const token = await tokenDe(['DOCENTE'])
    const id = '00000000-0000-4000-8000-000000000001'

    const respuestas = [
      await get('/api/v1/matriculas', token),
      await post('/api/v1/matriculas', token, {}),
      await patch(`/api/v1/matriculas/${id}`, token, {
        estado: 'APROBADA',
      }),
    ]

    for (const respuesta of respuestas) {
      expect(respuesta.status).toBe(403)
      expect(respuesta.body).toMatchObject({ error: { code: 'FORBIDDEN' } })
    }
  })

  it('devuelve un historial vacío paginado', async () => {
    const token = await tokenDe(['SUPER_ADMIN'])

    const respuesta = await get('/api/v1/matriculas', token)

    expect(respuesta.status).toBe(200)
    expect(respuesta.body).toEqual({
      data: [],
      meta: { page: 1, pageSize: 20, total: 0 },
    })
  })

  it('crea una matrícula SOLICITADA con año, nivel, grado y sección', async () => {
    const { nivel, grado, anio, seccion } = await crearEstructura()
    const alumno = await crearAlumno()
    const usuario = await crearUsuarioConRoles(['DIRECTOR'])
    const { token } = await signAccessToken(usuario.id)

    const respuesta = await post('/api/v1/matriculas', token, {
      alumnoId: alumno.id,
      seccionId: seccion.id,
      anioId: anio.id,
    })

    expect(respuesta.status).toBe(201)
    expect(respuesta.body).toMatchObject({
      alumnoId: alumno.id,
      seccionId: seccion.id,
      anioId: anio.id,
      estado: 'SOLICITADA',
      alumno: {
        id: alumno.id,
        codigoAlumno: alumno.codigoAlumno,
        persona: { nombres: 'Ana', apellidos: 'Quispe Rojas' },
      },
      anio: { id: anio.id, nombre: '2026' },
      nivel: { id: nivel.id, nombre: 'Primaria' },
      grado: { id: grado.id, nombre: '1.°' },
      seccion: { id: seccion.id, nombre: 'A' },
    })
    expect(new Date(respuesta.body.fechaMatricula).toISOString()).toBe(
      respuesta.body.fechaMatricula,
    )

    const persistida = await prisma.matricula.findUniqueOrThrow({
      where: { id: respuesta.body.id },
    })

    expect(persistida.createdBy).toBe(usuario.id)
    expect(persistida.estado).toBe('SOLICITADA')
  })

  it('rechaza una segunda matrícula del mismo alumno y año con 409', async () => {
    const { anio, seccion } = await crearEstructura()
    const alumno = await crearAlumno()
    const token = await tokenDe(['SUPER_ADMIN'])

    await post('/api/v1/matriculas', token, {
      alumnoId: alumno.id,
      seccionId: seccion.id,
      anioId: anio.id,
    })

    const respuesta = await post('/api/v1/matriculas', token, {
      alumnoId: alumno.id,
      seccionId: seccion.id,
      anioId: anio.id,
    })

    expect(respuesta.status).toBe(409)
    expect(respuesta.body).toMatchObject({ error: { code: 'CONFLICT' } })
  })

  it('permite matricular al mismo alumno en otro año', async () => {
    const { institucion, grado, anio, seccion } = await crearEstructura()
    const otroAnio = await crearAnio(institucion.id, '2027')
    const otraSeccion = await crearSeccion(grado.id, otroAnio.id, 'B')
    const alumno = await crearAlumno()
    const token = await tokenDe(['SUPER_ADMIN'])

    await post('/api/v1/matriculas', token, {
      alumnoId: alumno.id,
      seccionId: seccion.id,
      anioId: anio.id,
    })

    const respuesta = await post('/api/v1/matriculas', token, {
      alumnoId: alumno.id,
      seccionId: otraSeccion.id,
      anioId: otroAnio.id,
    })

    expect(respuesta.status).toBe(201)
    expect(respuesta.body.anioId).toBe(otroAnio.id)
  })

  it('devuelve 404 si el alumno no existe', async () => {
    const { anio, seccion } = await crearEstructura()
    const token = await tokenDe(['SUPER_ADMIN'])

    const respuesta = await post('/api/v1/matriculas', token, {
      alumnoId: '00000000-0000-4000-8000-000000000099',
      seccionId: seccion.id,
      anioId: anio.id,
    })

    expect(respuesta.status).toBe(404)
  })

  it('devuelve 404 si la sección no existe', async () => {
    const { anio } = await crearEstructura()
    const alumno = await crearAlumno()
    const token = await tokenDe(['SUPER_ADMIN'])

    const respuesta = await post('/api/v1/matriculas', token, {
      alumnoId: alumno.id,
      seccionId: '00000000-0000-4000-8000-000000000099',
      anioId: anio.id,
    })

    expect(respuesta.status).toBe(404)
  })

  it('devuelve 404 si el año no existe', async () => {
    const { seccion } = await crearEstructura()
    const alumno = await crearAlumno()
    const token = await tokenDe(['SUPER_ADMIN'])

    const respuesta = await post('/api/v1/matriculas', token, {
      alumnoId: alumno.id,
      seccionId: seccion.id,
      anioId: '00000000-0000-4000-8000-000000000099',
    })

    expect(respuesta.status).toBe(404)
  })

  it('rechaza una sección de otro año con 400', async () => {
    const { institucion, anio, seccion } = await crearEstructura()
    const otroAnio = await crearAnio(institucion.id, '2027')
    const alumno = await crearAlumno()
    const token = await tokenDe(['SUPER_ADMIN'])

    const respuesta = await post('/api/v1/matriculas', token, {
      alumnoId: alumno.id,
      seccionId: seccion.id,
      anioId: otroAnio.id,
    })

    expect(respuesta.status).toBe(400)
    expect(respuesta.body.error.code).toBe('VALIDATION_ERROR')
    expect(respuesta.body.error.details).toContain(
      'anioId: la sección no pertenece al año indicado',
    )
    expect(anio.id).not.toBe(otroAnio.id)
  })

  it('filtra el historial por alumno, año y estado', async () => {
    const { institucion, grado, anio, seccion } = await crearEstructura()
    const otroAnio = await crearAnio(institucion.id, '2027')
    const otraSeccion = await crearSeccion(grado.id, otroAnio.id, 'B')
    const primero = await crearAlumno('Ana', 'Quispe')
    const segundo = await crearAlumno('Bruno', 'Quispe')
    const token = await tokenDe(['SUPER_ADMIN'])

    await post('/api/v1/matriculas', token, {
      alumnoId: primero.id,
      seccionId: seccion.id,
      anioId: anio.id,
    })
    await post('/api/v1/matriculas', token, {
      alumnoId: primero.id,
      seccionId: otraSeccion.id,
      anioId: otroAnio.id,
    })
    await post('/api/v1/matriculas', token, {
      alumnoId: segundo.id,
      seccionId: seccion.id,
      anioId: anio.id,
    })

    const porAlumno = await get(
      `/api/v1/matriculas?alumnoId=${primero.id}`,
      token,
    )
    const porAnio = await get(`/api/v1/matriculas?anioId=${anio.id}`, token)
    const porEstado = await get('/api/v1/matriculas?estado=APROBADA', token)

    expect(porAlumno.body.meta.total).toBe(2)
    expect(porAnio.body.meta.total).toBe(2)
    expect(porEstado.body.meta.total).toBe(0)
  })

  it('devuelve 404 al filtrar por un alumno o año inexistente', async () => {
    const token = await tokenDe(['SUPER_ADMIN'])

    const porAlumno = await get(
      '/api/v1/matriculas?alumnoId=00000000-0000-4000-8000-000000000099',
      token,
    )
    const porAnio = await get(
      '/api/v1/matriculas?anioId=00000000-0000-4000-8000-000000000099',
      token,
    )

    expect(porAlumno.status).toBe(404)
    expect(porAnio.status).toBe(404)
  })

  it('aprueba una matrícula con exactamente un apoderado principal', async () => {
    const { anio, seccion } = await crearEstructura()
    const alumno = await crearAlumno()
    await crearApoderadoPrincipal(alumno.id)
    const usuario = await crearUsuarioConRoles(['DIRECTOR'])
    const { token } = await signAccessToken(usuario.id)

    const creada = await post('/api/v1/matriculas', token, {
      alumnoId: alumno.id,
      seccionId: seccion.id,
      anioId: anio.id,
    })

    const respuesta = await patch(
      `/api/v1/matriculas/${creada.body.id}`,
      token,
      { estado: 'APROBADA' },
    )

    expect(respuesta.status).toBe(200)
    expect(respuesta.body.estado).toBe('APROBADA')

    const persistida = await prisma.matricula.findUniqueOrThrow({
      where: { id: creada.body.id },
    })

    expect(persistida.estado).toBe('APROBADA')
    expect(persistida.updatedBy).toBe(usuario.id)
  })

  it('bloquea la aprobación si el alumno no tiene apoderado principal', async () => {
    const { anio, seccion } = await crearEstructura()
    const alumno = await crearAlumno()
    const token = await tokenDe(['SUPER_ADMIN'])

    const creada = await post('/api/v1/matriculas', token, {
      alumnoId: alumno.id,
      seccionId: seccion.id,
      anioId: anio.id,
    })

    const respuesta = await patch(
      `/api/v1/matriculas/${creada.body.id}`,
      token,
      { estado: 'APROBADA' },
    )

    expect(respuesta.status).toBe(409)
    expect(respuesta.body).toMatchObject({ error: { code: 'CONFLICT' } })
  })

  it('bloquea la aprobación si hay más de un apoderado principal', async () => {
    const { anio, seccion } = await crearEstructura()
    const alumno = await crearAlumno()
    await crearApoderadoPrincipal(alumno.id)
    const segundo = await crearApoderadoPrincipal(alumno.id)
    const token = await tokenDe(['SUPER_ADMIN'])

    const creada = await post('/api/v1/matriculas', token, {
      alumnoId: alumno.id,
      seccionId: seccion.id,
      anioId: anio.id,
    })

    const respuesta = await patch(
      `/api/v1/matriculas/${creada.body.id}`,
      token,
      { estado: 'APROBADA' },
    )

    expect(segundo.id).toBeDefined()
    expect(respuesta.status).toBe(409)
  })

  it('retira una matrícula y la conserva en el historial', async () => {
    const { anio, seccion } = await crearEstructura()
    const alumno = await crearAlumno()
    const token = await tokenDe(['SUPER_ADMIN'])

    const creada = await post('/api/v1/matriculas', token, {
      alumnoId: alumno.id,
      seccionId: seccion.id,
      anioId: anio.id,
    })

    const respuesta = await patch(
      `/api/v1/matriculas/${creada.body.id}`,
      token,
      { estado: 'RETIRADA' },
    )

    expect(respuesta.status).toBe(200)
    expect(respuesta.body.estado).toBe('RETIRADA')

    const listado = await get('/api/v1/matriculas', token)

    expect(listado.body.meta.total).toBe(1)
    expect(listado.body.data[0]).toMatchObject({
      id: creada.body.id,
      estado: 'RETIRADA',
    })
  })

  it('permite retirar una matrícula aprobada', async () => {
    const { anio, seccion } = await crearEstructura()
    const alumno = await crearAlumno()
    await crearApoderadoPrincipal(alumno.id)
    const token = await tokenDe(['SUPER_ADMIN'])

    const creada = await post('/api/v1/matriculas', token, {
      alumnoId: alumno.id,
      seccionId: seccion.id,
      anioId: anio.id,
    })

    await patch(`/api/v1/matriculas/${creada.body.id}`, token, {
      estado: 'APROBADA',
    })

    const respuesta = await patch(
      `/api/v1/matriculas/${creada.body.id}`,
      token,
      { estado: 'RETIRADA' },
    )

    expect(respuesta.status).toBe(200)
    expect(respuesta.body.estado).toBe('RETIRADA')
  })

  it('no reabre una matrícula retirada', async () => {
    const { anio, seccion } = await crearEstructura()
    const alumno = await crearAlumno()
    await crearApoderadoPrincipal(alumno.id)
    const token = await tokenDe(['SUPER_ADMIN'])

    const creada = await post('/api/v1/matriculas', token, {
      alumnoId: alumno.id,
      seccionId: seccion.id,
      anioId: anio.id,
    })

    await patch(`/api/v1/matriculas/${creada.body.id}`, token, {
      estado: 'RETIRADA',
    })

    const respuesta = await patch(
      `/api/v1/matriculas/${creada.body.id}`,
      token,
      { estado: 'APROBADA' },
    )

    expect(respuesta.status).toBe(409)
  })

  it('no permite volver al estado SOLICITADA', async () => {
    const { anio, seccion } = await crearEstructura()
    const alumno = await crearAlumno()
    await crearApoderadoPrincipal(alumno.id)
    const token = await tokenDe(['SUPER_ADMIN'])

    const creada = await post('/api/v1/matriculas', token, {
      alumnoId: alumno.id,
      seccionId: seccion.id,
      anioId: anio.id,
    })

    await patch(`/api/v1/matriculas/${creada.body.id}`, token, {
      estado: 'APROBADA',
    })

    const respuesta = await patch(
      `/api/v1/matriculas/${creada.body.id}`,
      token,
      { estado: 'SOLICITADA' },
    )

    expect(respuesta.status).toBe(409)
  })

  it('repetir el estado actual es idempotente', async () => {
    const { anio, seccion } = await crearEstructura()
    const alumno = await crearAlumno()
    const token = await tokenDe(['SUPER_ADMIN'])

    const creada = await post('/api/v1/matriculas', token, {
      alumnoId: alumno.id,
      seccionId: seccion.id,
      anioId: anio.id,
    })

    const respuesta = await patch(
      `/api/v1/matriculas/${creada.body.id}`,
      token,
      { estado: 'SOLICITADA' },
    )

    expect(respuesta.status).toBe(200)
    expect(respuesta.body.estado).toBe('SOLICITADA')
  })

  it('devuelve 404 al editar una matrícula inexistente', async () => {
    const token = await tokenDe(['SUPER_ADMIN'])

    const respuesta = await patch(
      '/api/v1/matriculas/00000000-0000-4000-8000-000000000099',
      token,
      { estado: 'RETIRADA' },
    )

    expect(respuesta.status).toBe(404)
  })

  it('valida los datos de creación y el estado', async () => {
    const { anio, seccion } = await crearEstructura()
    const alumno = await crearAlumno()
    const token = await tokenDe(['SUPER_ADMIN'])

    const sinAnio = await post('/api/v1/matriculas', token, {
      alumnoId: alumno.id,
      seccionId: seccion.id,
    })

    const creada = await post('/api/v1/matriculas', token, {
      alumnoId: alumno.id,
      seccionId: seccion.id,
      anioId: anio.id,
    })

    const estadoInvalido = await patch(
      `/api/v1/matriculas/${creada.body.id}`,
      token,
      { estado: 'ANULADA' },
    )

    expect(sinAnio.status).toBe(400)
    expect(estadoInvalido.status).toBe(400)
  })

  it('una matrícula retirada sigue ocupando la unicidad del alumno y año', async () => {
    const { anio, seccion } = await crearEstructura()
    const alumno = await crearAlumno()
    const token = await tokenDe(['SUPER_ADMIN'])

    const creada = await post('/api/v1/matriculas', token, {
      alumnoId: alumno.id,
      seccionId: seccion.id,
      anioId: anio.id,
    })

    await patch(`/api/v1/matriculas/${creada.body.id}`, token, {
      estado: 'RETIRADA',
    })

    const respuesta = await post('/api/v1/matriculas', token, {
      alumnoId: alumno.id,
      seccionId: seccion.id,
      anioId: anio.id,
    })

    expect(respuesta.status).toBe(409)
  })
})
