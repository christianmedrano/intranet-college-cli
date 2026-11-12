import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import {
  eliminarAdjunto,
  listarAdjuntos,
  prepararDescargaAdjunto,
  subirAdjunto,
} from '../../src/modules/virtual-classroom/adjuntos/adjunto.service.js'
import type { ActorVirtual } from '../../src/modules/virtual-classroom/materiales/material.scope.js'
import { createTestPrisma, limpiarBaseDePruebas } from '../helpers/test-db.js'
import {
  INSTITUCION_ID,
  crearEscenarioVirtual,
  type EscenarioVirtual,
} from './escenario.js'

const CONTEXTO = { ip: '127.0.0.1', userAgent: 'vitest' }

function actor(
  usuarioId: string,
  roles: ActorVirtual['roles'],
): ActorVirtual {
  return { id: usuarioId, roles, institucionId: INSTITUCION_ID }
}

function archivoPdf(): {
  buffer: Buffer
  originalname: string
  mimetype: string
  size: number
} {
  const buffer = Buffer.from('%PDF-1.4 contenido de prueba')

  return {
    buffer,
    originalname: 'guia.pdf',
    mimetype: 'application/pdf',
    size: buffer.length,
  }
}

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'adjunto.service — adjuntos del aula virtual',
  () => {
    const prisma = createTestPrisma()
    let escenario: EscenarioVirtual

    beforeEach(async () => {
      await limpiarBaseDePruebas(prisma)
      escenario = await crearEscenarioVirtual(prisma)
    })

    afterAll(async () => {
      await prisma.$disconnect()
    })

    async function crearAdjuntoDeMaterialA(): Promise<string> {
      const adjunto = await prisma.adjuntoVirtual.create({
        data: {
          materialId: escenario.materialAId,
          nombreOriginal: 'anexo.pdf',
          nombreAlmacenado: 'uploads/virtual/adjuntos/anexo.pdf',
          tipoMime: 'application/pdf',
          tamanoBytes: 256,
        },
      })

      return adjunto.id
    }

    describe('subirAdjunto', () => {
      it('sube el adjunto del docente asignado y audita CREAR', async () => {
        const adjunto = await subirAdjunto(
          actor(escenario.docenteA.usuarioId, ['DOCENTE']),
          escenario.materialAId,
          archivoPdf(),
          CONTEXTO,
          prisma,
        )

        expect(adjunto.materialId).toBe(escenario.materialAId)
        expect(adjunto.nombreOriginal).toBe('guia.pdf')
        expect(adjunto.url).toBe(
          `/api/v1/virtual/materiales/${escenario.materialAId}/adjuntos/${adjunto.id}/download`,
        )

        const auditoria = await prisma.auditoria.findFirst({
          where: {
            entidad: 'AdjuntoVirtual',
            entidadId: adjunto.id,
            accion: 'CREAR',
          },
        })

        expect(auditoria).not.toBeNull()
      })

      it('rechaza al docente de otra sección', async () => {
        await expect(
          subirAdjunto(
            actor(escenario.docenteB.usuarioId, ['DOCENTE']),
            escenario.materialAId,
            archivoPdf(),
            CONTEXTO,
            prisma,
          ),
        ).rejects.toMatchObject({ code: 'FORBIDDEN' })
      })

      it('rechaza a un usuario sin permiso de gestión', async () => {
        await expect(
          subirAdjunto(
            actor(escenario.alumnoA.usuarioId, ['ALUMNO']),
            escenario.materialAId,
            archivoPdf(),
            CONTEXTO,
            prisma,
          ),
        ).rejects.toMatchObject({ code: 'FORBIDDEN' })
      })

      it('rechaza un MIME no permitido (RN-VIR-005)', async () => {
        const archivo = archivoPdf()

        await expect(
          subirAdjunto(
            actor(escenario.docenteA.usuarioId, ['DOCENTE']),
            escenario.materialAId,
            { ...archivo, mimetype: 'text/plain' },
            CONTEXTO,
            prisma,
          ),
        ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
      })

      it('rechaza un archivo mayor al máximo (RN-VIR-005)', async () => {
        const archivo = archivoPdf()

        await expect(
          subirAdjunto(
            actor(escenario.docenteA.usuarioId, ['DOCENTE']),
            escenario.materialAId,
            { ...archivo, size: 10 * 1024 * 1024 + 1 },
            CONTEXTO,
            prisma,
          ),
        ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
      })

      it('devuelve 404 si el material no existe', async () => {
        await expect(
          subirAdjunto(
            actor(escenario.docenteA.usuarioId, ['DOCENTE']),
            '00000000-0000-4000-8000-0000000000ee',
            archivoPdf(),
            CONTEXTO,
            prisma,
          ),
        ).rejects.toMatchObject({ code: 'NOT_FOUND' })
      })
    })

    describe('listarAdjuntos', () => {
      it('lista los adjuntos para un usuario vinculado', async () => {
        await crearAdjuntoDeMaterialA()

        const adjuntos = await listarAdjuntos(
          actor(escenario.alumnoA.usuarioId, ['ALUMNO']),
          escenario.materialAId,
          1,
          20,
          prisma,
        )

        expect(adjuntos).toHaveLength(1)
        expect(adjuntos[0]?.nombreOriginal).toBe('anexo.pdf')
      })

      it('rechaza al alumno de otra sección', async () => {
        await crearAdjuntoDeMaterialA()

        await expect(
          listarAdjuntos(
            actor(escenario.alumnoB.usuarioId, ['ALUMNO']),
            escenario.materialAId,
            1,
            20,
            prisma,
          ),
        ).rejects.toMatchObject({ code: 'FORBIDDEN' })
      })

      it('rechaza a un usuario sin permiso de lectura', async () => {
        await expect(
          listarAdjuntos(
            actor(escenario.sinRoles.usuarioId, []),
            escenario.materialAId,
            1,
            20,
            prisma,
          ),
        ).rejects.toMatchObject({ code: 'FORBIDDEN' })
      })
    })

    describe('eliminarAdjunto', () => {
      it('elimina el adjunto del docente dueño y audita ELIMINAR', async () => {
        const adjuntoId = await crearAdjuntoDeMaterialA()

        await eliminarAdjunto(
          actor(escenario.docenteA.usuarioId, ['DOCENTE']),
          escenario.materialAId,
          adjuntoId,
          CONTEXTO,
          prisma,
        )

        await expect(
          prisma.adjuntoVirtual.findUnique({ where: { id: adjuntoId } }),
        ).resolves.toBeNull()

        const auditoria = await prisma.auditoria.findFirst({
          where: {
            entidad: 'AdjuntoVirtual',
            entidadId: adjuntoId,
            accion: 'ELIMINAR',
          },
        })

        expect(auditoria).not.toBeNull()
      })

      it('rechaza si el adjunto no pertenece al material indicado', async () => {
        const adjuntoId = await crearAdjuntoDeMaterialA()

        await expect(
          eliminarAdjunto(
            actor(escenario.docenteA.usuarioId, ['DOCENTE']),
            escenario.materialBId,
            adjuntoId,
            CONTEXTO,
            prisma,
          ),
        ).rejects.toMatchObject({ code: 'FORBIDDEN' })
      })

      it('devuelve 404 si el adjunto no existe', async () => {
        await expect(
          eliminarAdjunto(
            actor(escenario.docenteA.usuarioId, ['DOCENTE']),
            escenario.materialAId,
            '00000000-0000-4000-8000-0000000000ff',
            CONTEXTO,
            prisma,
          ),
        ).rejects.toMatchObject({ code: 'NOT_FOUND' })
      })

      it('rechaza a un usuario sin permiso de gestión', async () => {
        const adjuntoId = await crearAdjuntoDeMaterialA()

        await expect(
          eliminarAdjunto(
            actor(escenario.alumnoA.usuarioId, ['ALUMNO']),
            escenario.materialAId,
            adjuntoId,
            CONTEXTO,
            prisma,
          ),
        ).rejects.toMatchObject({ code: 'FORBIDDEN' })
      })
    })

    describe('prepararDescargaAdjunto', () => {
      it('devuelve metadatos y audita ACCEDER', async () => {
        const adjuntoId = await crearAdjuntoDeMaterialA()

        const descarga = await prepararDescargaAdjunto(
          actor(escenario.alumnoA.usuarioId, ['ALUMNO']),
          escenario.materialAId,
          adjuntoId,
          CONTEXTO,
          prisma,
        )

        expect(descarga.nombreOriginal).toBe('anexo.pdf')
        expect(descarga.tipoMime).toBe('application/pdf')

        const auditoria = await prisma.auditoria.findFirst({
          where: {
            entidad: 'AdjuntoVirtual',
            entidadId: adjuntoId,
            accion: 'ACCEDER',
          },
        })

        expect(auditoria).not.toBeNull()
      })

      it('rechaza al alumno de otra sección', async () => {
        const adjuntoId = await crearAdjuntoDeMaterialA()

        await expect(
          prepararDescargaAdjunto(
            actor(escenario.alumnoB.usuarioId, ['ALUMNO']),
            escenario.materialAId,
            adjuntoId,
            CONTEXTO,
            prisma,
          ),
        ).rejects.toMatchObject({ code: 'FORBIDDEN' })
      })

      it('rechaza si el adjunto no pertenece al material indicado', async () => {
        const adjuntoId = await crearAdjuntoDeMaterialA()

        await expect(
          prepararDescargaAdjunto(
            actor(escenario.director.usuarioId, ['DIRECTOR']),
            escenario.materialBId,
            adjuntoId,
            CONTEXTO,
            prisma,
          ),
        ).rejects.toMatchObject({ code: 'FORBIDDEN' })
      })

      it('devuelve 404 si el adjunto no existe', async () => {
        await expect(
          prepararDescargaAdjunto(
            actor(escenario.director.usuarioId, ['DIRECTOR']),
            escenario.materialAId,
            '00000000-0000-4000-8000-000000000011',
            CONTEXTO,
            prisma,
          ),
        ).rejects.toMatchObject({ code: 'NOT_FOUND' })
      })
    })
  },
)
