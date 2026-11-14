import { paginatedMensajesSchema } from '@intranet/shared'
import type { FastifyInstance } from 'fastify'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../../src/app.js'
import type { PrismaClient } from '../../src/generated/prisma/client.js'
import { createTestPrisma, limpiarBaseDePruebas } from '../helpers/test-db.js'
import { crearEscenarioComunicacion, type EscenarioComunicacion } from './escenario.js'

describe.skipIf(!process.env.TEST_DATABASE_URL)('API mensajería de sección', () => {
  let app: FastifyInstance
  let prisma: PrismaClient
  let escenario: EscenarioComunicacion

  beforeAll(async () => {
    prisma = createTestPrisma()
    app = await buildApp()
    await app.ready()
  })

  beforeEach(async () => {
    await limpiarBaseDePruebas(prisma)
    escenario = await crearEscenarioComunicacion(prisma)
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

  function borrar(ruta: string, token: string) {
    return request(app.server).delete(ruta).set('Authorization', `Bearer ${token}`)
  }

  function mensajesDe(seccionId: string) {
    return `/api/v1/secciones/${seccionId}/mensajes`
  }

  async function enviarComoTutor(cuerpo = 'Estimados padres, confirmo la reunión.') {
    const respuesta = await post(mensajesDe(escenario.seccionAId), escenario.docenteTutor.token, { cuerpo })
    expect(respuesta.status).toBe(201)

    return respuesta.body as { id: string; hiloId: string; autorRol: string; autorNombre: string }
  }

  it('exige autenticación en las rutas de mensajería', async () => {
    const respuestas = [
      await get(mensajesDe(escenario.seccionAId)),
      await request(app.server).post(mensajesDe(escenario.seccionAId)).send({}),
      await request(app.server).delete('/api/v1/mensajes/x'),
    ]

    for (const respuesta of respuestas) {
      expect(respuesta.status).toBe(401)
    }
  })

  it('el docente tutor envía un mensaje y se crea el hilo (RF-COM-004)', async () => {
    const respuesta = await post(mensajesDe(escenario.seccionAId), escenario.docenteTutor.token, {
      cuerpo: 'Estimados padres, confirmo la reunión.',
    })

    expect(respuesta.status).toBe(201)
    expect(respuesta.body).toMatchObject({
      hiloId: escenario.hiloSeccionAId,
      autorId: escenario.docenteTutor.usuarioId,
      autorRol: 'DOCENTE',
      cuerpo: 'Estimados padres, confirmo la reunión.',
      adjuntos: [],
    })
    expect(respuesta.body.autorNombre).toContain('Persona')

    const auditoria = await prisma.auditoria.findFirst({
      where: { entidad: 'MENSAJE_SECCION', entidadId: respuesta.body.id, accion: 'CREAR' },
    })
    expect(auditoria).not.toBeNull()
  })

  it('crea el hilo en el primer mensaje de una sección sin hilo (RF-COM-004)', async () => {
    const respuesta = await post(mensajesDe(escenario.seccionAId), escenario.docenteTutor.token, {
      cuerpo: 'Primer mensaje del hilo.',
    })

    expect(respuesta.status).toBe(201)
    expect(respuesta.body.hiloId).toBe(escenario.hiloSeccionAId)
    expect(await prisma.hiloMensajeria.count({ where: { seccionId: escenario.seccionAId } })).toBe(1)
  })

  it('el apoderado con matrícula aprobada envía un mensaje', async () => {
    const respuesta = await post(mensajesDe(escenario.seccionAId), escenario.apoderadoA.token, {
      cuerpo: 'Gracias, ahí estaremos.',
    })

    expect(respuesta.status).toBe(201)
    expect(respuesta.body.autorRol).toBe('APODERADO')
  })

  it('rechaza al docente que no es tutor de la sección (RF-COM-004)', async () => {
    const respuesta = await post(mensajesDe(escenario.seccionAId), escenario.docenteNoTutor.token, {
      cuerpo: 'No debería poder.',
    })

    expect(respuesta.status).toBe(403)
    expect(respuesta.body.error.code).toBe('FORBIDDEN')
  })

  it('rechaza al apoderado sin vínculo con la sección', async () => {
    const respuesta = await post(mensajesDe(escenario.seccionAId), escenario.apoderadoSinVinculo.token, {
      cuerpo: 'No debería poder.',
    })

    expect(respuesta.status).toBe(403)
  })

  it('rechaza la escritura al Director y al SuperAdmin (solo lectura)', async () => {
    const director = await post(mensajesDe(escenario.seccionAId), escenario.director.token, {
      cuerpo: 'Mensaje del director.',
    })
    const superAdmin = await post(mensajesDe(escenario.seccionAId), escenario.superAdmin.token, {
      cuerpo: 'Mensaje del superadmin.',
    })

    expect(director.status).toBe(403)
    expect(superAdmin.status).toBe(403)
  })

  it('rechaza al Alumno en lectura y escritura (MVP)', async () => {
    const lectura = await get(mensajesDe(escenario.seccionAId), escenario.alumnoA.token)
    const escritura = await post(mensajesDe(escenario.seccionAId), escenario.alumnoA.token, { cuerpo: 'Hola.' })

    expect(lectura.status).toBe(403)
    expect(escritura.status).toBe(403)
  })

  it('valida el cuerpo vacío', async () => {
    const respuesta = await post(mensajesDe(escenario.seccionAId), escenario.docenteTutor.token, { cuerpo: '  ' })

    expect(respuesta.status).toBe(400)
    expect(respuesta.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('el docente tutor lista el hilo con el rol real del autor (RF-COM-005)', async () => {
    await enviarComoTutor()

    const respuesta = await get(mensajesDe(escenario.seccionAId), escenario.docenteTutor.token)

    expect(respuesta.status).toBe(200)
    expect(respuesta.body.meta.total).toBe(1)
    expect(respuesta.body.data[0]).toMatchObject({
      autorRol: 'DOCENTE',
      cuerpo: 'Estimados padres, confirmo la reunión.',
    })
    expect(() => paginatedMensajesSchema.parse(respuesta.body)).not.toThrow()
  })

  it('devuelve los mensajes más recientes primero', async () => {
    await enviarComoTutor('Primero')
    await enviarComoTutor('Segundo')

    const respuesta = await get(mensajesDe(escenario.seccionAId), escenario.docenteTutor.token)
    const cuerpos = respuesta.body.data.map((m: { cuerpo: string }) => m.cuerpo)

    expect(cuerpos).toHaveLength(2)
    expect(new Set(cuerpos)).toEqual(new Set(['Primero', 'Segundo']))
  })

  it('acepta el listado sin seccionId en la query (regresión)', async () => {
    await enviarComoTutor()

    const respuesta = await get(mensajesDe(escenario.seccionAId), escenario.docenteTutor.token)

    expect(respuesta.status).toBe(200)
  })

  it('devuelve lista vacía si la sección aún no tiene hilo', async () => {
    const respuesta = await get(mensajesDe(escenario.seccionBId), escenario.superAdmin.token)

    expect(respuesta.status).toBe(200)
    expect(respuesta.body.data).toEqual([])
    expect(respuesta.body.meta.total).toBe(0)
  })

  it('el SuperAdmin supervisa el hilo y deja auditoría', async () => {
    await enviarComoTutor()

    const respuesta = await get(mensajesDe(escenario.seccionAId), escenario.superAdmin.token)

    expect(respuesta.status).toBe(200)
    expect(respuesta.body.meta.total).toBe(1)

    const auditoria = await prisma.auditoria.findFirst({
      where: { entidad: 'MENSAJE_SECCION', accion: 'ACCEDER', usuarioId: escenario.superAdmin.usuarioId },
    })
    expect(auditoria).not.toBeNull()
  })

  it('el Director no puede supervisar el hilo sin denuncia formal (⚠¹⁶)', async () => {
    await enviarComoTutor()

    const respuesta = await get(mensajesDe(escenario.seccionAId), escenario.director.token)

    expect(respuesta.status).toBe(403)
  })

  it('el apoderado vinculado lee el hilo', async () => {
    await enviarComoTutor()

    const respuesta = await get(mensajesDe(escenario.seccionAId), escenario.apoderadoA.token)

    expect(respuesta.status).toBe(200)
    expect(respuesta.body.meta.total).toBe(1)
  })

  it('el autor archiva su mensaje y desaparece del hilo (RF-COM-005)', async () => {
    const mensaje = await enviarComoTutor()

    const borrado = await borrar(`/api/v1/mensajes/${mensaje.id}`, escenario.docenteTutor.token)
    expect(borrado.status).toBe(204)

    const listado = await get(mensajesDe(escenario.seccionAId), escenario.docenteTutor.token)
    expect(listado.body.meta.total).toBe(0)
  })

  it('solo el autor puede archivar su mensaje', async () => {
    const mensaje = await enviarComoTutor()

    const respuesta = await borrar(`/api/v1/mensajes/${mensaje.id}`, escenario.apoderadoA.token)

    expect(respuesta.status).toBe(403)
    expect(respuesta.body.error.code).toBe('FORBIDDEN')
  })

  it('devuelve 404 al archivar un mensaje inexistente', async () => {
    const respuesta = await borrar(
      '/api/v1/mensajes/00000000-0000-4000-8000-0000000000bb',
      escenario.docenteTutor.token,
    )

    expect(respuesta.status).toBe(404)
  })

  it('expone los adjuntos del mensaje con url relativa (RF-COM-006)', async () => {
    const mensaje = await enviarComoTutor()
    await prisma.adjuntoMensaje.create({
      data: {
        mensajeId: mensaje.id,
        nombreOriginal: 'circular.pdf',
        nombreAlmacenado: 'circular-456.pdf',
        tipoMime: 'application/pdf',
        tamanoBytes: 2048,
      },
    })

    const respuesta = await get(mensajesDe(escenario.seccionAId), escenario.docenteTutor.token)

    expect(respuesta.body.data[0].adjuntos).toHaveLength(1)
    expect(respuesta.body.data[0].adjuntos[0].url).toBe(
      `/api/v1/mensajes/adjuntos/${respuesta.body.data[0].adjuntos[0].id}/download`,
    )
    expect(() => paginatedMensajesSchema.parse(respuesta.body)).not.toThrow()
  })
})
