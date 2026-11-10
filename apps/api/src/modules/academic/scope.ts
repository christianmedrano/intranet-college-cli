import type { Permission } from '@intranet/shared'
import { getPrisma } from '../../core/db.js'
import { AppError } from '../../core/errors.js'
import { hasPermission, type AuthActor } from '../../core/rbac.js'
import { assertDocenteAssignedTo } from '../../core/auth/vinculo.js'
import type { Prisma, PrismaClient } from '../../generated/prisma/client.js'

/**
 * Identidad mínima que consumen los servicios académicos.
 *
 * Los controladores la construyen desde `request.authUser`; las pruebas la
 * inyectan directamente.
 */
export type ActorAcademico = Pick<AuthActor, 'id' | 'roles'>

/**
 * Exige un permiso académico con el mismo criterio que `requirePermission`.
 *
 * Los servicios lo revalidan para que ninguna llamada interna omita el control
 * (RN-ACAD-023).
 *
 * @throws AppError `FORBIDDEN` si el actor no tiene el permiso.
 */
export function assertPermiso(
  actor: ActorAcademico,
  permission: Permission,
): void {
  if (!hasPermission(actor.roles, permission)) {
    throw new AppError('FORBIDDEN')
  }
}

/**
 * Resuelve la sección del alumno a partir de su matrícula `APROBADA` en el año
 * (RN-ACAD-008).
 *
 * @throws AppError `CONFLICT` si el alumno no tiene matrícula aprobada.
 */
export async function resolverSeccionDeAlumnoEnAnio(
  alumnoId: string,
  anioId: string,
  prisma: PrismaClient = getPrisma(),
): Promise<string> {
  const matricula = await prisma.matricula.findFirst({
    where: { alumnoId, anioId, estado: 'APROBADA', deletedAt: null },
    select: { seccionId: true },
  })

  if (!matricula) {
    throw new AppError(
      'CONFLICT',
      'El alumno no tiene matrícula aprobada en el año indicado.',
    )
  }

  return matricula.seccionId
}

/**
 * Exige que el docente tenga una asignación vigente para curso, sección y año
 * (RN-ACAD-007).
 *
 * No evalúa roles: el servicio decide cuándo aplicarlo.
 *
 * @throws AppError `FORBIDDEN` si no existe la asignación.
 */
export async function assertDocenteDeCursoSeccion(
  actor: ActorAcademico,
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
 * Indica si el actor es un perfil administrativo académico (Director o
 * SuperAdmin), que no necesita asignación docente para operar.
 */
export function esAdministrativoAcademico(actor: ActorAcademico): boolean {
  return actor.roles.includes('DIRECTOR') || actor.roles.includes('SUPER_ADMIN')
}

/**
 * Exige que un docente tenga al menos una asignación vigente en la sección y el
 * año (RN-ACAD-007).
 *
 * La asistencia es diaria por sección y no por curso, así que basta con que el
 * docente dicte cualquier curso de esa sección. Los perfiles administrativos se
 * omiten.
 *
 * @throws AppError `FORBIDDEN` si el docente no tiene asignación en la sección.
 */
export async function assertDocenteDeSeccion(
  actor: ActorAcademico,
  seccionId: string,
  anioId: string,
  prisma: PrismaClient = getPrisma(),
): Promise<void> {
  if (esAdministrativoAcademico(actor)) {
    return
  }

  const asignacion = await prisma.asignacionDocente.findFirst({
    where: {
      seccionId,
      anioId,
      docente: {
        deletedAt: null,
        persona: {
          usuario: { id: actor.id, activo: true, deletedAt: null },
        },
      },
    },
    select: { id: true },
  })

  if (!asignacion) {
    throw new AppError('FORBIDDEN')
  }
}

/** Filtros comunes de los listados por período. */
export interface FiltrosConsultaCalificaciones {
  cursoId?: string
  seccionId?: string
}

/** Condición de alcance y bandera de auditoría de acceso. */
export interface AlcanceCalificaciones {
  where: Prisma.CalificacionWhereInput
  auditarAcceso: boolean
}

/** Condición de alcance para las notas finales. */
export interface AlcanceNotasFinales {
  where: Prisma.NotaFinalPeriodoWhereInput
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
  filtros: FiltrosConsultaCalificaciones,
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
 * vigentes en el año (RN-ACAD-007).
 *
 * @throws AppError `FORBIDDEN` si no tiene un rol con alcance reconocido o si
 * un filtro del docente queda fuera de sus asignaciones.
 */
async function resolverAlcance(
  actor: ActorAcademico,
  anioId: string,
  filtros: FiltrosConsultaCalificaciones,
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

/** Condición de matrícula aprobada del alumno en la sección y año. */
function matriculaEnSeccion(anioId: string, seccionId: string) {
  return {
    some: {
      anioId,
      seccionId,
      estado: 'APROBADA',
      deletedAt: null,
    },
  }
}

/** Condición del docente: sus cursos y secciones asignados (RN-ACAD-007). */
function alcanceDocenteCalificaciones(
  alcance: AlcanceResuelto,
  anioId: string,
): Prisma.CalificacionWhereInput | null {
  if (alcance.docente === null) {
    return null
  }

  if (alcance.docente.length === 0) {
    return { id: { in: [] } }
  }

  return {
    OR: alcance.docente.map((asignacion) => ({
      cursoId: asignacion.cursoId,
      alumno: {
        matriculas: matriculaEnSeccion(anioId, asignacion.seccionId),
      },
    })),
  }
}

/** Condición del apoderado: solo sus alumnos vinculados (RF-ACAD-003). */
function alcanceApoderadoCalificaciones(
  alcance: AlcanceResuelto,
): Prisma.CalificacionWhereInput | null {
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

/** Condición del alumno: solo su propia ficha (RF-ACAD-003). */
function alcanceAlumnoCalificaciones(
  alcance: AlcanceResuelto,
): Prisma.CalificacionWhereInput | null {
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
 * Construye la condición de calificaciones para el alcance resuelto.
 *
 * Los alcances por rol se combinan con `OR` (la unión de permisos de roles
 * múltiples); el filtro de sección y el de curso se aplican como condiciones
 * adicionales con `AND`.
 */
function whereCalificaciones(
  alcance: AlcanceResuelto,
  periodoId: string,
  anioId: string,
  filtros: FiltrosConsultaCalificaciones,
): Prisma.CalificacionWhereInput {
  const alcances = [
    alcanceDocenteCalificaciones(alcance, anioId),
    alcanceApoderadoCalificaciones(alcance),
    alcanceAlumnoCalificaciones(alcance),
  ].filter((fila): fila is Prisma.CalificacionWhereInput => fila !== null)

  const where: Prisma.CalificacionWhereInput = {
    periodoId,
    deletedAt: null,
    ...(filtros.cursoId ? { cursoId: filtros.cursoId } : {}),
  }

  const and: Prisma.CalificacionWhereInput[] = []
  const [unico, ...resto] = alcances

  if (unico !== undefined) {
    and.push(resto.length === 0 ? unico : { OR: alcances })
  }

  if (filtros.seccionId) {
    and.push({
      alumno: {
        matriculas: matriculaEnSeccion(anioId, filtros.seccionId),
      },
    })
  }

  if (and.length > 0) {
    where.AND = and
  }

  return where
}

/** Condición del docente para las notas finales (RN-ACAD-007). */
function alcanceDocenteNotasFinales(
  alcance: AlcanceResuelto,
  anioId: string,
): Prisma.NotaFinalPeriodoWhereInput | null {
  if (alcance.docente === null) {
    return null
  }

  if (alcance.docente.length === 0) {
    return { id: { in: [] } }
  }

  return {
    OR: alcance.docente.map((asignacion) => ({
      cursoId: asignacion.cursoId,
      alumno: {
        matriculas: matriculaEnSeccion(anioId, asignacion.seccionId),
      },
    })),
  }
}

/** Condición del apoderado para las notas finales (RF-ACAD-003). */
function alcanceApoderadoNotasFinales(
  alcance: AlcanceResuelto,
): Prisma.NotaFinalPeriodoWhereInput | null {
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

/** Condición del alumno para las notas finales (RF-ACAD-003). */
function alcanceAlumnoNotasFinales(
  alcance: AlcanceResuelto,
): Prisma.NotaFinalPeriodoWhereInput | null {
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
 * Construye la condición de notas finales para el alcance resuelto.
 *
 * Aplica las mismas reglas que las calificaciones: los alcances por rol se
 * unen con `OR` y los filtros con `AND`.
 */
function whereNotasFinales(
  alcance: AlcanceResuelto,
  periodoId: string,
  anioId: string,
  filtros: FiltrosConsultaCalificaciones,
): Prisma.NotaFinalPeriodoWhereInput {
  const alcances = [
    alcanceDocenteNotasFinales(alcance, anioId),
    alcanceApoderadoNotasFinales(alcance),
    alcanceAlumnoNotasFinales(alcance),
  ].filter((fila): fila is Prisma.NotaFinalPeriodoWhereInput => fila !== null)

  const where: Prisma.NotaFinalPeriodoWhereInput = {
    periodoId,
    deletedAt: null,
    ...(filtros.cursoId ? { cursoId: filtros.cursoId } : {}),
  }

  const and: Prisma.NotaFinalPeriodoWhereInput[] = []
  const [unico, ...resto] = alcances

  if (unico !== undefined) {
    and.push(resto.length === 0 ? unico : { OR: alcances })
  }

  if (filtros.seccionId) {
    and.push({
      alumno: {
        matriculas: matriculaEnSeccion(anioId, filtros.seccionId),
      },
    })
  }

  if (and.length > 0) {
    where.AND = and
  }

  return where
}

/**
 * Construye la condición de consulta de calificaciones según el vínculo del
 * actor (RF-ACAD-003).
 *
 * - Director: todo el período.
 * - SuperAdmin: todo el período y acceso auditado.
 * - Docente: solo sus cursos y secciones; un filtro ajeno devuelve `403`.
 * - Apoderado: solo sus alumnos vinculados.
 * - Alumno: solo lo propio.
 *
 * Los roles múltiples se unen con `OR`. Un actor sin alcance reconocido recibe
 * `403`; un docente sin asignaciones obtiene una lista vacía.
 *
 * @throws AppError `FORBIDDEN` si el filtro del docente está fuera de alcance.
 */
export async function construirAlcanceCalificaciones(
  actor: ActorAcademico,
  periodoId: string,
  anioId: string,
  filtros: FiltrosConsultaCalificaciones,
  prisma: PrismaClient = getPrisma(),
): Promise<AlcanceCalificaciones> {
  const alcance = await resolverAlcance(actor, anioId, filtros, prisma)

  return {
    where: whereCalificaciones(alcance, periodoId, anioId, filtros),
    auditarAcceso: alcance.auditarAcceso,
  }
}

/**
 * Construye la condición de consulta de notas finales con las mismas reglas de
 * vínculo que las calificaciones (RF-ACAD-003).
 *
 * @throws AppError `FORBIDDEN` si el filtro del docente está fuera de alcance.
 */
export async function construirAlcanceNotasFinales(
  actor: ActorAcademico,
  periodoId: string,
  anioId: string,
  filtros: FiltrosConsultaCalificaciones,
  prisma: PrismaClient = getPrisma(),
): Promise<AlcanceNotasFinales> {
  const alcance = await resolverAlcance(actor, anioId, filtros, prisma)

  return {
    where: whereNotasFinales(alcance, periodoId, anioId, filtros),
    auditarAcceso: alcance.auditarAcceso,
  }
}
