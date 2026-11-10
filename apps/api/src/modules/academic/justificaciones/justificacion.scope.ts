import type { EstadoJustificacion } from '@intranet/shared'
import type {
  Prisma,
  PrismaClient,
} from '../../../generated/prisma/client.js'
import { getPrisma } from '../../../core/db.js'
import {
  resolverAlcanceAsistencias,
  type AlcanceResuelto,
} from '../asistencias/asistencia.scope.js'
import type { ActorAcademico } from '../scope.js'

/** Filtros del listado de justificaciones (RF-ACAD-007). */
export interface FiltrosConsultaJustificaciones {
  estado?: EstadoJustificacion
  alumnoId?: string
  seccionId?: string
}

/** Condición de alcance y bandera de auditoría de acceso. */
export interface AlcanceJustificaciones {
  where: Prisma.JustificacionFaltaWhereInput
  datosAcceso: Prisma.InputJsonObject
  auditarAcceso: boolean
}

/** Construye la condición de justificaciones para el alcance resuelto. */
function whereJustificaciones(
  alcance: AlcanceResuelto,
  filtros: FiltrosConsultaJustificaciones,
): Prisma.JustificacionFaltaWhereInput {
  const alcances: Prisma.JustificacionFaltaWhereInput[] = []

  if (alcance.docente !== null) {
    alcances.push(
      alcance.docente.length === 0
        ? { id: { in: [] } }
        : {
            OR: alcance.docente.map((asignacion) => ({
              asistencia: {
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
              },
            })),
          },
    )
  }

  if (alcance.apoderado) {
    alcances.push({
      asistencia: {
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
    })
  }

  if (alcance.alumno) {
    alcances.push({
      asistencia: {
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
    })
  }

  const where: Prisma.JustificacionFaltaWhereInput = {
    asistencia: { deletedAt: null },
  }
  const and: Prisma.JustificacionFaltaWhereInput[] = []
  const [unico, ...resto] = alcances

  if (unico !== undefined) {
    and.push(resto.length === 0 ? unico : { OR: alcances })
  }

  if (filtros.estado) {
    where.estado = filtros.estado
  }

  if (filtros.alumnoId) {
    and.push({ asistencia: { alumnoId: filtros.alumnoId } })
  }

  if (filtros.seccionId) {
    and.push({
      asistencia: {
        alumno: {
          matriculas: {
            some: {
              seccionId: filtros.seccionId,
              estado: 'APROBADA',
              deletedAt: null,
            },
          },
        },
      },
    })
  }

  if (and.length > 0) {
    where.AND = and
  }

  return where
}

/**
 * Construye la condición de consulta de justificaciones según el vínculo del
 * actor (RF-ACAD-007).
 *
 * Reutiliza la resolución de alcance de asistencias: Director y SuperAdmin ven
 * todo; docente, sus secciones y años; apoderado, sus alumnos; alumno, lo
 * propio. Los filtros ajenos devuelven `403` desde la resolución.
 *
 * @throws AppError `FORBIDDEN` si no hay rol con alcance o un filtro es ajeno.
 */
export async function construirAlcanceJustificaciones(
  actor: ActorAcademico,
  filtros: FiltrosConsultaJustificaciones,
  prisma: PrismaClient = getPrisma(),
): Promise<AlcanceJustificaciones> {
  const alcance = await resolverAlcanceAsistencias(
    actor,
    { ...filtros },
    prisma,
  )

  const datosAcceso: Prisma.InputJsonObject = {
    ...(filtros.estado ? { estado: filtros.estado } : {}),
    ...(filtros.alumnoId ? { alumnoId: filtros.alumnoId } : {}),
    ...(filtros.seccionId ? { seccionId: filtros.seccionId } : {}),
  }

  return {
    where: whereJustificaciones(alcance, filtros),
    datosAcceso,
    auditarAcceso: alcance.auditarAcceso,
  }
}
