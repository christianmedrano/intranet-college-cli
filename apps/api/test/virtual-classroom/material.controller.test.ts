import type { FastifyInstance } from 'fastify'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../../src/app.js'
import { createTestPrisma, limpiarBaseDePruebas } from '../helpers/test-db.js'
import {
  crearEscenarioVirtual,
  type EscenarioVirtual,
} from './escenario.js'

const RUTA = '/api/v1/virtual/materiales'

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'API de materiales del aula virtual',
  () => {
    let app: FastifyInstance
    const prisma = createTestPrisma()
    let escenario: EscenarioVirtual

    beforeAll(async () => {
      app = await buildApp()
      await app.ready()
    })

    beforeEach(async () => {
      await limpiarBaseDePruebas(prisma)
      escenario = await crearEscenarioVirtual(prisma)
    })

    afterAll(async () => {
      await app.close()
      await prisma.$disconnect()
    })

    function conToken(peticion: request.Test, token: string): request.Test {
      return peticion.set('Authorization', `Bearer ${token}`)
    }

    function conAnio(peticion: request.Test): request.Test {
      return peticion.set('x-anio-academico', escenario.anioId)
    }

    function cuerpoNuevo(cambios: Record<string, unknown> = {}) {
      return {
        cursoId: escenario.cursoId,
        seccionId: escenario.seccionAId,
        periodoId: escenario.periodoId,
        titulo: `Material ${crypto.randomUUID().slice(0, 8)}`,
        descripcion: 'Material de prueba',
        archivoNombre: 'guia.pdf',
        archivoMime: 'application/pdf',
        tamanoBytes: 2048,
        ...cambios,
      }
    }

    describe('autenticación y permisos', () => {
      it('exige token en los seis endpoints', async () => {
        await request(app.server).get(`${RUTA}`).expect(401)
        await request(app.server).post(`${RUTA}`).send(cuerpoNuevo()).expect(401)
        await request(app.server).get(`${RUTA}/${escenario.materialAId}`).expect(401)
        await request(app.server).patch(`${RUTA}/${escenario.materialAId}`).send({ titulo: 'x' }).expect(401)
        await request(app.server).delete(`${RUTA}/${escenario.materialAId}`).expect(401)
        await request(app.server).get(`${RUTA}/${escenario.materialAId}/download`).expect(401)
      })

      it('rechaza al Alumno que intenta crear', async () => {
        await conToken(request(app.server).post(RUTA), escenario.alumnoA.token)
          .send(cuerpoNuevo())
          .expect(403)
      })
    })

    describe('POST /virtual/materiales', () => {
      it('201 crea el material del docente asignado', async () => {
        const respuesta = await conToken(
          request(app.server).post(RUTA),
          escenario.docenteA.token,
        )
          .send(cuerpoNuevo({ titulo: 'Guía de fracciones' }))
          .expect(201)

        expect(respuesta.body.titulo).toBe('Guía de fracciones')
        expect(respuesta.body.docenteId).toBe(escenario.docenteAId)
        expect(respuesta.body.adjuntos).toEqual([])
      })

      it('400 si falta el título', async () => {
        const sinTitulo = cuerpoNuevo({ titulo: undefined })

        const respuesta = await conToken(
          request(app.server).post(RUTA),
          escenario.docenteA.token,
        )
          .send(sinTitulo)
          .expect(400)

        expect(respuesta.body.error.code).toBe('VALIDATION_ERROR')
      })

      it('400 si el MIME no está permitido', async () => {
        await conToken(request(app.server).post(RUTA), escenario.docenteA.token)
          .send(cuerpoNuevo({ archivoMime: 'text/plain' }))
          .expect(400)
      })

      it('403 si el docente no tiene asignación en la sección', async () => {
        await conToken(
          request(app.server).post(RUTA),
          escenario.docenteSinAsignacion.token,
        )
          .send(cuerpoNuevo())
          .expect(403)
      })

      it('409 si duplica docente, curso, sección, período y título', async () => {
        const cuerpo = cuerpoNuevo({ titulo: 'Material repetido' })

        await conToken(request(app.server).post(RUTA), escenario.docenteA.token)
          .send(cuerpo)
          .expect(201)

        await conToken(request(app.server).post(RUTA), escenario.docenteA.token)
          .send(cuerpo)
          .expect(409)
      })
    })

    describe('GET /virtual/materiales', () => {
      it('400 si falta el header de año académico', async () => {
        await conToken(
          request(app.server).get(RUTA),
          escenario.director.token,
        ).expect(400)
      })

      it('200 devuelve el listado paginado para el Director', async () => {
        const respuesta = await conAnio(
          conToken(request(app.server).get(RUTA), escenario.director.token),
        ).expect(200)

        expect(respuesta.body.meta).toEqual({ page: 1, pageSize: 20, total: 2 })
        expect(respuesta.body.data).toHaveLength(2)
      })

      it('200 limita al Alumno a su propia sección', async () => {
        const respuesta = await conAnio(
          conToken(request(app.server).get(RUTA), escenario.alumnoA.token),
        ).expect(200)

        expect(respuesta.body.data.map((fila: { id: string }) => fila.id)).toEqual([
          escenario.materialAId,
        ])
      })

      it('200 aplica el filtro de sección', async () => {
        const respuesta = await conAnio(
          conToken(
            request(app.server).get(`${RUTA}?seccionId=${escenario.seccionBId}`),
            escenario.director.token,
          ),
        ).expect(200)

        expect(respuesta.body.data.map((fila: { id: string }) => fila.id)).toEqual([
          escenario.materialBId,
        ])
      })
    })

    describe('GET /virtual/materiales/:id', () => {
      it('200 devuelve el detalle con adjuntos al alumno vinculado', async () => {
        await prisma.adjuntoVirtual.create({
          data: {
            materialId: escenario.materialAId,
            nombreOriginal: 'anexo.pdf',
            nombreAlmacenado: 'uploads/virtual/adjuntos/anexo.pdf',
            tipoMime: 'application/pdf',
            tamanoBytes: 128,
          },
        })

        const respuesta = await conAnio(
          conToken(
            request(app.server).get(`${RUTA}/${escenario.materialAId}`),
            escenario.alumnoA.token,
          ),
        ).expect(200)

        expect(respuesta.body.id).toBe(escenario.materialAId)
        expect(respuesta.body.adjuntos).toHaveLength(1)
      })

      it('403 para el alumno de otra sección', async () => {
        await conAnio(
          conToken(
            request(app.server).get(`${RUTA}/${escenario.materialAId}`),
            escenario.alumnoB.token,
          ),
        ).expect(403)
      })

      it('404 si el material está eliminado', async () => {
        await conAnio(
          conToken(
            request(app.server).get(`${RUTA}/${escenario.materialEliminadoId}`),
            escenario.director.token,
          ),
        ).expect(404)
      })
    })

    describe('PATCH /virtual/materiales/:id', () => {
      it('200 actualiza al docente dueño', async () => {
        const respuesta = await conToken(
          request(app.server).patch(`${RUTA}/${escenario.materialAId}`),
          escenario.docenteA.token,
        )
          .send({ titulo: 'Título corregido' })
          .expect(200)

        expect(respuesta.body.titulo).toBe('Título corregido')
      })

      it('403 para el docente que no es dueño', async () => {
        await conToken(
          request(app.server).patch(`${RUTA}/${escenario.materialAId}`),
          escenario.docenteB.token,
        )
          .send({ titulo: 'Intento ajeno' })
          .expect(403)
      })
    })

    describe('DELETE /virtual/materiales/:id', () => {
      it('204 aplica la baja lógica al docente dueño', async () => {
        await conToken(
          request(app.server).delete(`${RUTA}/${escenario.materialAId}`),
          escenario.docenteA.token,
        ).expect(204)

        const fila = await prisma.materialVirtual.findUnique({
          where: { id: escenario.materialAId },
          select: { deletedAt: true },
        })

        expect(fila?.deletedAt).not.toBeNull()
      })

      it('403 para el docente que no es dueño', async () => {
        await conToken(
          request(app.server).delete(`${RUTA}/${escenario.materialAId}`),
          escenario.docenteB.token,
        ).expect(403)
      })
    })

    describe('GET /virtual/materiales/:id/download', () => {
      it('200 devuelve la ruta relativa y los metadatos', async () => {
        const respuesta = await conAnio(
          conToken(
            request(app.server).get(`${RUTA}/${escenario.materialAId}/download`),
            escenario.alumnoA.token,
          ),
        ).expect(200)

        expect(respuesta.body).toMatchObject({
          url: `/api/v1/virtual/materiales/${escenario.materialAId}/file`,
          archivoNombre: 'material.pdf',
          archivoMime: 'application/pdf',
          tamanoBytes: 2048,
        })
      })

      it('403 para el alumno de otra sección', async () => {
        await conAnio(
          conToken(
            request(app.server).get(`${RUTA}/${escenario.materialAId}/download`),
            escenario.alumnoB.token,
          ),
        ).expect(403)
      })
    })
  },
)
