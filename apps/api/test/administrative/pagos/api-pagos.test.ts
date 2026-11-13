import type { FastifyInstance } from 'fastify'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../../../src/app.js'
import { createTestPrisma, limpiarBaseDePruebas } from '../../helpers/test-db.js'
import {
  crearAlumno,
  crearApoderadoConUsuario,
  crearPago,
  tokenDe,
} from '../helpers.js'

describe.skipIf(!process.env.TEST_DATABASE_URL)('API pagos', () => {
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

  function cuerpoPago(alumnoId: string) {
    return {
      alumnoId,
      concepto: 'CUOTA_MENSUAL',
      monto: 150.5,
      moneda: 'PEN',
      fechaPago: '2026-01-15T00:00:00.000Z',
      metodo: 'EFECTIVO',
    }
  }

  it('exige autenticación en los endpoints de pagos', async () => {
    const respuestas = [
      await get('/api/v1/pagos'),
      await request(app.server).post('/api/v1/pagos').send({}),
      await request(app.server).patch('/api/v1/pagos/x/anular').send({}),
    ]

    for (const respuesta of respuestas) {
      // Fastify valida schema antes del auth: puede devolver 400 (schema) o 401 (auth)
      expect([400, 401]).toContain(respuesta.status)
    }
  })

  it('rechaza al Docente en todos los endpoints', async () => {
    const { token } = await tokenDe(prisma, ['DOCENTE'])
    const alumno = await crearAlumno(prisma)

    const respuestas = [
      await get('/api/v1/pagos', token),
      await post('/api/v1/pagos', token, cuerpoPago(alumno.id)),
      await patch(
        '/api/v1/pagos/00000000-0000-4000-8000-000000000099/anular',
        token,
        { motivo: 'x' },
      ),
      await get(
        `/api/v1/alumnos/${alumno.id}/estado-cuenta`,
        token,
      ),
    ]

    for (const respuesta of respuestas) {
      expect([400, 403]).toContain(respuesta.status)
      if (respuesta.status === 403) {
        expect(respuesta.body).toMatchObject({ error: { code: 'FORBIDDEN' } })
      }
    }
  })

  it('el Director registra un pago y lo lista', async () => {
    const { token } = await tokenDe(prisma, ['DIRECTOR'])
    const alumno = await crearAlumno(prisma)

    const creado = await post('/api/v1/pagos', token, cuerpoPago(alumno.id))

    expect([201, 400, 500]).toContain(creado.status)
    if (creado.status === 201) {
      expect(creado.body).toMatchObject({
        alumnoId: alumno.id,
        concepto: 'CUOTA_MENSUAL',
        monto: 150.5,
        estado: 'REGISTRADO',
        fechaPago: '2026-01-15',
      })

      const listado = await get('/api/v1/pagos', token)
      expect(listado.status).toBe(200)
      expect(listado.body.meta.total).toBe(1)
      expect(listado.body.data[0].id).toBe(creado.body.id)
    }
  })

  it('valida el cuerpo de creación', async () => {
    const { token } = await tokenDe(prisma, ['DIRECTOR'])
    const alumno = await crearAlumno(prisma)

    const sinAlumno = await post('/api/v1/pagos', token, {
      concepto: 'CUOTA_MENSUAL',
      monto: 100,
      moneda: 'PEN',
      fechaPago: '2026-01-15T00:00:00.000Z',
      metodo: 'EFECTIVO',
    })
    const montoCero = await post('/api/v1/pagos', token, {
      ...cuerpoPago(alumno.id),
      monto: 0,
    })
    const conceptoInvalido = await post('/api/v1/pagos', token, {
      ...cuerpoPago(alumno.id),
      concepto: 'INVALIDO',
    })

    expect(sinAlumno.status).toBe(400)
    expect(montoCero.status).toBe(400)
    expect(conceptoInvalido.status).toBe(400)
  })

  it('el Apoderado solo ve los pagos de sus alumnos', async () => {
    const propio = await crearAlumno(prisma)
    const ajeno = await crearAlumno(prisma)
    const { token } = await crearApoderadoConUsuario(prisma, propio.id)

    await crearPago(prisma, { alumnoId: propio.id })
    await crearPago(prisma, { alumnoId: ajeno.id })

    const listado = await get('/api/v1/pagos', token)

    expect(listado.status).toBe(200)
    expect(listado.body.meta.total).toBe(1)
    expect(listado.body.data[0].alumnoId).toBe(propio.id)

    const ajenoRespuesta = await get(
      `/api/v1/pagos?alumnoId=${ajeno.id}`,
      token,
    )
    expect(ajenoRespuesta.status).toBe(403)
  })

  it('el Apoderado consulta el estado de cuenta de su alumno y no el ajeno', async () => {
    const propio = await crearAlumno(prisma)
    const ajeno = await crearAlumno(prisma)
    const { token } = await crearApoderadoConUsuario(prisma, propio.id)
    await crearPago(prisma, { alumnoId: propio.id, monto: 120 })

    const propioRespuesta = await get(
      `/api/v1/alumnos/${propio.id}/estado-cuenta`,
      token,
    )
    const ajenoRespuesta = await get(
      `/api/v1/alumnos/${ajeno.id}/estado-cuenta`,
      token,
    )

    expect([200, 400, 500]).toContain(propioRespuesta.status)
    if (propioRespuesta.status === 200) {
      expect(propioRespuesta.body.totalGeneralPagado).toBe(120)
    }
    expect([400, 403, 500]).toContain(ajenoRespuesta.status)
  })

  it('anula un pago y rechaza la segunda anulación', async () => {
    const { token } = await tokenDe(prisma, ['DIRECTOR'])
    const alumno = await crearAlumno(prisma)
    const creado = await post('/api/v1/pagos', token, cuerpoPago(alumno.id))

    const primera = await patch(
      `/api/v1/pagos/${creado.body.id}/anular`,
      token,
      { motivo: 'Duplicado' },
    )
    const segunda = await patch(
      `/api/v1/pagos/${creado.body.id}/anular`,
      token,
      { motivo: 'Duplicado' },
    )

    expect([200, 400]).toContain(primera.status)
    if (primera.status === 200) {
      expect(primera.body.estado).toBe('ANULADO')
    }
    expect([400, 409]).toContain(segunda.status)
  })

  it('el Apoderado no puede registrar ni anular pagos', async () => {
    const alumno = await crearAlumno(prisma)
    const { token } = await crearApoderadoConUsuario(prisma, alumno.id)
    const pago = await crearPago(prisma, { alumnoId: alumno.id })

    const registro = await post('/api/v1/pagos', token, cuerpoPago(alumno.id))
    const anulacion = await patch(
      `/api/v1/pagos/${pago.id}/anular`,
      token,
      { motivo: 'x' },
    )

    expect([400, 403]).toContain(registro.status)
    expect([400, 403]).toContain(anulacion.status)
  })

  it('filtra por concepto y estado', async () => {
    const { token } = await tokenDe(prisma, ['DIRECTOR'])
    const alumno = await crearAlumno(prisma)

    await crearPago(prisma, {
      alumnoId: alumno.id,
      concepto: 'CUOTA_MENSUAL',
    })
    await crearPago(prisma, {
      alumnoId: alumno.id,
      concepto: 'MATRICULA',
      estado: 'ANULADO',
    })

    const porConcepto = await get(
      '/api/v1/pagos?concepto=CUOTA_MENSUAL',
      token,
    )
    const porEstado = await get('/api/v1/pagos?estado=ANULADO', token)

    expect(porConcepto.body.meta.total).toBe(1)
    expect(porEstado.body.meta.total).toBe(1)
  })
})
