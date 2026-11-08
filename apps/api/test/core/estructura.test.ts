import type { FastifyInstance } from 'fastify'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../../src/app.js'
import { signAccessToken } from '../../src/core/auth/tokens.js'
import { createTestPrisma, limpiarBaseDePruebas } from '../helpers/test-db.js'

/**
 * Pruebas de integración de la estructura escolar completa (T028).
 *
 * A diferencia de las suites por recurso, aquí se recorre el flujo real de la
 * institución: año → períodos → niveles/grados/secciones → cursos →
 * asignaciones → matrícula. Cubre RF-CORE-008 a RF-CORE-011 y RF-CORE-015.
 */
describe.skipIf(!process.env.TEST_DATABASE_URL)('estructura escolar integrada', () => {
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

    return String(74_000_000 + documentos)
  }

  async function crearInstitucion() {
    return prisma.institucion.create({ data: { nombre: 'IE San Martín' } })
  }

  async function crearUsuarioConRoles(roles: string[]) {
    secuencia += 1

    const persona = await prisma.persona.create({
      data: {
        nombres: `Usuario${secuencia}`,
        apellidos: 'De Prueba',
        tipoDocumento: 'DNI',
        numeroDocumento: String(42_000_000 + secuencia),
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

  function post(ruta: string, token: string, cuerpo: unknown = {}) {
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

  async function crearAnioApi(token: string, nombre = '2026') {
    return post('/api/v1/anios-academicos', token, {
      nombre,
      fechaInicio: `${nombre}-03-01`,
      fechaFin: `${nombre}-12-15`,
    })
  }

  async function crearPeriodoApi(
    token: string,
    anioId: string,
    datos: {
      nombre: string
      orden: number
      fechaInicio: string
      fechaFin: string
    },
  ) {
    return post(`/api/v1/anios-academicos/${anioId}/periodos`, token, datos)
  }

  /**
   * Crea año, nivel, grado, sección y curso mediante la API.
   *
   * Devuelve los identificadores para encadenar asignaciones y matrículas.
   */
  async function crearEstructuraCompleta(token: string) {
    const anioRespuesta = await crearAnioApi(token)

    expect(anioRespuesta.status).toBe(201)

    const nivelRespuesta = await post('/api/v1/niveles', token, {
      nombre: 'Primaria',
      orden: 1,
    })

    expect(nivelRespuesta.status).toBe(201)

    const gradoRespuesta = await post('/api/v1/grados', token, {
      nivelId: nivelRespuesta.body.id,
      nombre: '1.°',
      orden: 1,
    })

    expect(gradoRespuesta.status).toBe(201)

    const seccionRespuesta = await post('/api/v1/secciones', token, {
      gradoId: gradoRespuesta.body.id,
      anioId: anioRespuesta.body.id,
      nombre: 'A',
      capacidad: 30,
    })

    expect(seccionRespuesta.status).toBe(201)

    const cursoRespuesta = await post('/api/v1/cursos', token, {
      nivelId: nivelRespuesta.body.id,
      nombre: 'Matemática',
      area: 'Ciencia y Tecnología',
      orden: 1,
    })

    expect(cursoRespuesta.status).toBe(201)

    return {
      anio: anioRespuesta.body,
      nivel: nivelRespuesta.body,
      grado: gradoRespuesta.body,
      seccion: seccionRespuesta.body,
      curso: cursoRespuesta.body,
    }
  }

  async function crearDocenteApi(token: string) {
    const respuesta = await post('/api/v1/docentes', token, {
      persona: {
        nombres: 'Luis',
        apellidos: 'Vargas Torres',
        tipoDocumento: 'DNI',
        numeroDocumento: siguienteDocumento(),
      },
      codigoDocente: `DO-${siguienteDocumento()}`,
    })

    expect(respuesta.status).toBe(201)

    return respuesta.body
  }

  async function crearAlumnoApi(token: string) {
    const respuesta = await post('/api/v1/alumnos', token, {
      persona: {
        nombres: 'Ana',
        apellidos: 'Quispe Rojas',
        tipoDocumento: 'DNI',
        numeroDocumento: siguienteDocumento(),
      },
      codigoAlumno: `AL-${siguienteDocumento()}`,
    })

    expect(respuesta.status).toBe(201)

    return respuesta.body
  }

  it('configura cuatro períodos bimestrales y los lista del 1 al 4', async () => {
    await crearInstitucion()
    const token = await tokenDe(['DIRECTOR'])
    const anio = await crearAnioApi(token)

    expect(anio.status).toBe(201)

    const bimestres = [
      { orden: 1, fechaInicio: '2026-03-01', fechaFin: '2026-04-30' },
      { orden: 2, fechaInicio: '2026-05-01', fechaFin: '2026-06-30' },
      { orden: 3, fechaInicio: '2026-07-15', fechaFin: '2026-09-15' },
      { orden: 4, fechaInicio: '2026-09-16', fechaFin: '2026-12-15' },
    ]

    for (const bimestre of bimestres) {
      const respuesta = await crearPeriodoApi(token, anio.body.id, {
        nombre: `Bimestre ${bimestre.orden}`,
        ...bimestre,
      })

      expect(respuesta.status).toBe(201)
      expect(respuesta.body.estado).toBe('PLANIFICADO')
    }

    const listado = await get(
      `/api/v1/anios-academicos/${anio.body.id}/periodos`,
      token,
    )

    expect(listado.status).toBe(200)
    expect(listado.body.meta).toEqual({ page: 1, pageSize: 20, total: 4 })
    expect(
      listado.body.data.map((periodo: { orden: number }) => periodo.orden),
    ).toEqual([1, 2, 3, 4])
  })

  it('configura tres períodos trimestrales y los lista del 1 al 3', async () => {
    await crearInstitucion()
    const token = await tokenDe(['SUPER_ADMIN'])
    const anio = await crearAnioApi(token)

    const trimestres = [
      { orden: 1, fechaInicio: '2026-03-01', fechaFin: '2026-05-31' },
      { orden: 2, fechaInicio: '2026-06-01', fechaFin: '2026-09-15' },
      { orden: 3, fechaInicio: '2026-09-16', fechaFin: '2026-12-15' },
    ]

    for (const trimestre of trimestres) {
      const respuesta = await crearPeriodoApi(token, anio.body.id, {
        nombre: `Trimestre ${trimestre.orden}`,
        ...trimestre,
      })

      expect(respuesta.status).toBe(201)
    }

    const listado = await get(
      `/api/v1/anios-academicos/${anio.body.id}/periodos`,
      token,
    )

    expect(listado.status).toBe(200)
    expect(listado.body.meta.total).toBe(3)
    expect(
      listado.body.data.map((periodo: { orden: number }) => periodo.orden),
    ).toEqual([1, 2, 3])
  })

  it('activa un año y cierra el anterior: solo queda uno activo', async () => {
    await crearInstitucion()
    const token = await tokenDe(['DIRECTOR'])
    const primero = await crearAnioApi(token, '2026')
    const segundo = await crearAnioApi(token, '2027')

    expect(primero.body.estado).toBe('PLANIFICADO')
    expect(segundo.body.estado).toBe('PLANIFICADO')

    const activacionPrimero = await post(
      `/api/v1/anios-academicos/${primero.body.id}/activar`,
      token,
    )
    const activacionSegundo = await post(
      `/api/v1/anios-academicos/${segundo.body.id}/activar`,
      token,
    )

    expect(activacionPrimero.status).toBe(200)
    expect(activacionPrimero.body.estado).toBe('ACTIVO')
    expect(activacionSegundo.status).toBe(200)
    expect(activacionSegundo.body.estado).toBe('ACTIVO')

    const listado = await get('/api/v1/anios-academicos?pageSize=100', token)
    const activos = listado.body.data.filter(
      (anio: { estado: string }) => anio.estado === 'ACTIVO',
    )
    const anterior = listado.body.data.find(
      (anio: { id: string }) => anio.id === primero.body.id,
    )

    expect(activos).toHaveLength(1)
    expect(activos[0].id).toBe(segundo.body.id)
    expect(anterior.estado).toBe('CERRADO')
  })

  it('cierra un período, es idempotente y bloquea su edición', async () => {
    await crearInstitucion()
    const token = await tokenDe(['DIRECTOR'])
    const anio = await crearAnioApi(token)
    const periodo = await crearPeriodoApi(token, anio.body.id, {
      nombre: 'Bimestre 1',
      orden: 1,
      fechaInicio: '2026-03-01',
      fechaFin: '2026-04-30',
    })

    const primerCierre = await post(
      `/api/v1/periodos/${periodo.body.id}/cerrar`,
      token,
    )
    const segundoCierre = await post(
      `/api/v1/periodos/${periodo.body.id}/cerrar`,
      token,
    )

    expect(primerCierre.status).toBe(200)
    expect(primerCierre.body.estado).toBe('CERRADO')
    expect(segundoCierre.status).toBe(200)
    expect(segundoCierre.body.estado).toBe('CERRADO')

    const edicion = await patch(`/api/v1/periodos/${periodo.body.id}`, token, {
      nombre: 'Bimestre 1 bis',
    })

    expect(edicion.status).toBe(409)
    expect(edicion.body).toMatchObject({ error: { code: 'CONFLICT' } })

    const persistido = await prisma.periodoAcademico.findUniqueOrThrow({
      where: { id: periodo.body.id },
    })

    expect(persistido.estado).toBe('CERRADO')
    expect(persistido.nombre).toBe('Bimestre 1')
  })

  it('recorre nivel, grado, sección, curso y asignación docente', async () => {
    await crearInstitucion()
    const token = await tokenDe(['DIRECTOR'])
    const estructura = await crearEstructuraCompleta(token)
    const docente = await crearDocenteApi(token)

    const asignacion = await post('/api/v1/asignaciones-docente', token, {
      docenteId: docente.id,
      cursoId: estructura.curso.id,
      seccionId: estructura.seccion.id,
      anioId: estructura.anio.id,
    })

    expect(asignacion.status).toBe(201)
    expect(asignacion.body).toMatchObject({
      docenteId: docente.id,
      cursoId: estructura.curso.id,
      seccionId: estructura.seccion.id,
      anioId: estructura.anio.id,
      docente: { codigoDocente: docente.codigoDocente },
      curso: {
        id: estructura.curso.id,
        nombre: 'Matemática',
        nivelId: estructura.nivel.id,
      },
      seccion: {
        id: estructura.seccion.id,
        nombre: 'A',
        gradoId: estructura.grado.id,
      },
      anio: { id: estructura.anio.id, nombre: '2026' },
    })

    const duplicada = await post('/api/v1/asignaciones-docente', token, {
      docenteId: docente.id,
      cursoId: estructura.curso.id,
      seccionId: estructura.seccion.id,
      anioId: estructura.anio.id,
    })

    expect(duplicada.status).toBe(409)
    expect(duplicada.body).toMatchObject({ error: { code: 'CONFLICT' } })

    const listado = await get(
      `/api/v1/asignaciones-docente?seccionId=${estructura.seccion.id}`,
      token,
    )

    expect(listado.status).toBe(200)
    expect(listado.body.meta.total).toBe(1)
  })

  it('matricula a un alumno en la estructura y rechaza el duplicado', async () => {
    await crearInstitucion()
    const token = await tokenDe(['SUPER_ADMIN'])
    const estructura = await crearEstructuraCompleta(token)
    const alumno = await crearAlumnoApi(token)

    const matricula = await post('/api/v1/matriculas', token, {
      alumnoId: alumno.id,
      seccionId: estructura.seccion.id,
      anioId: estructura.anio.id,
    })

    expect(matricula.status).toBe(201)
    expect(matricula.body).toMatchObject({
      alumnoId: alumno.id,
      seccionId: estructura.seccion.id,
      anioId: estructura.anio.id,
      estado: 'SOLICITADA',
      alumno: { id: alumno.id, persona: { nombres: 'Ana' } },
      anio: { id: estructura.anio.id, nombre: '2026' },
      nivel: { id: estructura.nivel.id, nombre: 'Primaria' },
      grado: { id: estructura.grado.id, nombre: '1.°' },
      seccion: { id: estructura.seccion.id, nombre: 'A' },
    })

    const duplicada = await post('/api/v1/matriculas', token, {
      alumnoId: alumno.id,
      seccionId: estructura.seccion.id,
      anioId: estructura.anio.id,
    })

    expect(duplicada.status).toBe(409)
    expect(duplicada.body).toMatchObject({ error: { code: 'CONFLICT' } })

    const historial = await get(
      `/api/v1/matriculas?alumnoId=${alumno.id}`,
      token,
    )

    expect(historial.status).toBe(200)
    expect(historial.body.meta.total).toBe(1)
    expect(historial.body.data[0].anioId).toBe(estructura.anio.id)
  })
})
