import type { Prisma, PrismaClient } from '../../../generated/prisma/client.js'
import { getPrisma } from '../../../core/db.js'
import { AppError } from '../../../core/errors.js'
import { esAdministrativoAcademico, type ActorAcademico } from '../scope.js'

/** Filtros del listado de horarios (RF-ACAD-011). */
export interface FiltrosConsultaHorarios {
  anioId: string
  seccionId?: string
  docenteId?: string
}

/** Condición de alcance y bandera de auditoría de acceso. */
export interface AlcanceHorarios {
  where: Prisma.HorarioWhereInput
  datosAcceso: Prisma.InputJsonObject
  auditarAcceso: boolean
}

/** Asignación vigente de un docente dentro del año consultado. */
interface AsignacionVigente {
  cursoId: string
  seccionId: string
}

/** Alcance resuelto a partir de los roles y vínculos del actor. */
interface AlcanceResuelto {
  actorId: string
  todo: boolean
  docente: AsignacionVigente[] | null
  apoderado: boolean
  alumno: boolean
  auditarAcceso: boolean
}

/** Condición del docente: sus cursos y secciones asignados (RF-ACAD-011). */
function alcanceDocente(
  alcance: AlcanceResuelto,
): Prisma.HorarioWhereInput | null {
  if (alcance.docente === null) {
    return null
  }

  if (alcance.docente.length === 0) {
    return { id: { in: [] } }
  }

  return {
    OR: alcance.docente.map((asignacion) => ({
      cursoId: asignacion.cursoId,
      seccionId: asignacion.seccionId,
    })),
  }
}

/** Sección de los alumnos vinculados al apoderado en el año (RF-ACAD-011). */
function alcanceApoderado(
  alcance: AlcanceResuelto,
  anioId: string,
): Prisma.HorarioWhereInput | null {
  if (!alcance.apoderado) {
    return null
  }

  return {
    seccion: {
      matriculas: {
        some: {
          anioId,
          estado: 'APROBADA',
          deletedAt: null,
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
        },
      },
    },
  }
}

/** Sección del propio alumno en el año (RF-ACAD-011). */
function alcanceAlumno(
  alcance: AlcanceResuelto,
  anioId: string,
): Prisma.HorarioWhereInput | null {
  if (!alcance.alumno) {
    return null
  }

  return {
    seccion: {
      matriculas: {
        some: {
          anioId,
          estado: 'APROBADA',
          deletedAt: null,
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
        },
      },
    },
  }
}

/** Construye la condición de horarios para el alcance resuelto. */
function whereHorarios(
  alcance: AlcanceResuelto,
  filtros: FiltrosConsultaHorarios,
): Prisma.HorarioWhereInput {
  const alcances = [
    alcanceDocente(alcance),
    alcanceApoderado(alcance, filtros.anioId),
    alcanceAlumno(alcance, filtros.anioId),
  ].filter((fila): fila is Prisma.HorarioWhereInput => fila !== null)

  const where: Prisma.HorarioWhereInput = {
    anioId: filtros.anioId,
    deletedAt: null,
  }

  const and: Prisma.HorarioWhereInput[] = []
  const [unico, ...resto] = alcances

  if (unico !== undefined) {
    and.push(resto.length === 0 ? unico : { OR: alcances })
  }

  if (filtros.seccionId) {
    and.push({ seccionId: filtros.seccionId })
  }

  if (filtros.docenteId) {
    and.push({ docenteId: filtros.docenteId })
  }

  if (and.length > 0) {
    where.AND = and
  }

  return where
}

/**
 * Resuelve el alcance del actor y valida que sus filtros no salgan de él
 * (RF-ACAD-011).
 *
 * @throws AppError `FORBIDDEN` sin rol con alcance o con un filtro ajeno.
 */
async function resolverAlcance(
  actor: ActorAcademico,
  filtros: FiltrosConsultaHorarios,
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
    const registro = await prisma.docente.findFirst({
      where: {
        deletedAt: null,
        persona: {
          usuario: { id: actor.id, activo: true, deletedAt: null },
        },
      },
      select: { id: true },
    })

    docente = await prisma.asignacionDocente.findMany({
      where: {
        anioId: filtros.anioId,
        docente: {
          deletedAt: null,
          persona: {
            usuario: { id: actor.id, activo: true, deletedAt: null },
          },
        },
      },
      select: { cursoId: true, seccionId: true },
    })

    if (
      filtros.seccionId &&
      !docente.some((fila) => fila.seccionId === filtros.seccionId)
    ) {
      throw new AppError('FORBIDDEN')
    }

    if (filtros.docenteId && filtros.docenteId !== registro?.id) {
      throw new AppError('FORBIDDEN')
    }
  }

  return {
    actorId: actor.id,
    todo,
    docente,
    apoderado: !todo && esApoderado,
    alumno: !todo && esAlumno,
    auditarAcceso: actor.roles.includes('SUPER_ADMIN'),
  }
}

/**
 * Construye la condición de consulta de horarios según el vínculo del actor
 * (RF-ACAD-011).
 *
 * - Director y SuperAdmin: todo el año; el segundo con acceso auditado.
 * - Docente: solo sus cursos y secciones asignados en el año.
 * - Apoderado: las secciones de sus alumnos vinculados.
 * - Alumno: solo la sección de su matrícula aprobada.
 *
 * Los roles múltiples se unen con `OR`; los filtros se aplican con `AND`.
 *
 * @throws AppError `FORBIDDEN` si no hay rol con alcance o un filtro es ajeno.
 */
export async function construirAlcanceHorarios(
  actor: ActorAcademico,
  filtros: FiltrosConsultaHorarios,
  prisma: PrismaClient = getPrisma(),
): Promise<AlcanceHorarios> {
  const alcance = await resolverAlcance(actor, filtros, prisma)

  const datosAcceso: Prisma.InputJsonObject = {
    anioId: filtros.anioId,
    ...(filtros.seccionId ? { seccionId: filtros.seccionId } : {}),
    ...(filtros.docenteId ? { docenteId: filtros.docenteId } : {}),
  }

  return {
    where: whereHorarios(alcance, filtros),
    datosAcceso,
    auditarAcceso: alcance.auditarAcceso,
  }
}
