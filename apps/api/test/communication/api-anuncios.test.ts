import { paginatedAnunciosSchema } from '@intranet/shared'
import type { FastifyInstance } from 'fastify'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../../src/app.js'
import type { PrismaClient } from '../../src/generated/prisma/client.js'
import { createTestPrisma, limpiarBaseDePruebas } from '../helpers/test-db.js'
import { crearEscenarioComunicacion, INSTITUCION_ID, type EscenarioComunicacion } from './escenario.js'

describe.skipIf(!process.env.TEST_DATABASE_URL)('API anuncios', () => {
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

  function patch(ruta: string, token: string, cuerpo: unknown) {
    return request(app.server)
      .patch(ruta)
      .set('Authorization', `Bearer ${token}`)
      .send(cuerpo as object)
  }

  function borrar(ruta: string, token: string) {
    return request(app.server).delete(ruta).set('Authorization', `Bearer ${token}`)
  }

  function anuncioInstitucional(extra: Record<string, unknown> = {}) {
    return {
      titulo: 'Reunión de padres',
      cuerpo: 'Se convoca a reunión el viernes.',
      tipo: 'INSTITUCIONAL',
      estado: 'PUBLICADO',
      anioId: escenario.anioId,
      audienciaRoles: ['APODERADO', 'ALUMNO'],
      ...extra,
    }
  }

  it('exige autenticación en todas las rutas de anuncios', async () => {
    const respuestas = [
      await get('/api/v1/anuncios'),
      await get(`/api/v1/anuncios/${escenario.anuncioInstitucionalId}`),
      await request(app.server).post('/api/v1/anuncios').send({}),
      await request(app.server).patch('/api/v1/anuncios/x').send({}),
      await request(app.server).delete('/api/v1/anuncios/x'),
    ]

    for (const respuesta of respuestas) {
      expect(respuesta.status).toBe(401)
    }
  })

  it('el Director crea un anuncio institucional publicado (RF-COM-001)', async () => {
    const respuesta = await post('/api/v1/anuncios', escenario.director.token, anuncioInstitucional())

    expect(respuesta.status).toBe(201)
    expect(respuesta.body).toMatchObject({
      titulo: 'Reunión de padres',
      tipo: 'INSTITUCIONAL',
      estado: 'PUBLICADO',
      anioId: escenario.anioId,
      audienciaRoles: ['APODERADO', 'ALUMNO'],
      adjuntos: [],
    })
    expect(respuesta.body.autorId).toBe(escenario.director.usuarioId)

    const guardado = await prisma.anuncio.findUnique({ where: { id: respuesta.body.id } })
    expect(guardado?.institucionId).toBe(INSTITUCION_ID)
  })

  it('registra la creación en auditoría', async () => {
    const respuesta = await post('/api/v1/anuncios', escenario.director.token, anuncioInstitucional())

    const auditoria = await prisma.auditoria.findFirst({
      where: { entidad: 'ANUNCIO', entidadId: respuesta.body.id, accion: 'CREAR' },
    })

    expect(auditoria?.usuarioId).toBe(escenario.director.usuarioId)
  })

  it('rechaza un anuncio institucional sin audiencia (RF-COM-001)', async () => {
    const respuesta = await post(
      '/api/v1/anuncios',
      escenario.director.token,
      anuncioInstitucional({ audienciaRoles: [] }),
    )

    expect(respuesta.status).toBe(400)
    expect(respuesta.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('rechaza el anuncio a un docente sin permiso de gestión (RF-COM-001)', async () => {
    const respuesta = await post('/api/v1/anuncios', escenario.docenteTutor.token, anuncioInstitucional())

    expect(respuesta.status).toBe(403)
    expect(respuesta.body.error.code).toBe('FORBIDDEN')
  })

  it('rechaza el anuncio a un apoderado', async () => {
    const respuesta = await post('/api/v1/anuncios', escenario.apoderadoA.token, anuncioInstitucional())

    expect(respuesta.status).toBe(403)
  })

  it('el Director lista y filtra por rol y sección (RF-COM-003)', async () => {
    const todos = await get('/api/v1/anuncios', escenario.director.token)
    expect(todos.status).toBe(200)
    expect(todos.body.meta.total).toBe(5)

    const porRol = await get('/api/v1/anuncios?rol=APODERADO', escenario.director.token)
    expect(porRol.body.meta.total).toBe(2)

    const porSeccion = await get(`/api/v1/anuncios?seccionId=${escenario.seccionAId}`, escenario.director.token)
    expect(porSeccion.body.meta.total).toBe(1)
    expect(porSeccion.body.data[0].id).toBe(escenario.anuncioSeccionAId)

    const porTipo = await get('/api/v1/anuncios?tipo=SECCION', escenario.director.token)
    expect(porTipo.body.meta.total).toBe(2)
  })

  it('el apoderado solo recibe anuncios publicados y de su alcance (RF-COM-003)', async () => {
    const respuesta = await get('/api/v1/anuncios', escenario.apoderadoA.token)

    expect(respuesta.status).toBe(200)
    const ids = respuesta.body.data.map((a: { id: string }) => a.id)
    expect(ids).toContain(escenario.anuncioInstitucionalId)
    expect(ids).toContain(escenario.anuncioPorNivelId)
    expect(ids).toContain(escenario.anuncioSeccionAId)
    expect(ids).not.toContain(escenario.anuncioBorradorId)
    expect(ids).not.toContain(escenario.anuncioSeccionBId)

    for (const anuncio of respuesta.body.data) {
      expect(anuncio.estado).toBe('PUBLICADO')
    }
  })

  it('el apoderado no puede leer por id un anuncio de otra sección', async () => {
    const respuesta = await get(`/api/v1/anuncios/${escenario.anuncioSeccionBId}`, escenario.apoderadoA.token)

    expect(respuesta.status).toBe(404)
  })

  it('el docente tutor lee su anuncio de sección por id', async () => {
    const respuesta = await get(`/api/v1/anuncios/${escenario.anuncioSeccionAId}`, escenario.docenteTutor.token)

    expect(respuesta.status).toBe(200)
    expect(respuesta.body.id).toBe(escenario.anuncioSeccionAId)
  })

  it('el autor actualiza su anuncio y se audita con anterior y nuevo', async () => {
    const respuesta = await patch(
      `/api/v1/anuncios/${escenario.anuncioInstitucionalId}`,
      escenario.director.token,
      { titulo: 'Reunión de padres (actualizada)' },
    )

    expect(respuesta.status).toBe(200)
    expect(respuesta.body.titulo).toBe('Reunión de padres (actualizada)')

    const auditoria = await prisma.auditoria.findFirst({
      where: {
        entidad: 'ANUNCIO',
        entidadId: escenario.anuncioInstitucionalId,
        accion: 'ACTUALIZAR',
      },
    })

    expect(auditoria).not.toBeNull()
  })

  it('rechaza la actualización a un docente', async () => {
    const respuesta = await patch(
      `/api/v1/anuncios/${escenario.anuncioInstitucionalId}`,
      escenario.docenteTutor.token,
      { titulo: 'Intento' },
    )

    expect(respuesta.status).toBe(403)
  })

  it('devuelve 404 al actualizar un anuncio inexistente', async () => {
    const respuesta = await patch(
      '/api/v1/anuncios/00000000-0000-4000-8000-0000000000aa',
      escenario.director.token,
      { titulo: 'Fantasma' },
    )

    expect(respuesta.status).toBe(404)
  })

  it('archiva el anuncio y deja de aparecer en el listado', async () => {
    const respuesta = await borrar(`/api/v1/anuncios/${escenario.anuncioInstitucionalId}`, escenario.director.token)
    expect(respuesta.status).toBe(204)

    const listado = await get('/api/v1/anuncios', escenario.director.token)
    const ids = listado.body.data.map((a: { id: string }) => a.id)
    expect(ids).not.toContain(escenario.anuncioInstitucionalId)

    const guardado = await prisma.anuncio.findUnique({ where: { id: escenario.anuncioInstitucionalId } })
    expect(guardado?.deletedAt).not.toBeNull()
  })

  it('rechaza el archivado a un docente', async () => {
    const respuesta = await borrar(`/api/v1/anuncios/${escenario.anuncioInstitucionalId}`, escenario.docenteTutor.token)

    expect(respuesta.status).toBe(403)
  })

  it('el listado expone adjuntos con url relativa válida para el contrato (RF-COM-006)', async () => {
    await prisma.adjuntoAnuncio.create({
      data: {
        anuncioId: escenario.anuncioInstitucionalId,
        nombreOriginal: 'circular.pdf',
        nombreAlmacenado: 'circular-123.pdf',
        tipoMime: 'application/pdf',
        tamanoBytes: 1024,
      },
    })

    const respuesta = await get('/api/v1/anuncios', escenario.director.token)

    expect(respuesta.status).toBe(200)
    const anuncio = respuesta.body.data.find(
      (a: { id: string }) => a.id === escenario.anuncioInstitucionalId,
    )
    expect(anuncio.adjuntos).toHaveLength(1)
    expect(anuncio.adjuntos[0].url).toBe(
      `/api/v1/anuncios/adjuntos/${anuncio.adjuntos[0].id}/download`,
    )

    // El contrato compartido debe aceptar la respuesta sin lanzar (regresión: url absoluta).
    expect(() => paginatedAnunciosSchema.parse(respuesta.body)).not.toThrow()
  })

  it('el SuperAdmin deja registro al consultar el listado (RF-COM-003)', async () => {
    await get('/api/v1/anuncios', escenario.superAdmin.token)

    const auditoria = await prisma.auditoria.findFirst({
      where: { entidad: 'ANUNCIO', accion: 'ACCEDER', usuarioId: escenario.superAdmin.usuarioId },
    })

    expect(auditoria).not.toBeNull()
  })
})
