import type { Permission } from '@intranet/shared'
import { getPrisma } from '../../../core/db.js'
import { AppError } from '../../../core/errors.js'
import { hasPermission, type AuthActor } from '../../../core/rbac.js'
import type { Prisma, PrismaClient } from '../../../generated/prisma/client.js'

/**
 * Identidad mínima que consumen los servicios de matrículas administrativas.
 */
export type ActorMatriculas = Pick<AuthActor, 'id' | 'roles'> & {
  institucionId: string
}

/**
 * Exige un permiso de matrículas administrativas.
 */
export function assertPermiso(
  actor: ActorMatriculas,
  permission: Permission,
): void {
  if (!hasPermission(actor.roles, permission)) {
    throw new AppError('FORBIDDEN')
  }
}

/**
 * Indica si el actor es un perfil administrativo (Director o SuperAdmin).
 */
export function esAdministrativo(actor: ActorMatriculas): boolean {
  return actor.roles.includes('DIRECTOR') || actor.roles.includes('SUPER_ADMIN')
}

/** Filtros comunes de los listados de matrículas. */
export interface FiltrosMatriculasAdmin {
  anioId?: string
  nivelId?: string
  gradoId?: string
  seccionId?: string
  estado?: string
  alumnoId?: string
}

/** Condición de alcance y bandera de auditoría de acceso. */
export interface AlcanceMatriculasAdmin {
  where: Prisma.MatriculaWhereInput
  auditarAcceso: boolean
}

/**
 * Resuelve el tipo de alcance del actor para matrículas administrativas.
 */
async function resolverAlcance(
  actor: ActorMatriculas,
  filtros: FiltrosMatriculasAdmin,
  prisma: PrismaClient,
) {
  const esSuperAdmin = actor.roles.includes('SUPER_ADMIN')
  const esDirector = actor.roles.includes('DIRECTOR')
  const esApoderado = actor.roles.includes('APODERADO')
  const esAlumno = actor.roles.includes('ALUMNO')

  const todo = esSuperAdmin || esDirector

  if (!todo && !esApoderado && !esAlumno) {
    throw new AppError('FORBIDDEN')
  }

  // Validar vínculo apoderado/alumno si hay filtro de alumno
  if (!todo && (esApoderado || esAlumno) && filtros.alumnoId) {
    if (esApoderado) {
      const vinculado = await prisma.apoderadoAlumno.findFirst({
        where: {
          alumnoId: filtros.alumnoId,
          apoderado: {
            deletedAt: null,
            persona: {
              usuario: { id: actor.id, activo: true, deletedAt: null },
            },
          },
        },
        select: { apoderadoId: true, alumnoId: true },
      })
      if (!vinculado) {
        throw new AppError('FORBIDDEN', 'El apoderado no tiene vínculo con ese alumno.')
      }
    } else if (esAlumno) {
      const alumno = await prisma.alumno.findFirst({
        where: {
          id: filtros.alumnoId,
          deletedAt: null,
          persona: {
            usuario: { id: actor.id, activo: true, deletedAt: null },
          },
        },
        select: { id: true },
      })
      if (!alumno) {
        throw new AppError('FORBIDDEN', 'El alumno no coincide con el usuario autenticado.')
      }
    }
  }

  return {
    actorId: actor.id,
    todo,
    apoderado: !todo && esApoderado,
    alumno: !todo && esAlumno,
    auditarAcceso: esSuperAdmin,
  }
}

/** Condición del apoderado: solo matrículas de sus alumnos vinculados (SOLICITADA/APROBADA). */
function alcanceApoderadoMatriculas(
  alcance: Awaited<ReturnType<typeof resolverAlcance>>,
): Prisma.MatriculaWhereInput | null {
  if (!alcance.apoderado) {
    return null
  }

  return {
    alumno: {
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
    estado: { in: ['SOLICITADA', 'APROBADA'] },
  }
}

/** Condición del alumno: solo sus propias matrículas (SOLICITADA/APROBADA). */
function alcanceAlumnoMatriculas(
  alcance: Awaited<ReturnType<typeof resolverAlcance>>,
): Prisma.MatriculaWhereInput | null {
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
    estado: { in: ['SOLICITADA', 'APROBADA'] },
  }
}

/**
 * Construye la condición de consulta de matrículas según el vínculo del actor.
 *
 * - Director/SuperAdmin: todas las matrículas de su institución.
 * - Apoderado: solo matrículas SOLICITADA/APROBADA de sus alumnos vinculados.
 * - Alumno: solo sus propias matrículas SOLICITADA/APROBADA.
 *
 * @throws AppError `FORBIDDEN` si el actor no tiene alcance reconocido.
 */
export async function construirAlcanceMatriculas(
  actor: ActorMatriculas,
  filtros: FiltrosMatriculasAdmin,
  prisma: PrismaClient = getPrisma(),
): Promise<AlcanceMatriculasAdmin> {
  const alcance = await resolverAlcance(actor, filtros, prisma)

  const alcances = [
    alcanceApoderadoMatriculas(alcance),
    alcanceAlumnoMatriculas(alcance),
  ].filter((fila): fila is Prisma.MatriculaWhereInput => fila !== null)

  const where: Prisma.MatriculaWhereInput = {
    deletedAt: null,
    ...(filtros.anioId ? { anioId: filtros.anioId } : {}),
    ...(filtros.seccionId ? { seccionId: filtros.seccionId } : {}),
    ...(filtros.estado ? { estado: filtros.estado } : {}),
    ...(filtros.alumnoId ? { alumnoId: filtros.alumnoId } : {}),
    ...(filtros.nivelId || filtros.gradoId
      ? {
          seccion: {
            grado: {
              ...(filtros.nivelId ? { nivelId: filtros.nivelId } : {}),
              ...(filtros.gradoId ? { id: filtros.gradoId } : {}),
            },
          },
        }
      : {}),
  }

  const and: Prisma.MatriculaWhereInput[] = []
  const [unico, ...resto] = alcances

  if (unico !== undefined) {
    and.push(resto.length === 0 ? unico : { OR: alcances })
  }

  if (and.length > 0) {
    where.AND = and
  }

  return {
    where,
    auditarAcceso: alcance.auditarAcceso,
  }
}

/**
 * Verifica si el actor tiene vínculo con una matrícula específica.
 */
export async function assertVinculoMatricula(
  actor: ActorMatriculas,
  matriculaId: string,
  prisma: PrismaClient = getPrisma(),
): Promise<void> {
  if (esAdministrativo(actor)) {
    return
  }

  const esApoderado = actor.roles.includes('APODERADO')
  const esAlumno = actor.roles.includes('ALUMNO')

  if (!esApoderado && !esAlumno) {
    throw new AppError('FORBIDDEN')
  }

  const matricula = await prisma.matricula.findUnique({
    where: { id: matriculaId, deletedAt: null },
    select: { alumnoId: true },
  })

  if (!matricula) {
    throw new AppError('NOT_FOUND', 'La matrícula no existe.')
  }

  if (esApoderado) {
    const vinculado = await prisma.apoderadoAlumno.findFirst({
      where: {
        alumnoId: matricula.alumnoId,
        apoderado: {
          deletedAt: null,
          persona: {
            usuario: { id: actor.id, activo: true, deletedAt: null },
          },
        },
      },
      select: { apoderadoId: true, alumnoId: true },
    })

    if (vinculado) {
      return
    }
  }

  if (esAlumno) {
    const alumno = await prisma.alumno.findFirst({
      where: {
        id: matricula.alumnoId,
        deletedAt: null,
        persona: {
          usuario: { id: actor.id, activo: true, deletedAt: null },
        },
      },
      select: { id: true },
    })

    if (alumno) {
      return
    }
  }

  throw new AppError('FORBIDDEN')
}