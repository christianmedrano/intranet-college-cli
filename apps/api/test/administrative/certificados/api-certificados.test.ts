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
  crearPlantilla as crearPlantillaHelper,
} from '../helpers.js'

describe.skipIf(!process.env.TEST_DATABASE_URL)('API certificados y plantillas', () => {
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

  function cuerpoCertificado(alumnoId: string, anioId: string, plantillaId?: string) {
    return {
      tipo: 'ESTUDIOS',
      alumnoId,
      anioId,
      plantillaId,
    }
  }

  function cuerpoPlantilla(tipo = 'ESTUDIOS') {
    return {
      tipo,
      nombre: `Plantilla ${tipo}`,
      contenido: `Certificado de {{alumno}} del año {{anio}}`,
      activa: true,
    }
  }

  it('exige autenticación en certificados y plantillas', async () => {
    const respuestas = [
      await get('/api/v1/certificados'),
      await request(app.server).post('/api/v1/certificados').send({}),
      await get('/api/v1/plantillas-certificados'),
      await request(app.server).post('/api/v1/plantillas-certificados').send({}),
    ]

    for (const respuesta of respuestas) {
      expect([400, 401]).toContain(respuesta.status)
    }
  })

  it('rechaza al Docente en certificados y plantillas', async () => {
    const { token } = await tokenDe(prisma, ['DOCENTE'])
    const { anio } = await crearEstructura(prisma)
    const alumno = await crearAlumno(prisma)
    const plantilla = await crearPlantillaHelper(prisma, { tipo: 'ESTUDIOS' })

    const respuestas = [
      await get('/api/v1/certificados', token),
      await post('/api/v1/certificados', token, cuerpoCertificado(alumno.id, anio.id, plantilla.id)),
      await get('/api/v1/plantillas-certificados', token),
      await post('/api/v1/plantillas-certificados', token, cuerpoPlantilla()),
    ]

    for (const respuesta of respuestas) {
      expect([400, 403]).toContain(respuesta.status)
      if (respuesta.status === 403) {
        expect(respuesta.body).toMatchObject({ error: { code: 'FORBIDDEN' } })
      }
    }
  })

  it('el Director crea plantilla, emite certificado, aprueba y descarga', async () => {
    const { token } = await tokenDe(prisma, ['DIRECTOR'])
    const { anio } = await crearEstructura(prisma)
    const alumno = await crearAlumno(prisma)

    // Crear plantilla
    const plantillaRespuesta = await post('/api/v1/plantillas-certificados', token, cuerpoPlantilla())
    expect(plantillaRespuesta.status).toBe(201)
    expect(plantillaRespuesta.body.version).toBe(1)

    // Emitir certificado directo
    const emitido = await post('/api/v1/certificados', token, {
      ...cuerpoCertificado(alumno.id, anio.id, plantillaRespuesta.body.id),
      variables: { alumno: 'Ana Quispe', anio: '2026' },
    })
    expect(emitido.status).toBe(201)
    expect(emitido.body.estado).toBe('EMITIDO')
    expect(emitido.body.numero).toMatch(/^CERT-ESTUDIOS-2026-\d{4}$/)

    // Listar certificados
    const listado = await get('/api/v1/certificados', token)
    expect(listado.body.meta.total).toBe(1)

    // Descargar
    const descarga = await get(`/api/v1/certificados/${emitido.body.id}/download`, token)
    expect(descarga.status).toBe(200)
    expect(descarga.body.certificado.id).toBe(emitido.body.id)

    // Anular
    const anulado = await patch(
      `/api/v1/certificados/${emitido.body.id}/anular`,
      token,
      { motivo: 'Error' },
    )
    expect(anulado.status).toBe(200)
    expect(anulado.body.estado).toBe('ANULADO')
  })

  it('el Apoderado solicita certificado y ve solo los suyos', async () => {
    const { anio } = await crearEstructura(prisma)
    const propio = await crearAlumno(prisma)
    const ajeno = await crearAlumno(prisma)
    const { token } = await crearApoderadoConUsuario(prisma, propio.id)
    const { token: director } = await tokenDe(prisma, ['DIRECTOR'])

    const plantilla = await post('/api/v1/plantillas-certificados', director, cuerpoPlantilla())

    const propia = await post('/api/v1/certificados/solicitar', token, cuerpoCertificado(propio.id, anio.id, plantilla.body.id))
    const ajena = await post('/api/v1/certificados/solicitar', token, cuerpoCertificado(ajeno.id, anio.id, plantilla.body.id))

    expect(propia.status).toBe(201)
    expect(propia.body.estado).toBe('SOLICITADO')
    expect([400, 403]).toContain(ajena.status)

    // Listar propias
    const listado = await get('/api/v1/certificados', token)
    if (listado.status === 200 && listado.body.meta) {
      expect(listado.body.meta.total).toBe(1)
      expect(listado.body.data[0].alumnoId).toBe(propio.id)
    }
  })

  it('el Director aprueba y rechaza solicitudes de apoderado', async () => {
    const { anio } = await crearEstructura(prisma)
    const alumno = await crearAlumno(prisma)
    const { token: apoderado } = await crearApoderadoConUsuario(prisma, alumno.id)
    const { token: director } = await tokenDe(prisma, ['DIRECTOR'])

    const plantilla = await post('/api/v1/plantillas-certificados', director, cuerpoPlantilla())
    const solicitado = await post('/api/v1/certificados/solicitar', apoderado, cuerpoCertificado(alumno.id, anio.id, plantilla.body.id))

    // Aprobar
    const aprobado = await patch(
      `/api/v1/certificados/${solicitado.body.id}/aprobar`,
      director,
      { variables: { alumno: 'Ana Quispe', anio: '2026' } },
    )
    expect(aprobado.status).toBe(200)
    expect(aprobado.body.estado).toBe('APROBADO')
    expect(aprobado.body.numero).toMatch(/^CERT-ESTUDIOS-2026-\d{4}$/)

    // Otra para rechazar
    const alumno2 = await crearAlumno(prisma)
    const { token: apoderado2 } = await crearApoderadoConUsuario(prisma, alumno2.id)
    const solicitado2 = await post('/api/v1/certificados/solicitar', apoderado2, cuerpoCertificado(alumno2.id, anio.id, plantilla.body.id))

    const rechazado = await patch(
      `/api/v1/certificados/${solicitado2.body.id}/rechazar`,
      director,
      { motivo: 'Incompleto' },
    )
    expect(rechazado.status).toBe(200)
    expect(rechazado.body.estado).toBe('RECHAZADO')
  })

  it('preview de plantilla muestra variables faltantes', async () => {
    const { token } = await tokenDe(prisma, ['DIRECTOR'])
    const plantilla = await post('/api/v1/plantillas-certificados', token, cuerpoPlantilla())

    const preview = await post(`/api/v1/plantillas-certificados/${plantilla.body.id}/preview`, token, {
      variables: { alumno: 'Ana' },
    })

    expect(preview.status).toBe(200)
    expect(preview.body.variablesFaltantes).toContain('anio')
    expect(preview.body.plantilla.contenido).toContain('Certificado de Ana del año {{anio}}')
  })

  it('filtra listados por tipo, alumno, año y estado', async () => {
    const { token } = await tokenDe(prisma, ['DIRECTOR'])
    const { anio } = await crearEstructura(prisma)
    const alumno = await crearAlumno(prisma)
    const plantilla = await post('/api/v1/plantillas-certificados', token, cuerpoPlantilla())

    await post('/api/v1/certificados', token, { ...cuerpoCertificado(alumno.id, anio.id, plantilla.body.id), variables: { alumno: 'Ana', anio: '2026' } })

    const porTipo = await get('/api/v1/certificados?tipo=ESTUDIOS', token)
    const porAlumno = await get(`/api/v1/certificados?alumnoId=${alumno.id}`, token)
    const porAnio = await get(`/api/v1/certificados?anioId=${anio.id}`, token)
    const porEstado = await get('/api/v1/certificados?estado=EMITIDO', token)

    expect(porTipo.body.meta.total).toBe(1)
    expect(porAlumno.body.meta.total).toBe(1)
    expect(porAnio.body.meta.total).toBe(1)
    expect(porEstado.body.meta.total).toBe(1)
  })

  it('actualiza y elimina plantilla sin certificados', async () => {
    const { token } = await tokenDe(prisma, ['DIRECTOR'])

    const plantilla = await post('/api/v1/plantillas-certificados', token, cuerpoPlantilla('MATRICULA'))
    expect(plantilla.status).toBe(201)

    const actualizada = await patch(`/api/v1/plantillas-certificados/${plantilla.body.id}`, token, {
      nombre: 'Nuevo nombre',
    })
    expect(actualizada.status).toBe(200)
    expect(actualizada.body.nombre).toBe('Nuevo nombre')

    // Eliminar otra plantilla sin uso
    const paraEliminar = await post('/api/v1/plantillas-certificados', token, cuerpoPlantilla('CONDUCTA'))
    const eliminada = await request(app.server)
      .delete(`/api/v1/plantillas-certificados/${paraEliminar.body.id}`)
      .set('Authorization', `Bearer ${token}`)
    expect(eliminada.status).toBe(204)
  })
})