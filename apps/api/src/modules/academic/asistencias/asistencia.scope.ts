import type { Prisma } from '../../../generated/prisma/client.js'
import type { PrismaClient } from '../../../generated/prisma/client.js'
import { getPrisma } from '../../../core/db.js'
import { AppError } from '../../../core/errors.js'
import { aFechaUTC } from '../../core/estructura/fechas.js'
import { esAdministrativoAcademico, type ActorAcademico } from '../scope.js'

/** Filtros del listado de asistencias (RF-ACAD-007). */
export interface FiltrosConsultaAsistencias {
  alumnoId?: string
  seccionId?: string
  anioId?: string
  desde?: string
  hasta?: string
}

/** Condición de alcance y bandera de auditoría de acceso. */
export interface AlcanceAsistencias {
  where: Prisma.AsistenciaWhereInput
  datosAcceso: Prisma.InputJsonObject
  auditarAcceso: boolean
}

/** Asignación vigente de un docente sobre una sección y año. */
export interface AsignacionVigente {
  seccionId: string
  anioId: string
}

/** Alcance resuelto a partir de los roles y vínculos del actor. */
export interface AlcanceResuelto {
  actorId: string
  todo: boolean
  docente: AsignacionVigente[] | null
  apoderado: boolean
  alumno: boolean
  auditarAcceso: boolean
}

/** Indica si los filtros de sección/año caen dentro de las asignaciones. */
function filtroPermitido(
  asignaciones: readonly AsignacionVigente[],
  filtros: FiltrosConsultaAsistencias,
): boolean {
  if (filtros.seccionId && filtros.anioId) {
    return asignaciones.some(
      (fila) =>
        fila.seccionId === filtros.seccionId && fila.anioId === filtros.anioId,
    )
  }

  if (filtros.seccionId) {
    return asignaciones.some((fila) => fila.seccionId === filtros.seccionId)
  }

  if (filtros.anioId) {
    return asignaciones.some((fila) => fila.anioId === filtros.anioId)
  }

  return true
}

/**
 * Exige que el alumno filtrado esté dentro del alcance del actor.
 *
 * Un filtro por un alumno ajeno devuelve `403` para no revelar si existe ni
 * cuánta asistencia tiene. Los perfiles administrativos se omiten.
 *
 * @throws AppError `FORBIDDEN` si el alumno no está en el alcance.
 */
async function assertAlumnoEnAlcance(
  alcance: AlcanceResuelto,
  alumnoId: string,
  prisma: PrismaClient,
): Promise<void> {
  if (alcance.todo) {
    return
  }

  const condiciones: Prisma.AlumnoWhereInput[] = []

  if (alcance.docente !== null) {
    if (alcance.docente.length > 0) {
      condiciones.push({
        matriculas: {
          some: {
            estado: 'APROBADA',
            deletedAt: null,
            OR: alcance.docente.map((fila) => ({
              seccionId: fila.seccionId,
              anioId: fila.anioId,
            })),
          },
        },
      })
    }
  }

  if (alcance.apoderado) {
    condiciones.push({
      apoderados: {
        some: {
          apoderado: {
            deletedAt: null,
            persona: {
              usuario: {
                id: alcance.actorId,
                activo: true,
                deletedAt: null,
              },
            },
          },
        },
      },
    })
  }

  if (alcance.alumno) {
    condiciones.push({
      persona: {
        usuario: { id: alcance.actorId, activo: true, deletedAt: null },
      },
    })
  }

  if (condiciones.length === 0) {
    throw new AppError('FORBIDDEN')
  }

  const fila = await prisma.alumno.findFirst({
    where: { id: alumnoId, deletedAt: null, OR: condiciones },
    select: { id: true },
  })

  if (!fila) {
    throw new AppError('FORBIDDEN')
  }
}

/**
 * Resuelve el tipo de alcance del actor y, si es docente, sus asignaciones
 * vigentes en cualquier año (RN-ACAD-007).
 *
 * @throws AppError `FORBIDDEN` sin rol con alcance o si un filtro queda fuera.
 */
export async function resolverAlcanceAsistencias(
  actor: ActorAcademico,
  filtros: FiltrosConsultaAsistencias,
  prisma: PrismaClient,
): Promise<AlcanceResuelto> {
  const todo = esAdministrativoAcademico(actor)
  const esDocente = actor.roles.includes('DOCENTE')
  const esApoderado = actor.roles.includes('APODERADO')
  const esAlumno = actor.roles.includes('ALUMNO')

  if (!todo && !esDocente && !esApoderado && !esAlumno) {
    throw new AppError('FORBIDDEN')
  }

  let docente: AsignacionVigente[] | null = null

  if (!todo && esDocente) {
    docente = await prisma.asignacionDocente.findMany({
      where: {
        docente: {
          deletedAt: null,
          persona: {
            usuario: { id: actor.id, activo: true, deletedAt: null },
          },
        },
      },
      select: { seccionId: true, anioId: true },
    })

    if (!filtroPermitido(docente, filtros)) {
      throw new AppError('FORBIDDEN')
    }
  }

  const alcance: AlcanceResuelto = {
    actorId: actor.id,
    todo,
    docente,
    apoderado: !todo && esApoderado,
    alumno: !todo && esAlumno,
    auditarAcceso: actor.roles.includes('SUPER_ADMIN'),
  }

  if (filtros.alumnoId) {
    await assertAlumnoEnAlcance(alcance, filtros.alumnoId, prisma)
  }

  return alcance
}

/** Construye la condición de asistencias para el alcance resuelto. */
function whereAsistencias(
  alcance: AlcanceResuelto,
  filtros: FiltrosConsultaAsistencias,
): Prisma.AsistenciaWhereInput {
  const alcances: Prisma.AsistenciaWhereInput[] = []

  if (alcance.docente !== null) {
    alcances.push(
      alcance.docente.length === 0
        ? { id: { in: [] } }
        : {
            OR: alcance.docente.map((asignacion) => ({
              alumno: {
                deletedAt: null,
                matriculas: {
                  some: {
                    seccionId: asignacion.seccionId,
                    anioId: asignacion.anioId,
                    estado: 'APROBADA',
                    deletedAt: null,
                  },
                },
              },
            })),
          },
    )
  }

  if (alcance.apoderado) {
    alcances.push({
      alumno: {
        deletedAt: null,
        apoderados: {
          some: {
            apoderado: {
              deletedAt: null,
              persona: {
                usuario: {
                  id: alcance.actorId,
                  activo: true,
                  deletedAt: null,
                },
              },
            },
          },
        },
      },
    })
  }

  if (alcance.alumno) {
    alcances.push({
      alumno: {
        deletedAt: null,
        persona: {
          usuario: {
            id: alcance.actorId,
            activo: true,
            deletedAt: null,
          },
        },
      },
    })
  }

  const where: Prisma.AsistenciaWhereInput = {
    deletedAt: null,
    alumno: { deletedAt: null },
  }
  const and: Prisma.AsistenciaWhereInput[] = []
  const [unico, ...resto] = alcances

  if (unico !== undefined) {
    and.push(resto.length === 0 ? unico : { OR: alcances })
  }

  if (filtros.seccionId || filtros.anioId) {
    and.push({
      alumno: {
        matriculas: {
          some: {
            ...(filtros.seccionId ? { seccionId: filtros.seccionId } : {}),
            ...(filtros.anioId ? { anioId: filtros.anioId } : {}),
            estado: 'APROBADA',
            deletedAt: null,
          },
        },
      },
    })
  }

  if (filtros.alumnoId) {
    where.alumnoId = filtros.alumnoId
  }

  if (filtros.desde || filtros.hasta) {
    where.fecha = {
      ...(filtros.desde ? { gte: aFechaUTC(filtros.desde) } : {}),
      ...(filtros.hasta ? { lte: aFechaUTC(filtros.hasta) } : {}),
    }
  }

  if (and.length > 0) {
    where.AND = and
  }

  return where
}

/**
 * Construye la condición de consulta de asistencias según el vínculo del actor
 * (RF-ACAD-007).
 *
 * - Director y SuperAdmin: todas; el segundo con acceso auditado.
 * - Docente: solo las secciones y años en que tiene asignación.
 * - Apoderado: solo sus alumnos vinculados.
 * - Alumno: solo lo propio.
 *
 * Los roles múltiples se unen con `OR`.
 *
 * @throws AppError `FORBIDDEN` si no hay rol con alcance o un filtro es ajeno.
 */
export async function construirAlcanceAsistencias(
  actor: ActorAcademico,
  filtros: FiltrosConsultaAsistencias,
  prisma: PrismaClient = getPrisma(),
): Promise<AlcanceAsistencias> {
  const alcance = await resolverAlcanceAsistencias(actor, filtros, prisma)

  const datosAcceso: Prisma.InputJsonObject = {
    ...(filtros.alumnoId ? { alumnoId: filtros.alumnoId } : {}),
    ...(filtros.seccionId ? { seccionId: filtros.seccionId } : {}),
    ...(filtros.anioId ? { anioId: filtros.anioId } : {}),
    ...(filtros.desde ? { desde: filtros.desde } : {}),
    ...(filtros.hasta ? { hasta: filtros.hasta } : {}),
  }

  return {
    where: whereAsistencias(alcance, filtros),
    datosAcceso,
    auditarAcceso: alcance.auditarAcceso,
  }
}
