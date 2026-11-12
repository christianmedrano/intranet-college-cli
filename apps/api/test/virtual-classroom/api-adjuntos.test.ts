import type { FastifyInstance } from 'fastify'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../../src/app.js'
import { createTestPrisma, limpiarBaseDePruebas } from '../helpers/test-db.js'
import {
  crearEscenarioVirtual,
  type EscenarioVirtual,
} from './escenario.js'

const RUTA_MATERIALES = '/api/v1/virtual/materiales'
const RUTA_ADJUNTOS = '/api/v1/virtual/adjuntos'

const PDF = Buffer.from('%PDF-1.4 contenido de prueba')

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'API de adjuntos del aula virtual',
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

    function subirAdjunto(token: string, materialId = escenario.materialAId) {
      return conToken(
        request(app.server).post(`${RUTA_MATERIALES}/${materialId}/adjuntos`),
        token,
      ).attach('archivo', PDF, {
        filename: 'guia.pdf',
        contentType: 'application/pdf',
      })
    }

    describe('autenticación y permisos', () => {
      it('exige token en los cuatro endpoints', async () => {
        await request(app.server)
          .post(`${RUTA_MATERIALES}/${escenario.materialAId}/adjuntos`)
          .expect(401)

        await request(app.server)
          .get(`${RUTA_MATERIALES}/${escenario.materialAId}/adjuntos`)
          .expect(401)

        await request(app.server)
          .delete(`${RUTA_ADJUNTOS}/00000000-0000-4000-8000-0000000000aa?materialId=${escenario.materialAId}`)
          .expect(401)

        await request(app.server)
          .get(`${RUTA_ADJUNTOS}/00000000-0000-4000-8000-0000000000aa/download?materialId=${escenario.materialAId}`)
          .expect(401)
      })

      it('403 cuando el Alumno intenta subir un adjunto', async () => {
        await subirAdjunto(escenario.alumnoA.token).expect(403)
      })
    })

    describe('POST /virtual/materiales/:id/adjuntos', () => {
      it('201 sube el adjunto del docente asignado', async () => {
        const respuesta = await subirAdjunto(escenario.docenteA.token).expect(201)

        expect(respuesta.body.materialId).toBe(escenario.materialAId)
        expect(respuesta.body.nombreOriginal).toBe('guia.pdf')
        expect(respuesta.body.url).toContain(
          `/api/v1/virtual/materiales/${escenario.materialAId}/adjuntos/`,
        )
      })

      it('400 si no se envía archivo', async () => {
        await conToken(
          request(app.server).post(`${RUTA_MATERIALES}/${escenario.materialAId}/adjuntos`),
          escenario.docenteA.token,
        )
          .field('descripcion', 'sin archivo')
          .expect(400)
      })

      it('400 si el MIME no está permitido', async () => {
        await conToken(
          request(app.server).post(`${RUTA_MATERIALES}/${escenario.materialAId}/adjuntos`),
          escenario.docenteA.token,
        )
          .attach('archivo', Buffer.from('texto plano'), {
            filename: 'notas.txt',
            contentType: 'text/plain',
          })
          .expect(400)
      })

      it('403 si el docente no está asignado a la sección', async () => {
        await subirAdjunto(escenario.docenteB.token).expect(403)
      })
    })

    describe('GET /virtual/materiales/:id/adjuntos', () => {
      it('200 lista los adjuntos al alumno vinculado', async () => {
        await subirAdjunto(escenario.docenteA.token).expect(201)

        const respuesta = await conToken(
          request(app.server).get(`${RUTA_MATERIALES}/${escenario.materialAId}/adjuntos`),
          escenario.alumnoA.token,
        ).expect(200)

        expect(respuesta.body).toHaveLength(1)
        expect(respuesta.body[0].nombreOriginal).toBe('guia.pdf')
      })

      it('403 al alumno de otra sección', async () => {
        await subirAdjunto(escenario.docenteA.token).expect(201)

        await conToken(
          request(app.server).get(`${RUTA_MATERIALES}/${escenario.materialAId}/adjuntos`),
          escenario.alumnoB.token,
        ).expect(403)
      })
    })

    describe('DELETE /virtual/adjuntos/:id', () => {
      it('204 elimina el adjunto al docente dueño', async () => {
        const creado = await subirAdjunto(escenario.docenteA.token).expect(201)

        await conToken(
          request(app.server).delete(
            `${RUTA_ADJUNTOS}/${creado.body.id}?materialId=${escenario.materialAId}`,
          ),
          escenario.docenteA.token,
        ).expect(204)

        await expect(
          prisma.adjuntoVirtual.findUnique({ where: { id: creado.body.id } }),
        ).resolves.toBeNull()
      })

      it('400 si falta materialId en la query', async () => {
        const creado = await subirAdjunto(escenario.docenteA.token).expect(201)

        await conToken(
          request(app.server).delete(`${RUTA_ADJUNTOS}/${creado.body.id}`),
          escenario.docenteA.token,
        ).expect(400)
      })

      it('403 si el docente no está asignado a la sección', async () => {
        const creado = await subirAdjunto(escenario.docenteA.token).expect(201)

        await conToken(
          request(app.server).delete(
            `${RUTA_ADJUNTOS}/${creado.body.id}?materialId=${escenario.materialAId}`,
          ),
          escenario.docenteB.token,
        ).expect(403)
      })
    })

    describe('GET /virtual/adjuntos/:id/download', () => {
      it('200 devuelve metadatos al alumno vinculado', async () => {
        const creado = await subirAdjunto(escenario.docenteA.token).expect(201)

        const respuesta = await conToken(
          request(app.server).get(
            `${RUTA_ADJUNTOS}/${creado.body.id}/download?materialId=${escenario.materialAId}`,
          ),
          escenario.alumnoA.token,
        ).expect(200)

        expect(respuesta.body).toMatchObject({
          nombreOriginal: 'guia.pdf',
          archivoMime: 'application/pdf',
        })
        expect(respuesta.body.url).toBe(
          `/api/v1/virtual/materiales/${escenario.materialAId}/adjuntos/${creado.body.id}/file`,
        )
      })

      it('403 al alumno de otra sección', async () => {
        const creado = await subirAdjunto(escenario.docenteA.token).expect(201)

        await conToken(
          request(app.server).get(
            `${RUTA_ADJUNTOS}/${creado.body.id}/download?materialId=${escenario.materialAId}`,
          ),
          escenario.alumnoB.token,
        ).expect(403)
      })

      it('404 si el adjunto no existe', async () => {
        await conToken(
          request(app.server).get(
            `${RUTA_ADJUNTOS}/00000000-0000-4000-8000-0000000000ab/download?materialId=${escenario.materialAId}`,
          ),
          escenario.director.token,
        ).expect(404)
      })
    })
  },
)
