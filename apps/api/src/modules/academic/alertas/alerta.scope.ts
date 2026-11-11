import type { Prisma, PrismaClient } from '../../../generated/prisma/client.js'
import { getPrisma } from '../../../core/db.js'
import {
  resolverAlcanceAsistencias,
  type AlcanceResuelto,
} from '../asistencias/asistencia.scope.js'
import type { ActorAcademico } from '../scope.js'

/** Filtros del listado de alertas (RF-ACAD-009). */
export interface FiltrosConsultaAlertas {
  anioId?: string
  alumnoId?: string
}

/** Condición de alcance y bandera de auditoría de acceso. */
export interface AlcanceAlertas {
  where: Prisma.AlertaAsistenciaWhereInput
  datosAcceso: Prisma.InputJsonObject
  auditarAcceso: boolean
}

/** Condición del docente: alumnos matriculados en sus secciones y años. */
function alcanceDocente(
  alcance: AlcanceResuelto,
): Prisma.AlertaAsistenciaWhereInput | null {
  if (alcance.docente === null) {
    return null
  }

  if (alcance.docente.length === 0) {
    return { id: { in: [] } }
  }

  return {
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
  }
}

/** Condición del apoderado: solo sus alumnos vinculados (RF-ACAD-009). */
function alcanceApoderado(
  alcance: AlcanceResuelto,
): Prisma.AlertaAsistenciaWhereInput | null {
  if (!alcance.apoderado) {
    return null
  }

  return {
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
  }
}

/** Condición del alumno: solo su propia alerta (RF-ACAD-009). */
function alcanceAlumno(
  alcance: AlcanceResuelto,
): Prisma.AlertaAsistenciaWhereInput | null {
  if (!alcance.alumno) {
    return null
  }

  return {
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
  }
}

/** Construye la condición de alertas para el alcance resuelto. */
function whereAlertas(
  alcance: AlcanceResuelto,
  filtros: FiltrosConsultaAlertas,
): Prisma.AlertaAsistenciaWhereInput {
  const alcances = [
    alcanceDocente(alcance),
    alcanceApoderado(alcance),
    alcanceAlumno(alcance),
  ].filter((fila): fila is Prisma.AlertaAsistenciaWhereInput => fila !== null)

  const where: Prisma.AlertaAsistenciaWhereInput = {
    ...(filtros.anioId ? { anioId: filtros.anioId } : {}),
    ...(filtros.alumnoId ? { alumnoId: filtros.alumnoId } : {}),
  }

  const and: Prisma.AlertaAsistenciaWhereInput[] = []
  const [unico, ...resto] = alcances

  if (unico !== undefined) {
    and.push(resto.length === 0 ? unico : { OR: alcances })
  }

  if (and.length > 0) {
    where.AND = and
  }

  return where
}

/**
 * Construye la condición de consulta de alertas según el vínculo del actor
 * (RF-ACAD-009).
 *
 * Reutiliza la resolución de alcance de asistencias: Director y SuperAdmin ven
 * todo (el segundo con acceso auditado); docente, sus secciones y años;
 * apoderado, sus alumnos; alumno, lo propio.
 *
 * @throws AppError `FORBIDDEN` si no hay rol con alcance o un filtro es ajeno.
 */
export async function construirAlcanceAlertas(
  actor: ActorAcademico,
  filtros: FiltrosConsultaAlertas,
  prisma: PrismaClient = getPrisma(),
): Promise<AlcanceAlertas> {
  const alcance = await resolverAlcanceAsistencias(
    actor,
    { ...filtros },
    prisma,
  )

  const datosAcceso: Prisma.InputJsonObject = {
    ...(filtros.anioId ? { anioId: filtros.anioId } : {}),
    ...(filtros.alumnoId ? { alumnoId: filtros.alumnoId } : {}),
  }

  return {
    where: whereAlertas(alcance, filtros),
    datosAcceso,
    auditarAcceso: alcance.auditarAcceso,
  }
}
