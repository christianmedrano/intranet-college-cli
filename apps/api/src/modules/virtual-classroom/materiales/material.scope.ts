import type { Permission } from '@intranet/shared'
import { getPrisma } from '../../../core/db.js'
import { AppError } from '../../../core/errors.js'
import { hasPermission, type AuthActor } from '../../../core/rbac.js'
import { assertDocenteAssignedTo } from '../../../core/auth/vinculo.js'
import type { Prisma, PrismaClient } from '../../../generated/prisma/client.js'

/**
 * Identidad mínima que consumen los servicios de aula virtual.
 *
 * Los controladores la construyen desde `request.authUser`; las pruebas la
 * inyectan directamente.
 */
export type ActorVirtual = Pick<AuthActor, 'id' | 'roles'> & {
  institucionId: string
}

/**
 * Exige un permiso de aula virtual con el mismo criterio que `requirePermission`.
 *
 * Los servicios lo revalidan para que ninguna llamada interna omita el control.
 *
 * @throws AppError `FORBIDDEN` si el actor no tiene el permiso.
 */
export function assertPermiso(
  actor: ActorVirtual,
  permission: Permission,
): void {
  if (!hasPermission(actor.roles, permission)) {
    throw new AppError('FORBIDDEN')
  }
}

/**
 * Exige que el docente tenga una asignación vigente para curso, sección y año
 * (RN-VIR-001).
 *
 * No evalúa roles: el servicio decide cuándo aplicarlo.
 *
 * @throws AppError `FORBIDDEN` si no existe la asignación.
 */
export async function assertDocenteDeCursoSeccion(
  actor: ActorVirtual,
  cursoId: string,
  seccionId: string,
  anioId: string,
  prisma: PrismaClient = getPrisma(),
): Promise<void> {
  await assertDocenteAssignedTo(
    actor.id,
    { cursoId, seccionId, anioId },
    prisma,
  )
}

/**
 * Indica si el actor es un perfil administrativo (Director o SuperAdmin),
 * que no necesita asignación docente para operar.
 */
export function esAdministrativo(actor: ActorVirtual): boolean {
  return actor.roles.includes('DIRECTOR') || actor.roles.includes('SUPER_ADMIN')
}

/**
 * Resuelve la ficha `Docente` del usuario autenticado (RN-VIR-001).
 *
 * `MaterialVirtual.docenteId` referencia `Docente.id`, no `Usuario.id`: la
 * resolución es obligatoria para crear material y para comprobar autoría.
 *
 * @returns `Docente.id`, o `null` si el usuario no tiene ficha de docente vigente.
 */
export async function resolverDocenteDelActor(
  actor: ActorVirtual,
  prisma: PrismaClient = getPrisma(),
): Promise<string | null> {
  const docente = await prisma.docente.findFirst({
    where: {
      deletedAt: null,
      persona: {
        usuario: { id: actor.id, activo: true, deletedAt: null },
      },
    },
    select: { id: true },
  })

  return docente?.id ?? null
}

/** Filtros comunes de los listados de materiales. */
export interface FiltrosMateriales {
  cursoId?: string
  seccionId?: string
  periodoId?: string
  docenteId?: string
}

/** Condición de alcance y bandera de auditoría de acceso. */
export interface AlcanceMateriales {
  where: Prisma.MaterialVirtualWhereInput
  auditarAcceso: boolean
}

interface AsignacionVigente {
  cursoId: string
  seccionId: string
}

interface AlcanceResuelto {
  actorId: string
  todo: boolean
  docente: AsignacionVigente[] | null
  apoderado: boolean
  alumno: boolean
  auditarAcceso: boolean
}

/** Indica si un filtro cae dentro de las asignaciones del docente. */
function filtroPermitido(
  asignaciones: readonly AsignacionVigente[],
  filtros: FiltrosMateriales,
): boolean {
  if (filtros.cursoId && filtros.seccionId) {
    return asignaciones.some(
      (fila) =>
        fila.cursoId === filtros.cursoId &&
        fila.seccionId === filtros.seccionId,
    )
  }

  if (filtros.cursoId) {
    return asignaciones.some((fila) => fila.cursoId === filtros.cursoId)
  }

  if (filtros.seccionId) {
    return asignaciones.some((fila) => fila.seccionId === filtros.seccionId)
  }

  return true
}

/**
 * Resuelve el tipo de alcance del actor y, si es docente, sus asignaciones
 * vigentes en el año (RN-VIR-001).
 *
 * @throws AppError `FORBIDDEN` si no tiene un rol con alcance reconocido o si
 * un filtro del docente queda fuera de sus asignaciones.
 */
async function resolverAlcance(
  actor: ActorVirtual,
  anioId: string,
  filtros: FiltrosMateriales,
  prisma: PrismaClient,
): Promise<AlcanceResuelto> {
  const esAdministrativo = hasPermission(
    actor.roles,
    'academic.calificaciones.corregir',
  )
  const esSuperAdmin = actor.roles.includes('SUPER_ADMIN')
  const esDocente = actor.roles.includes('DOCENTE')
  const esApoderado = actor.roles.includes('APODERADO')
  const esAlumno = actor.roles.includes('ALUMNO')
  const todo = esAdministrativo || esSuperAdmin

  if (!todo && !esDocente && !esApoderado && !esAlumno) {
    throw new AppError('FORBIDDEN')
  }

  let docente: AsignacionVigente[] | null = null

  if (!todo && esDocente) {
    docente = await prisma.asignacionDocente.findMany({
      where: {
        anioId,
        docente: {
          deletedAt: null,
          persona: {
            usuario: { id: actor.id, activo: true, deletedAt: null },
          },
        },
      },
      select: { cursoId: true, seccionId: true },
    })

    if (!filtroPermitido(docente, filtros)) {
      throw new AppError('FORBIDDEN')
    }
  }

  return {
    actorId: actor.id,
    todo,
    docente,
    apoderado: !todo && esApoderado,
    alumno: !todo && esAlumno,
    auditarAcceso: esSuperAdmin,
  }
}

/** Condición del docente: sus cursos y secciones asignados (RN-VIR-001). */
function alcanceDocenteMateriales(
  alcance: AlcanceResuelto,
): Prisma.MaterialVirtualWhereInput | null {
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

/** Condición del apoderado: solo materiales de secciones donde tiene alumnos vinculados (RF-VIR-004). */
function alcanceApoderadoMateriales(
  alcance: AlcanceResuelto,
  anioId: string,
): Prisma.MaterialVirtualWhereInput | null {
  if (!alcance.apoderado) {
    return null
  }

  return {
    seccion: {
      matriculas: {
        some: {
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
          estado: 'APROBADA',
          deletedAt: null,
          anioId,
        },
      },
    },
  }
}

/** Condición del alumno: solo materiales de su propia sección (RF-VIR-004). */
function alcanceAlumnoMateriales(
  alcance: AlcanceResuelto,
  anioId: string,
): Prisma.MaterialVirtualWhereInput | null {
  if (!alcance.alumno) {
    return null
  }

  return {
    seccion: {
      matriculas: {
        some: {
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
          estado: 'APROBADA',
          deletedAt: null,
          anioId,
        },
      },
    },
  }
}

/**
 * Construye la condición de consulta de materiales según el vínculo del
 * actor (RF-VIR-004).
 *
 * - Director: todo el año/período de su institución.
 * - SuperAdmin: todo el año/período de su institución (acceso auditado).
 * - Docente: solo sus cursos y secciones asignados; un filtro ajeno devuelve `403`.
 * - Apoderado: solo materiales de secciones donde tiene alumnos vinculados.
 * - Alumno: solo materiales de su propia sección.
 *
 * Los roles múltiples se unen con `OR`. Un actor sin alcance reconocido recibe
 * `403`; un docente sin asignaciones obtiene una lista vacía.
 *
 * @throws AppError `FORBIDDEN` si el filtro del docente está fuera de alcance.
 */
export async function construirAlcanceMateriales(
  actor: ActorVirtual,
  anioId: string,
  filtros: FiltrosMateriales,
  prisma: PrismaClient = getPrisma(),
): Promise<AlcanceMateriales> {
  const alcance = await resolverAlcance(actor, anioId, filtros, prisma)

  const alcances = [
    alcanceDocenteMateriales(alcance),
    alcanceApoderadoMateriales(alcance, anioId),
    alcanceAlumnoMateriales(alcance, anioId),
  ].filter((fila): fila is Prisma.MaterialVirtualWhereInput => fila !== null)

  const where: Prisma.MaterialVirtualWhereInput = {
    deletedAt: null,
    anioId,
    ...(filtros.cursoId ? { cursoId: filtros.cursoId } : {}),
    ...(filtros.seccionId ? { seccionId: filtros.seccionId } : {}),
    ...(filtros.periodoId ? { periodoId: filtros.periodoId } : {}),
    ...(filtros.docenteId ? { docenteId: filtros.docenteId } : {}),
  }

  const and: Prisma.MaterialVirtualWhereInput[] = []
  const [unico, ...resto] = alcances

  if (unico !== undefined) {
    and.push(resto.length === 0 ? unico : { OR: alcances })
  }

  if (and.length > 0) {
    where.AND = and
  }

  // Filtro implícito por institución a través de Curso -> Nivel -> Institucion
  // Esto se aplica automáticamente porque el servicio pasa el anioId que ya tiene institucionId

  return {
    where,
    auditarAcceso: alcance.auditarAcceso,
  }
}

/**
 * Verifica si el actor tiene vínculo con un material específico (RF-VIR-005).
 *
 * Los roles múltiples se unen: basta con que uno de los vínculos se cumpla.
 * `anioId` es opcional; cuando se omite se usa el año del período del material
 * (los adjuntos no reciben el header de año).
 *
 * @throws AppError `NOT_FOUND` si el material no existe o `FORBIDDEN` si no hay vínculo.
 */
export async function assertVinculoMaterial(
  actor: ActorVirtual,
  materialId: string,
  anioId?: string,
  prisma: PrismaClient = getPrisma(),
): Promise<void> {
  if (esAdministrativo(actor)) {
    return
  }

  const esDocente = actor.roles.includes('DOCENTE')
  const esApoderado = actor.roles.includes('APODERADO')
  const esAlumno = actor.roles.includes('ALUMNO')

  if (!esDocente && !esApoderado && !esAlumno) {
    throw new AppError('FORBIDDEN')
  }

  const material = await prisma.materialVirtual.findUnique({
    where: { id: materialId, deletedAt: null },
    select: {
      cursoId: true,
      seccionId: true,
      periodo: { select: { anioId: true } },
    },
  })

  if (!material) {
    throw new AppError('NOT_FOUND', 'El material no existe.')
  }

  const anioMaterial = material.periodo.anioId

  if (anioId !== undefined && anioId !== '' && anioId !== anioMaterial) {
    throw new AppError('FORBIDDEN')
  }

  if (esDocente) {
    const asignacion = await prisma.asignacionDocente.findFirst({
      where: {
        cursoId: material.cursoId,
        seccionId: material.seccionId,
        anioId: anioMaterial,
        docente: {
          deletedAt: null,
          persona: {
            usuario: { id: actor.id, activo: true, deletedAt: null },
          },
        },
      },
      select: { id: true },
    })

    if (asignacion) {
      return
    }
  }

  if (esApoderado) {
    const matricula = await prisma.matricula.findFirst({
      where: {
        alumno: {
          deletedAt: null,
          apoderados: {
            some: {
              apoderado: {
                deletedAt: null,
                persona: {
                  usuario: { id: actor.id, activo: true, deletedAt: null },
                },
              },
            },
          },
        },
        seccionId: material.seccionId,
        anioId: anioMaterial,
        estado: 'APROBADA',
        deletedAt: null,
      },
      select: { id: true },
    })

    if (matricula) {
      return
    }
  }

  if (esAlumno) {
    const matricula = await prisma.matricula.findFirst({
      where: {
        alumno: {
          deletedAt: null,
          persona: {
            usuario: { id: actor.id, activo: true, deletedAt: null },
          },
        },
        seccionId: material.seccionId,
        anioId: anioMaterial,
        estado: 'APROBADA',
        deletedAt: null,
      },
      select: { id: true },
    })

    if (matricula) {
      return
    }
  }

  throw new AppError('FORBIDDEN')
}