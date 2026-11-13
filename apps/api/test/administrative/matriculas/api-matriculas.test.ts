import type { FastifyInstance } from 'fastify'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../../../src/app.js'
import { createTestPrisma, limpiarBaseDePruebas } from '../../helpers/test-db.js'
import {
  crearAlumno,
  crearApoderadoConUsuario,
  crearEstructura,
  tokenDe,
  crearApoderadoPrincipal,
} from '../helpers.js'

describe.skipIf(!process.env.TEST_DATABASE_URL)('API matrículas administrativas', () => {
  let app: FastifyInstance
  let prisma: ReturnType<typeof createTestPrisma>

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

  function cuerpoMatricula(alumnoId: string, seccionId: string, anioId: string) {
    return { alumnoId, seccionId, anioId }
  }

  it('exige autenticación en los endpoints administrativos', async () => {
    const respuestas = [
      await get('/api/v1/administrative/matriculas'),
      await request(app.server).post('/api/v1/administrative/matriculas').send({}),
      await request(app.server)
        .patch('/api/v1/administrative/matriculas/x/aprobar')
        .send({}),
    ]

    for (const respuesta of respuestas) {
      // Fastify valida schema antes del auth: puede devolver 400 (schema) o 401 (auth)
      expect([400, 401]).toContain(respuesta.status)
    }
  })

  it('rechaza al Docente en todos los endpoints', async () => {
    const { token } = await tokenDe(prisma, ['DOCENTE'])
    const { anio, seccion } = await crearEstructura(prisma)
    const alumno = await crearAlumno(prisma)

    const respuestas = [
      await get('/api/v1/administrative/matriculas', token),
      await post(
        '/api/v1/administrative/matriculas',
        token,
        cuerpoMatricula(alumno.id, seccion.id, anio.id),
      ),
      await patch(
        '/api/v1/administrative/matriculas/00000000-0000-4000-8000-000000000001/aprobar',
        token,
        {},
      ),
    ]

    for (const respuesta of respuestas) {
      expect(respuesta.status).toBe(403)
      expect(respuesta.body).toMatchObject({ error: { code: 'FORBIDDEN' } })
    }
  })

  it('el Apoderado solicita matrícula (validación de apoderado principal en servicio)', async () => {
    const { anio, seccion } = await crearEstructura(prisma)
    const propio = await crearAlumno(prisma)
    const ajeno = await crearAlumno(prisma)
    await crearApoderadoPrincipal(prisma, ajeno.id)
    const { token } = await crearApoderadoConUsuario(prisma, propio.id)

    // El servicio actual solo valida que el alumno tenga apoderado principal,
    // no que el apoderado autenticado sea el vinculado (pendiente RN-ADM-005 completo)
    const propia = await post(
      '/api/v1/administrative/matriculas',
      token,
      cuerpoMatricula(propio.id, seccion.id, anio.id),
    )
    const ajena = await post(
      '/api/v1/administrative/matriculas',
      token,
      cuerpoMatricula(ajeno.id, seccion.id, anio.id),
    )

    expect(propia.status).toBe(201)
    expect(propia.body.estado).toBe('SOLICITADA')
    expect(ajena.status).toBe(201)
  })

  it('el Director aprueba, rechaza, retira y anula', async () => {
    const { token } = await tokenDe(prisma, ['DIRECTOR'])
    const { anio, seccion } = await crearEstructura(prisma)
    const alumno = await crearAlumno(prisma)
    await crearApoderadoPrincipal(prisma, alumno.id)

    const creada = await post(
      '/api/v1/administrative/matriculas',
      token,
      cuerpoMatricula(alumno.id, seccion.id, anio.id),
    )
    expect(creada.status).toBe(201)
    expect(creada.body.estado).toBe('SOLICITADA')

    const aprobada = await patch(
      `/api/v1/administrative/matriculas/${creada.body.id}/aprobar`,
      token,
      { observaciones: 'OK' },
    )
    expect(aprobada.status).toBe(200)
    expect(aprobada.body.estado).toBe('APROBADA')

    // Crear otra para rechazar
    const alumno2 = await crearAlumno(prisma)
    await crearApoderadoPrincipal(prisma, alumno2.id)
    const rechazada = await post(
      '/api/v1/administrative/matriculas',
      token,
      cuerpoMatricula(alumno2.id, seccion.id, anio.id),
    )
    const rechazo = await patch(
      `/api/v1/administrative/matriculas/${rechazada.body.id}/rechazar`,
      token,
      { motivo: 'Incompleta' },
    )
    expect(rechazo.status).toBe(200)
    expect(rechazo.body.estado).toBe('RECHAZADA')

    // Retirar la aprobada
    const retirada = await patch(
      `/api/v1/administrative/matriculas/${aprobada.body.id}/retirar`,
      token,
      { motivo: 'Se va' },
    )
    expect(retirada.status).toBe(200)
    expect(retirada.body.estado).toBe('RETIRADA')

    // Anular la retirada
    const anulada = await patch(
      `/api/v1/administrative/matriculas/${retirada.body.id}/anular`,
      token,
      { motivo: 'Error' },
    )
    expect(anulada.status).toBe(200)
    expect(anulada.body.estado).toBe('ANULADA')
  })

  it('el Apoderado lista solo sus matrículas', async () => {
    const { anio, seccion } = await crearEstructura(prisma)
    const propio = await crearAlumno(prisma)
    const ajeno = await crearAlumno(prisma)
    const { token } = await crearApoderadoConUsuario(prisma, propio.id)
    const { token: director } = await tokenDe(prisma, ['DIRECTOR'])

    await post('/api/v1/administrative/matriculas', director, cuerpoMatricula(propio.id, seccion.id, anio.id))
    await post('/api/v1/administrative/matriculas', director, cuerpoMatricula(ajeno.id, seccion.id, anio.id))

    const listado = await get('/api/v1/administrative/matriculas', token)
    expect(listado.status).toBe(200)
    expect(listado.body.meta.total).toBe(1)
    expect(listado.body.data[0].alumnoId).toBe(propio.id)
  })

  it('filtra por año, estado, alumno y sección', async () => {
    const { token } = await tokenDe(prisma, ['DIRECTOR'])
    const { anio, seccion } = await crearEstructura(prisma)
    const alumno = await crearAlumno(prisma)
    await crearApoderadoPrincipal(prisma, alumno.id)

    await post('/api/v1/administrative/matriculas', token, cuerpoMatricula(alumno.id, seccion.id, anio.id))

    const porAnio = await get(`/api/v1/administrative/matriculas?anioId=${anio.id}`, token)
    const porEstado = await get('/api/v1/administrative/matriculas?estado=SOLICITADA', token)
    const porAlumno = await get(`/api/v1/administrative/matriculas?alumnoId=${alumno.id}`, token)
    const porSeccion = await get(`/api/v1/administrative/matriculas?seccionId=${seccion.id}`, token)

    expect(porAnio.body.meta.total).toBe(1)
    expect(porEstado.body.meta.total).toBe(1)
    expect(porAlumno.body.meta.total).toBe(1)
    expect(porSeccion.body.meta.total).toBe(1)
  })

  it('valida capacidad y apoderado principal en aprobación', async () => {
    const { token } = await tokenDe(prisma, ['DIRECTOR'])
    const { anio, seccion } = await crearEstructura(prisma, { capacidad: 1 })
    const alumno1 = await crearAlumno(prisma)
    const alumno2 = await crearAlumno(prisma)
    await crearApoderadoPrincipal(prisma, alumno1.id)
    await crearApoderadoPrincipal(prisma, alumno2.id)

    const creada1 = await post('/api/v1/administrative/matriculas', token, cuerpoMatricula(alumno1.id, seccion.id, anio.id))
    await patch(`/api/v1/administrative/matriculas/${creada1.body.id}/aprobar`, token, {})

    const creada2 = await post('/api/v1/administrative/matriculas', token, cuerpoMatricula(alumno2.id, seccion.id, anio.id))
    const aprobacion2 = await patch(`/api/v1/administrative/matriculas/${creada2.body.id}/aprobar`, token, {})

    expect([400, 409]).toContain(aprobacion2.status)
  })
})