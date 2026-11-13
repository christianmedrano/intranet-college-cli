import type { Permission } from '@intranet/shared'
import { getPrisma } from '../../../core/db.js'
import { AppError } from '../../../core/errors.js'
import { hasPermission, type AuthActor } from '../../../core/rbac.js'
import type { Prisma, PrismaClient } from '../../../generated/prisma/client.js'

/**
 * Identidad mínima que consumen los servicios de pagos.
 */
export type ActorPagos = Pick<AuthActor, 'id' | 'roles'> & {
  institucionId: string
}

/**
 * Exige un permiso de pagos.
 */
export function assertPermiso(
  actor: ActorPagos,
  permission: Permission,
): void {
  if (!hasPermission(actor.roles, permission)) {
    throw new AppError('FORBIDDEN')
  }
}

/**
 * Indica si el actor es un perfil administrativo (Director o SuperAdmin).
 */
export function esAdministrativo(actor: ActorPagos): boolean {
  return actor.roles.includes('DIRECTOR') || actor.roles.includes('SUPER_ADMIN')
}

/** Filtros comunes de los listados de pagos. */
export interface FiltrosPagos {
  alumnoId?: string
  concepto?: string
  fechaDesde?: Date
  fechaHasta?: Date
  estado?: string
  metodo?: string
}

/** Condición de alcance y bandera de auditoría de acceso. */
export interface AlcancePagos {
  where: Prisma.PagoWhereInput
  auditarAcceso: boolean
}

/**
 * Resuelve el tipo de alcance del actor para pagos.
 */
async function resolverAlcance(
  actor: ActorPagos,
  filtros: FiltrosPagos,
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

/** Condición del apoderado: solo pagos de sus alumnos vinculados. */
function alcanceApoderadoPagos(
  alcance: Awaited<ReturnType<typeof resolverAlcance>>,
): Prisma.PagoWhereInput | null {
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
  }
}

/** Condición del alumno: solo sus propios pagos. */
function alcanceAlumnoPagos(
  alcance: Awaited<ReturnType<typeof resolverAlcance>>,
): Prisma.PagoWhereInput | null {
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

/**
 * Construye la condición de consulta de pagos según el vínculo del actor.
 *
 * - Director/SuperAdmin: todos los pagos de su institución.
 * - Apoderado: solo pagos de sus alumnos vinculados.
 * - Alumno: solo sus propios pagos.
 *
 * @throws AppError `FORBIDDEN` si el actor no tiene alcance reconocido.
 */
export async function construirAlcancePagos(
  actor: ActorPagos,
  filtros: FiltrosPagos,
  prisma: PrismaClient = getPrisma(),
): Promise<AlcancePagos> {
  const alcance = await resolverAlcance(actor, filtros, prisma)

  const alcances = [
    alcanceApoderadoPagos(alcance),
    alcanceAlumnoPagos(alcance),
  ].filter((fila): fila is Prisma.PagoWhereInput => fila !== null)

  const where: Prisma.PagoWhereInput = {
    ...(filtros.alumnoId ? { alumnoId: filtros.alumnoId } : {}),
    ...(filtros.concepto ? { concepto: filtros.concepto } : {}),
    ...(filtros.estado ? { estado: filtros.estado } : {}),
    ...(filtros.metodo ? { metodo: filtros.metodo } : {}),
    ...(filtros.fechaDesde || filtros.fechaHasta
      ? {
          fechaPago: {
            ...(filtros.fechaDesde ? { gte: filtros.fechaDesde } : {}),
            ...(filtros.fechaHasta ? { lte: filtros.fechaHasta } : {}),
          },
        }
      : {}),
  }

  const and: Prisma.PagoWhereInput[] = []
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
 * Verifica si el actor tiene vínculo con un pago específico.
 */
export async function assertVinculoPago(
  actor: ActorPagos,
  pagoId: string,
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

  const pago = await prisma.pago.findUnique({
    where: { id: pagoId },
    select: { alumnoId: true },
  })

  if (!pago) {
    throw new AppError('NOT_FOUND', 'El pago no existe.')
  }

  if (esApoderado) {
    const vinculado = await prisma.apoderadoAlumno.findFirst({
      where: {
        alumnoId: pago.alumnoId,
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
        id: pago.alumnoId,
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