import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import {
  assertDocenteDeCursoSeccion,
  assertPermiso,
  assertVinculoMaterial,
  construirAlcanceMateriales,
  esAdministrativo,
  resolverDocenteDelActor,
  type ActorVirtual,
} from '../../src/modules/virtual-classroom/materiales/material.scope.js'
import { createTestPrisma, limpiarBaseDePruebas } from '../helpers/test-db.js'
import {
  INSTITUCION_ID,
  crearEscenarioVirtual,
  type EscenarioVirtual,
} from './escenario.js'

function actor(
  usuarioId: string,
  roles: ActorVirtual['roles'],
): ActorVirtual {
  return { id: usuarioId, roles, institucionId: INSTITUCION_ID }
}

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'material.scope — alcance por vínculo del aula virtual',
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

    describe('assertPermiso', () => {
      it('permite gestionar al Director y lo niega al Alumno', () => {
        expect(() =>
          assertPermiso(actor(escenario.director.usuarioId, ['DIRECTOR']), 'virtual.gestionar'),
        ).not.toThrow()

        expect(() =>
          assertPermiso(actor(escenario.alumnoA.usuarioId, ['ALUMNO']), 'virtual.gestionar'),
        ).toThrowError(expect.objectContaining({ code: 'FORBIDDEN' }))
      })

      it('permite leer al Alumno y al Apoderado', () => {
        expect(() =>
          assertPermiso(actor(escenario.alumnoA.usuarioId, ['ALUMNO']), 'virtual.leer'),
        ).not.toThrow()

        expect(() =>
          assertPermiso(actor(escenario.apoderadoA.usuarioId, ['APODERADO']), 'virtual.leer'),
        ).not.toThrow()
      })
    })

    describe('esAdministrativo', () => {
      it('reconoce Director y SuperAdmin', () => {
        expect(esAdministrativo(actor(escenario.director.usuarioId, ['DIRECTOR']))).toBe(true)
        expect(esAdministrativo(actor(escenario.superAdmin.usuarioId, ['SUPER_ADMIN']))).toBe(true)
        expect(esAdministrativo(actor(escenario.docenteA.usuarioId, ['DOCENTE']))).toBe(false)
      })
    })

    describe('resolverDocenteDelActor', () => {
      it('devuelve la ficha Docente del usuario docente', async () => {
        await expect(
          resolverDocenteDelActor(
            actor(escenario.docenteA.usuarioId, ['DOCENTE']),
            prisma,
          ),
        ).resolves.toBe(escenario.docenteAId)
      })

      it('devuelve null para un usuario sin ficha de docente', async () => {
        await expect(
          resolverDocenteDelActor(
            actor(escenario.director.usuarioId, ['DIRECTOR']),
            prisma,
          ),
        ).resolves.toBeNull()
      })
    })

    describe('assertDocenteDeCursoSeccion', () => {
      it('acepta la sección asignada', async () => {
        await expect(
          assertDocenteDeCursoSeccion(
            actor(escenario.docenteA.usuarioId, ['DOCENTE']),
            escenario.cursoId,
            escenario.seccionAId,
            escenario.anioId,
            prisma,
          ),
        ).resolves.toBeUndefined()
      })

      it('rechaza una sección no asignada', async () => {
        await expect(
          assertDocenteDeCursoSeccion(
            actor(escenario.docenteA.usuarioId, ['DOCENTE']),
            escenario.cursoId,
            escenario.seccionBId,
            escenario.anioId,
            prisma,
          ),
        ).rejects.toMatchObject({ code: 'FORBIDDEN' })
      })
    })

    describe('construirAlcanceMateriales', () => {
      async function idsVisibles(
        actorVirtual: ActorVirtual,
        filtros: Parameters<typeof construirAlcanceMateriales>[2] = {},
      ): Promise<string[]> {
        const { where } = await construirAlcanceMateriales(
          actorVirtual,
          escenario.anioId,
          filtros,
          prisma,
        )

        const filas = await prisma.materialVirtual.findMany({
          where,
          select: { id: true },
          orderBy: { titulo: 'asc' },
        })

        return filas.map((fila) => fila.id)
      }

      it('el Director ve todos los materiales vigentes del año', async () => {
        const ids = await idsVisibles(actor(escenario.director.usuarioId, ['DIRECTOR']))

        expect(ids).toEqual([escenario.materialAId, escenario.materialBId])
        expect(ids).not.toContain(escenario.materialEliminadoId)
      })

      it('audita el acceso del SuperAdmin y no el del Director', async () => {
        const superAdmin = await construirAlcanceMateriales(
          actor(escenario.superAdmin.usuarioId, ['SUPER_ADMIN']),
          escenario.anioId,
          {},
          prisma,
        )
        const director = await construirAlcanceMateriales(
          actor(escenario.director.usuarioId, ['DIRECTOR']),
          escenario.anioId,
          {},
          prisma,
        )

        expect(superAdmin.auditarAcceso).toBe(true)
        expect(director.auditarAcceso).toBe(false)
      })

      it('el Docente solo ve los materiales de sus cursos y secciones', async () => {
        const ids = await idsVisibles(actor(escenario.docenteA.usuarioId, ['DOCENTE']))

        expect(ids).toEqual([escenario.materialAId])
      })

      it('el Docente sin asignaciones obtiene una lista vacía', async () => {
        const ids = await idsVisibles(
          actor(escenario.docenteSinAsignacion.usuarioId, ['DOCENTE']),
        )

        expect(ids).toEqual([])
      })

      it('el Docente recibe 403 si filtra una sección ajena', async () => {
        await expect(
          construirAlcanceMateriales(
            actor(escenario.docenteA.usuarioId, ['DOCENTE']),
            escenario.anioId,
            { seccionId: escenario.seccionBId },
            prisma,
          ),
        ).rejects.toMatchObject({ code: 'FORBIDDEN' })
      })

      it('el Alumno ve solo los materiales de su sección', async () => {
        const ids = await idsVisibles(actor(escenario.alumnoA.usuarioId, ['ALUMNO']))

        expect(ids).toEqual([escenario.materialAId])
      })

      it('el Apoderado ve solo los materiales de la sección de sus alumnos', async () => {
        const ids = await idsVisibles(actor(escenario.apoderadoA.usuarioId, ['APODERADO']))

        expect(ids).toEqual([escenario.materialAId])
      })

      it('un usuario sin roles recibe 403', async () => {
        await expect(
          construirAlcanceMateriales(
            actor(escenario.sinRoles.usuarioId, []),
            escenario.anioId,
            {},
            prisma,
          ),
        ).rejects.toMatchObject({ code: 'FORBIDDEN' })
      })

      it('aplica los filtros de período y docente', async () => {
        const porPeriodo = await idsVisibles(
          actor(escenario.director.usuarioId, ['DIRECTOR']),
          { periodoId: escenario.periodoId },
        )
        const porDocente = await idsVisibles(
          actor(escenario.director.usuarioId, ['DIRECTOR']),
          { docenteId: escenario.docenteBId },
        )

        expect(porPeriodo).toHaveLength(2)
        expect(porDocente).toEqual([escenario.materialBId])
      })

      it('une los alcances cuando el usuario tiene varios roles', async () => {
        // El docente B también es apoderado del alumno A: debe ver A y B.
        const actorMixto: ActorVirtual = {
          id: escenario.docenteB.usuarioId,
          roles: ['DOCENTE', 'APODERADO'],
          institucionId: INSTITUCION_ID,
        }

        const apoderado = await prisma.apoderado.create({
          data: { personaId: escenario.docenteB.personaId },
        })

        await prisma.apoderadoAlumno.create({
          data: {
            apoderadoId: apoderado.id,
            alumnoId: escenario.alumnoAId,
            parentesco: 'Padre',
            esPrincipal: false,
          },
        })

        const ids = await idsVisibles(actorMixto)

        expect(ids).toEqual([escenario.materialAId, escenario.materialBId])
      })
    })

    describe('assertVinculoMaterial', () => {
      it('el Director accede a cualquier material', async () => {
        await expect(
          assertVinculoMaterial(
            actor(escenario.director.usuarioId, ['DIRECTOR']),
            escenario.materialBId,
            escenario.anioId,
            prisma,
          ),
        ).resolves.toBeUndefined()
      })

      it('el Docente accede a su sección y no a la ajena', async () => {
        const docente = actor(escenario.docenteA.usuarioId, ['DOCENTE'])

        await expect(
          assertVinculoMaterial(docente, escenario.materialAId, escenario.anioId, prisma),
        ).resolves.toBeUndefined()

        await expect(
          assertVinculoMaterial(docente, escenario.materialBId, escenario.anioId, prisma),
        ).rejects.toMatchObject({ code: 'FORBIDDEN' })
      })

      it('rechaza un año distinto al del período del material', async () => {
        await expect(
          assertVinculoMaterial(
            actor(escenario.docenteA.usuarioId, ['DOCENTE']),
            escenario.materialAId,
            '00000000-0000-4000-8000-000000000099',
            prisma,
          ),
        ).rejects.toMatchObject({ code: 'FORBIDDEN' })
      })

      it('sin año explícito usa el del período del material', async () => {
        await expect(
          assertVinculoMaterial(
            actor(escenario.alumnoA.usuarioId, ['ALUMNO']),
            escenario.materialAId,
            undefined,
            prisma,
          ),
        ).resolves.toBeUndefined()
      })

      it('el Alumno accede solo a su sección', async () => {
        const alumno = actor(escenario.alumnoA.usuarioId, ['ALUMNO'])

        await expect(
          assertVinculoMaterial(alumno, escenario.materialAId, undefined, prisma),
        ).resolves.toBeUndefined()

        await expect(
          assertVinculoMaterial(alumno, escenario.materialBId, undefined, prisma),
        ).rejects.toMatchObject({ code: 'FORBIDDEN' })
      })

      it('el Apoderado accede solo a la sección de sus alumnos', async () => {
        const apoderado = actor(escenario.apoderadoA.usuarioId, ['APODERADO'])

        await expect(
          assertVinculoMaterial(apoderado, escenario.materialAId, undefined, prisma),
        ).resolves.toBeUndefined()

        await expect(
          assertVinculoMaterial(apoderado, escenario.materialBId, undefined, prisma),
        ).rejects.toMatchObject({ code: 'FORBIDDEN' })
      })

      it('devuelve 404 si el material no existe', async () => {
        await expect(
          assertVinculoMaterial(
            actor(escenario.docenteA.usuarioId, ['DOCENTE']),
            '00000000-0000-4000-8000-0000000000aa',
            undefined,
            prisma,
          ),
        ).rejects.toMatchObject({ code: 'NOT_FOUND' })
      })

      it('un usuario sin roles recibe 403', async () => {
        await expect(
          assertVinculoMaterial(
            actor(escenario.sinRoles.usuarioId, []),
            escenario.materialAId,
            undefined,
            prisma,
          ),
        ).rejects.toMatchObject({ code: 'FORBIDDEN' })
      })
    })
  },
)
