import type {
  ActualizarMaterialInput,
  CrearMaterialInput,
} from '@intranet/shared'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import {
  actualizarMaterial,
  crearMaterial,
  eliminarMaterial,
  listarMateriales,
  obtenerMaterial,
  prepararDescargaMaterial,
} from '../../src/modules/virtual-classroom/materiales/material.service.js'
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

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'material.service — reglas de negocio del aula virtual',
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

    /**
     * Construye la entrada de creación.
     *
     * El parámetro se tipa como `unknown` a propósito: algunas pruebas envían
     * valores inválidos (MIME, tamaño) y el servicio debe rechazarlos en runtime.
     */
    function entradaNueva(
      cambios: Record<string, unknown> = {},
    ): CrearMaterialInput {
      return {
        cursoId: escenario.cursoId,
        seccionId: escenario.seccionAId,
        periodoId: escenario.periodoId,
        titulo: `Material ${crypto.randomUUID().slice(0, 8)}`,
        descripcion: 'Descripción de prueba',
        archivoNombre: 'guia.pdf',
        archivoMime: 'application/pdf',
        tamanoBytes: 4096,
        ...cambios,
      } as CrearMaterialInput
    }

    /**
     * Construye una actualización. Igual que {@link entradaNueva}, acepta
     * valores inválidos a propósito para probar la validación del servicio.
     */
    function actualizacion(
      cambios: Record<string, unknown>,
    ): ActualizarMaterialInput {
      return cambios as ActualizarMaterialInput
    }

    describe('crearMaterial', () => {
      it('crea el material del docente con su ficha Docente y audita CREAR', async () => {
        const material = await crearMaterial(
          actor(escenario.docenteA.usuarioId, ['DOCENTE']),
          entradaNueva({ titulo: 'Guía de fracciones' }),
          CONTEXTO,
          prisma,
        )

        expect(material.titulo).toBe('Guía de fracciones')
        expect(material.docenteId).toBe(escenario.docenteAId)
        expect(material.adjuntos).toEqual([])

        const auditoria = await prisma.auditoria.findFirst({
          where: {
            entidad: 'MaterialVirtual',
            entidadId: material.id,
            accion: 'CREAR',
          },
        })

        expect(auditoria).not.toBeNull()
        expect(auditoria?.usuarioId).toBe(escenario.docenteA.usuarioId)
      })

      it('rechaza al docente sin asignación en el curso/sección (RN-VIR-001)', async () => {
        await expect(
          crearMaterial(
            actor(escenario.docenteSinAsignacion.usuarioId, ['DOCENTE']),
            entradaNueva(),
            CONTEXTO,
            prisma,
          ),
        ).rejects.toMatchObject({ code: 'FORBIDDEN' })
      })

      it('rechaza que un docente cree material para otro docente', async () => {
        await expect(
          crearMaterial(
            actor(escenario.docenteA.usuarioId, ['DOCENTE']),
            entradaNueva({ docenteId: escenario.docenteBId }),
            CONTEXTO,
            prisma,
          ),
        ).rejects.toMatchObject({ code: 'FORBIDDEN' })
      })

      it('rechaza un MIME no permitido (RN-VIR-005)', async () => {
        await expect(
          crearMaterial(
            actor(escenario.docenteA.usuarioId, ['DOCENTE']),
            entradaNueva({ archivoMime: 'text/plain' }),
            CONTEXTO,
            prisma,
          ),
        ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
      })

      it('rechaza un archivo mayor al máximo (RN-VIR-005)', async () => {
        await expect(
          crearMaterial(
            actor(escenario.docenteA.usuarioId, ['DOCENTE']),
            entradaNueva({ tamanoBytes: 10 * 1024 * 1024 + 1 }),
            CONTEXTO,
            prisma,
          ),
        ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
      })

      it('rechaza un período inexistente', async () => {
        await expect(
          crearMaterial(
            actor(escenario.docenteA.usuarioId, ['DOCENTE']),
            entradaNueva({ periodoId: '00000000-0000-4000-8000-0000000000bb' }),
            CONTEXTO,
            prisma,
          ),
        ).rejects.toMatchObject({ code: 'NOT_FOUND' })
      })

      it('rechaza un duplicado del mismo docente, curso, sección, período y título (RN-VIR-002)', async () => {
        const input = entradaNueva({ titulo: 'Material duplicado' })

        await crearMaterial(
          actor(escenario.docenteA.usuarioId, ['DOCENTE']),
          input,
          CONTEXTO,
          prisma,
        )

        await expect(
          crearMaterial(
            actor(escenario.docenteA.usuarioId, ['DOCENTE']),
            input,
            CONTEXTO,
            prisma,
          ),
        ).rejects.toMatchObject({ code: 'CONFLICT' })
      })

      it('permite al Director publicar a nombre de un docente', async () => {
        const material = await crearMaterial(
          actor(escenario.director.usuarioId, ['DIRECTOR']),
          entradaNueva({
            seccionId: escenario.seccionBId,
            docenteId: escenario.docenteBId,
          }),
          CONTEXTO,
          prisma,
        )

        expect(material.docenteId).toBe(escenario.docenteBId)
      })

      it('exige docenteId al Director que no tiene ficha de docente', async () => {
        await expect(
          crearMaterial(
            actor(escenario.director.usuarioId, ['DIRECTOR']),
            entradaNueva(),
            CONTEXTO,
            prisma,
          ),
        ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
      })

      it('rechaza a un usuario sin permiso de gestión', async () => {
        await expect(
          crearMaterial(
            actor(escenario.alumnoA.usuarioId, ['ALUMNO']),
            entradaNueva(),
            CONTEXTO,
            prisma,
          ),
        ).rejects.toMatchObject({ code: 'FORBIDDEN' })
      })
    })

    describe('actualizarMaterial', () => {
      it('actualiza al docente dueño y audita con anterior/nuevo', async () => {
        const actualizado = await actualizarMaterial(
          actor(escenario.docenteA.usuarioId, ['DOCENTE']),
          escenario.materialAId,
          { titulo: 'Título corregido' },
          CONTEXTO,
          prisma,
        )

        expect(actualizado.titulo).toBe('Título corregido')

        const auditoria = await prisma.auditoria.findFirst({
          where: {
            entidad: 'MaterialVirtual',
            entidadId: escenario.materialAId,
            accion: 'ACTUALIZAR',
          },
        })

        expect(auditoria?.datos).toMatchObject({
          anterior: { titulo: 'Material de la sección A' },
          nuevo: { titulo: 'Título corregido' },
        })
      })

      it('rechaza al docente que no es dueño', async () => {
        await expect(
          actualizarMaterial(
            actor(escenario.docenteB.usuarioId, ['DOCENTE']),
            escenario.materialAId,
            { titulo: 'Intento ajeno' },
            CONTEXTO,
            prisma,
          ),
        ).rejects.toMatchObject({ code: 'FORBIDDEN' })
      })

      it('permite al Director editar cualquier material', async () => {
        const actualizado = await actualizarMaterial(
          actor(escenario.director.usuarioId, ['DIRECTOR']),
          escenario.materialBId,
          { descripcion: 'Revisado por dirección' },
          CONTEXTO,
          prisma,
        )

        expect(actualizado.descripcion).toBe('Revisado por dirección')
      })

      it('rechaza un título duplicado del mismo docente', async () => {
        await prisma.materialVirtual.create({
          data: {
            cursoId: escenario.cursoId,
            seccionId: escenario.seccionAId,
            periodoId: escenario.periodoId,
            anioId: escenario.anioId,
            docenteId: escenario.docenteAId,
            titulo: 'Otra guía',
            descripcion: null,
            archivoNombre: 'otra.pdf',
            archivoMime: 'application/pdf',
            tamanoBytes: 1024,
            archivoRuta: 'uploads/virtual/otra.pdf',
          },
        })

        await expect(
          actualizarMaterial(
            actor(escenario.docenteA.usuarioId, ['DOCENTE']),
            escenario.materialAId,
            { titulo: 'Otra guía' },
            CONTEXTO,
            prisma,
          ),
        ).rejects.toMatchObject({ code: 'CONFLICT' })
      })

      it('rechaza un MIME no permitido al reemplazar el archivo', async () => {
        await expect(
          actualizarMaterial(
            actor(escenario.docenteA.usuarioId, ['DOCENTE']),
            escenario.materialAId,
            actualizacion({
              archivoNombre: 'script.exe',
              archivoMime: 'application/x-msdownload',
              tamanoBytes: 1024,
            }),
            CONTEXTO,
            prisma,
          ),
        ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
      })

      it('devuelve 404 si el material no existe', async () => {
        await expect(
          actualizarMaterial(
            actor(escenario.director.usuarioId, ['DIRECTOR']),
            '00000000-0000-4000-8000-0000000000cc',
            { titulo: 'Fantasma' },
            CONTEXTO,
            prisma,
          ),
        ).rejects.toMatchObject({ code: 'NOT_FOUND' })
      })

      it('el Director mueve el material a otro período y arrastra el año del destino', async () => {
        const otroPeriodo = await prisma.periodoAcademico.create({
          data: {
            anioId: escenario.anioId,
            nombre: 'Bimestre 2',
            orden: 2,
            fechaInicio: new Date('2026-06-01'),
            fechaFin: new Date('2026-08-31'),
            estado: 'PLANIFICADO',
          },
        })

        const actualizado = await actualizarMaterial(
          actor(escenario.director.usuarioId, ['DIRECTOR']),
          escenario.materialAId,
          { periodoId: otroPeriodo.id },
          CONTEXTO,
          prisma,
        )

        expect(actualizado.periodoId).toBe(otroPeriodo.id)

        const fila = await prisma.materialVirtual.findUnique({
          where: { id: escenario.materialAId },
          select: { periodoId: true, anioId: true },
        })

        expect(fila).toEqual({
          periodoId: otroPeriodo.id,
          anioId: escenario.anioId,
        })
      })

      it('rechaza un período destino inexistente', async () => {
        await expect(
          actualizarMaterial(
            actor(escenario.director.usuarioId, ['DIRECTOR']),
            escenario.materialAId,
            { periodoId: '00000000-0000-4000-8000-0000000000bd' },
            CONTEXTO,
            prisma,
          ),
        ).rejects.toMatchObject({ code: 'NOT_FOUND' })
      })

      it('rechaza que el docente dueño mueva el material a una sección no asignada', async () => {
        await expect(
          actualizarMaterial(
            actor(escenario.docenteA.usuarioId, ['DOCENTE']),
            escenario.materialAId,
            { seccionId: escenario.seccionBId },
            CONTEXTO,
            prisma,
          ),
        ).rejects.toMatchObject({ code: 'FORBIDDEN' })
      })

      it('rechaza que el docente dueño reasigne el material a otro docente', async () => {
        await expect(
          actualizarMaterial(
            actor(escenario.docenteA.usuarioId, ['DOCENTE']),
            escenario.materialAId,
            { docenteId: escenario.docenteBId },
            CONTEXTO,
            prisma,
          ),
        ).rejects.toMatchObject({ code: 'FORBIDDEN' })
      })
    })

    describe('eliminarMaterial', () => {
      it('aplica baja lógica y audita ELIMINAR', async () => {
        await eliminarMaterial(
          actor(escenario.docenteA.usuarioId, ['DOCENTE']),
          escenario.materialAId,
          CONTEXTO,
          prisma,
        )

        const fila = await prisma.materialVirtual.findUnique({
          where: { id: escenario.materialAId },
          select: { deletedAt: true },
        })

        expect(fila?.deletedAt).not.toBeNull()

        const auditoria = await prisma.auditoria.findFirst({
          where: {
            entidad: 'MaterialVirtual',
            entidadId: escenario.materialAId,
            accion: 'ELIMINAR',
          },
        })

        expect(auditoria).not.toBeNull()
      })

      it('rechaza al docente que no es dueño', async () => {
        await expect(
          eliminarMaterial(
            actor(escenario.docenteB.usuarioId, ['DOCENTE']),
            escenario.materialAId,
            CONTEXTO,
            prisma,
          ),
        ).rejects.toMatchObject({ code: 'FORBIDDEN' })
      })

      it('permite al Director eliminar cualquier material', async () => {
        await expect(
          eliminarMaterial(
            actor(escenario.director.usuarioId, ['DIRECTOR']),
            escenario.materialBId,
            CONTEXTO,
            prisma,
          ),
        ).resolves.toBeUndefined()
      })

      it('rechaza al Alumno', async () => {
        await expect(
          eliminarMaterial(
            actor(escenario.alumnoA.usuarioId, ['ALUMNO']),
            escenario.materialAId,
            CONTEXTO,
            prisma,
          ),
        ).rejects.toMatchObject({ code: 'FORBIDDEN' })
      })

      it('devuelve 404 si el material no existe', async () => {
        await expect(
          eliminarMaterial(
            actor(escenario.director.usuarioId, ['DIRECTOR']),
            '00000000-0000-4000-8000-0000000000dd',
            CONTEXTO,
            prisma,
          ),
        ).rejects.toMatchObject({ code: 'NOT_FOUND' })
      })
    })

    describe('listarMateriales', () => {
      it('devuelve la página con metadatos para el Director', async () => {
        const pagina = await listarMateriales(
          actor(escenario.director.usuarioId, ['DIRECTOR']),
          escenario.anioId,
          { page: 1, pageSize: 10 },
          prisma,
        )

        expect(pagina.meta).toEqual({ page: 1, pageSize: 10, total: 2 })
        expect(pagina.data.map((fila) => fila.id).sort()).toEqual(
          [escenario.materialAId, escenario.materialBId].sort(),
        )
      })

      it('limita al Docente a sus secciones', async () => {
        const pagina = await listarMateriales(
          actor(escenario.docenteA.usuarioId, ['DOCENTE']),
          escenario.anioId,
          {},
          prisma,
        )

        expect(pagina.data.map((fila) => fila.id)).toEqual([escenario.materialAId])
      })

      it('aplica el filtro de período', async () => {
        const pagina = await listarMateriales(
          actor(escenario.alumnoA.usuarioId, ['ALUMNO']),
          escenario.anioId,
          { periodoId: escenario.periodoId },
          prisma,
        )

        expect(pagina.meta.total).toBe(1)
      })

      it('pagina los resultados', async () => {
        const pagina = await listarMateriales(
          actor(escenario.director.usuarioId, ['DIRECTOR']),
          escenario.anioId,
          { page: 2, pageSize: 1 },
          prisma,
        )

        expect(pagina.data).toHaveLength(1)
        expect(pagina.meta).toEqual({ page: 2, pageSize: 1, total: 2 })
      })

      it('audita el acceso del SuperAdmin', async () => {
        await listarMateriales(
          actor(escenario.superAdmin.usuarioId, ['SUPER_ADMIN']),
          escenario.anioId,
          {},
          prisma,
        )

        const auditoria = await prisma.auditoria.findFirst({
          where: {
            usuarioId: escenario.superAdmin.usuarioId,
            entidad: 'MaterialVirtual',
            accion: 'ACCEDER',
          },
        })

        expect(auditoria).not.toBeNull()
      })

      it('rechaza al usuario sin permiso de lectura', async () => {
        await expect(
          listarMateriales(
            actor(escenario.sinRoles.usuarioId, []),
            escenario.anioId,
            {},
            prisma,
          ),
        ).rejects.toMatchObject({ code: 'FORBIDDEN' })
      })
    })

    describe('obtenerMaterial', () => {
      it('devuelve el material con sus adjuntos', async () => {
        await prisma.adjuntoVirtual.create({
          data: {
            materialId: escenario.materialAId,
            nombreOriginal: 'anexo.pdf',
            nombreAlmacenado: 'uploads/virtual/adjuntos/anexo.pdf',
            tipoMime: 'application/pdf',
            tamanoBytes: 512,
          },
        })

        const material = await obtenerMaterial(
          actor(escenario.docenteA.usuarioId, ['DOCENTE']),
          escenario.materialAId,
          escenario.anioId,
          prisma,
        )

        expect(material.id).toBe(escenario.materialAId)
        expect(material.adjuntos).toHaveLength(1)
        expect(material.adjuntos[0]?.nombreOriginal).toBe('anexo.pdf')
      })

      it('rechaza al docente de otra sección', async () => {
        await expect(
          obtenerMaterial(
            actor(escenario.docenteB.usuarioId, ['DOCENTE']),
            escenario.materialAId,
            escenario.anioId,
            prisma,
          ),
        ).rejects.toMatchObject({ code: 'FORBIDDEN' })
      })

      it('devuelve 404 si el material está eliminado', async () => {
        await expect(
          obtenerMaterial(
            actor(escenario.director.usuarioId, ['DIRECTOR']),
            escenario.materialEliminadoId,
            escenario.anioId,
            prisma,
          ),
        ).rejects.toMatchObject({ code: 'NOT_FOUND' })
      })
    })

    describe('prepararDescargaMaterial', () => {
      it('devuelve metadatos y audita ACCEDER', async () => {
        const descarga = await prepararDescargaMaterial(
          actor(escenario.alumnoA.usuarioId, ['ALUMNO']),
          escenario.materialAId,
          escenario.anioId,
          CONTEXTO,
          prisma,
        )

        expect(descarga.archivoNombre).toBe('material.pdf')
        expect(descarga.archivoMime).toBe('application/pdf')
        expect(descarga.tamanoBytes).toBe(2048)

        const auditoria = await prisma.auditoria.findFirst({
          where: {
            usuarioId: escenario.alumnoA.usuarioId,
            entidad: 'MaterialVirtual',
            entidadId: escenario.materialAId,
            accion: 'ACCEDER',
          },
        })

        expect(auditoria).not.toBeNull()
      })

      it('rechaza al alumno de otra sección', async () => {
        await expect(
          prepararDescargaMaterial(
            actor(escenario.alumnoB.usuarioId, ['ALUMNO']),
            escenario.materialAId,
            escenario.anioId,
            CONTEXTO,
            prisma,
          ),
        ).rejects.toMatchObject({ code: 'FORBIDDEN' })
      })
    })
  },
)
