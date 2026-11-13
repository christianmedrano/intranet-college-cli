import type { Permission } from '@intranet/shared'
import { getPrisma } from '../../../core/db.js'
import { AppError } from '../../../core/errors.js'
import { hasPermission, type AuthActor } from '../../../core/rbac.js'
import type { Prisma, PrismaClient } from '../../../generated/prisma/client.js'

/**
 * Identidad mínima que consumen los servicios de certificados.
 */
export type ActorCertificados = Pick<AuthActor, 'id' | 'roles'> & {
  institucionId: string
}

/**
 * Exige un permiso de certificados.
 */
export function assertPermiso(
  actor: ActorCertificados,
  permission: Permission,
): void {
  if (!hasPermission(actor.roles, permission)) {
    throw new AppError('FORBIDDEN')
  }
}

/**
 * Indica si el actor es un perfil administrativo (Director o SuperAdmin).
 */
export function esAdministrativo(actor: ActorCertificados): boolean {
  return actor.roles.includes('DIRECTOR') || actor.roles.includes('SUPER_ADMIN')
}

/** Filtros comunes de los listados de certificados. */
export interface FiltrosCertificados {
  tipo?: string
  alumnoId?: string
  anioId?: string
  estado?: string
}

/** Condición de alcance y bandera de auditoría de acceso. */
export interface AlcanceCertificados {
  where: Prisma.CertificadoWhereInput
  auditarAcceso: boolean
}

/**
 * Resuelve el tipo de alcance del actor para certificados.
 */
async function resolverAlcance(
  actor: ActorCertificados,
  filtros: FiltrosCertificados,
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

/** Condición del apoderado: solo certificados de sus alumnos vinculados. */
function alcanceApoderadoCertificados(
  alcance: Awaited<ReturnType<typeof resolverAlcance>>,
): Prisma.CertificadoWhereInput | null {
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

/** Condición del alumno: solo sus propios certificados. */
function alcanceAlumnoCertificados(
  alcance: Awaited<ReturnType<typeof resolverAlcance>>,
): Prisma.CertificadoWhereInput | null {
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
 * Construye la condición de consulta de certificados según el vínculo del actor.
 *
 * - Director/SuperAdmin: todos los certificados de su institución.
 * - Apoderado: solo certificados de sus alumnos vinculados.
 * - Alumno: solo sus propios certificados.
 *
 * @throws AppError `FORBIDDEN` si el actor no tiene alcance reconocido.
 */
export async function construirAlcanceCertificados(
  actor: ActorCertificados,
  filtros: FiltrosCertificados,
  prisma: PrismaClient = getPrisma(),
): Promise<AlcanceCertificados> {
  const alcance = await resolverAlcance(actor, filtros, prisma)

  const alcances = [
    alcanceApoderadoCertificados(alcance),
    alcanceAlumnoCertificados(alcance),
  ].filter((fila): fila is Prisma.CertificadoWhereInput => fila !== null)

  const where: Prisma.CertificadoWhereInput = {
    deletedAt: null,
    ...(filtros.tipo ? { tipo: filtros.tipo } : {}),
    ...(filtros.alumnoId ? { alumnoId: filtros.alumnoId } : {}),
    ...(filtros.anioId ? { anioId: filtros.anioId } : {}),
    ...(filtros.estado ? { estado: filtros.estado } : {}),
  }

  const and: Prisma.CertificadoWhereInput[] = []
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
 * Verifica si el actor tiene vínculo con un certificado específico.
 */
export async function assertVinculoCertificado(
  actor: ActorCertificados,
  certificadoId: string,
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

  const certificado = await prisma.certificado.findUnique({
    where: { id: certificadoId, deletedAt: null },
    select: { alumnoId: true },
  })

  if (!certificado) {
    throw new AppError('NOT_FOUND', 'El certificado no existe.')
  }

  if (esApoderado) {
    const vinculado = await prisma.apoderadoAlumno.findFirst({
      where: {
        alumnoId: certificado.alumnoId,
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
        id: certificado.alumnoId,
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