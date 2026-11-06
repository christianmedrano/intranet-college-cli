import type { PrismaClient } from '../../generated/prisma/client.js'
import { getPrisma } from '../db.js'
import { AppError } from '../errors.js'

/**
 * Guard de vínculo apoderado–alumno (RF-CORE-014).
 *
 * Comprueba que el usuario sea apoderado del alumno, con ambas fichas vigentes y
 * la cuenta activa. Lanza `FORBIDDEN` tanto si el vínculo no existe como si el
 * recurso no existe: así no se revela información sobre alumnos ajenos.
 *
 * No evalúa roles ni permisos: el llamador decide cuándo aplicarlo. Los perfiles
 * administrativos (SuperAdmin/Director) deben omitirlo y usar `requirePermission`.
 *
 * @param usuarioId Usuario autenticado.
 * @param alumnoId Alumno al que se intenta acceder.
 * @param prisma Cliente inyectable para las pruebas.
 * @throws AppError `FORBIDDEN` si no hay vínculo vigente.
 */
export async function assertApoderadoOfAlumno(
  usuarioId: string,
  alumnoId: string,
  prisma: PrismaClient = getPrisma(),
): Promise<void> {
  const vinculo = await prisma.apoderadoAlumno.findFirst({
    where: {
      alumnoId,
      alumno: { deletedAt: null },
      apoderado: {
        deletedAt: null,
        persona: {
          usuario: { id: usuarioId, activo: true, deletedAt: null },
        },
      },
    },
    select: { apoderadoId: true },
  })

  if (!vinculo) {
    throw new AppError('FORBIDDEN')
  }
}

/** Alcance exacto de una asignación docente. */
export interface DocenteAssignmentScope {
  cursoId: string
  seccionId: string
  anioId: string
}

/**
 * Guard de vínculo docente–curso/sección (RF-CORE-011, RN-CORE-011).
 *
 * Exige una `AsignacionDocente` para el curso, la sección y el año indicados.
 * No basta con tener el rol `DOCENTE`: un docente sin asignación no accede.
 *
 * No evalúa roles ni permisos: el llamador decide cuándo aplicarlo. Los perfiles
 * administrativos deben omitirlo y usar `requirePermission`.
 *
 * @param usuarioId Usuario autenticado.
 * @param alcance Curso, sección y año del recurso solicitado.
 * @param prisma Cliente inyectable para las pruebas.
 * @throws AppError `FORBIDDEN` si no existe la asignación vigente.
 */
export async function assertDocenteAssignedTo(
  usuarioId: string,
  alcance: DocenteAssignmentScope,
  prisma: PrismaClient = getPrisma(),
): Promise<void> {
  const asignacion = await prisma.asignacionDocente.findFirst({
    where: {
      cursoId: alcance.cursoId,
      seccionId: alcance.seccionId,
      anioId: alcance.anioId,
      docente: {
        deletedAt: null,
        persona: {
          usuario: { id: usuarioId, activo: true, deletedAt: null },
        },
      },
    },
    select: { id: true },
  })

  if (!asignacion) {
    throw new AppError('FORBIDDEN')
  }
}

/**
 * Guard de alumno propio (RF-CORE-003, RF-CORE-012).
 *
 * Permite el acceso solo cuando la ficha de alumno pertenece a la persona del
 * usuario autenticado y sigue vigente.
 *
 * No evalúa roles ni permisos: el llamador decide cuándo aplicarlo. Apoderados y
 * perfiles administrativos deben usar su propio guard.
 *
 * @param usuarioId Usuario autenticado.
 * @param alumnoId Alumno al que se intenta acceder.
 * @param prisma Cliente inyectable para las pruebas.
 * @throws AppError `FORBIDDEN` si el alumno no es el propio o no está vigente.
 */
export async function assertOwnAlumno(
  usuarioId: string,
  alumnoId: string,
  prisma: PrismaClient = getPrisma(),
): Promise<void> {
  const alumno = await prisma.alumno.findFirst({
    where: {
      id: alumnoId,
      deletedAt: null,
      persona: {
        usuario: { id: usuarioId, activo: true, deletedAt: null },
      },
    },
    select: { id: true },
  })

  if (!alumno) {
    throw new AppError('FORBIDDEN')
  }
}
