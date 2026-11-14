import type { Prisma } from '../../../generated/prisma/client.js'
import type { PrismaClient } from '../../../generated/prisma/client.js'
import { getPrisma } from '../../../core/db.js'
import { AppError } from '../../../core/errors.js'
import { type ActorAcademico } from '../../academic/scope.js'

/** Filtros del listado de mensajes (ya validados por Zod). */
export interface FiltrosConsultaMensajes {
  seccionId: string
}

/** Condición de alcance y bandera de auditoría de acceso. */
export interface AlcanceMensajes {
  where: Prisma.MensajeSeccionWhereInput
  hiloId: string
  auditarAcceso: boolean
}

/**
 * Resuelve el alcance de mensajes según el rol y vínculos del actor.
 *
 * - SuperAdmin: ve todos los mensajes de la institución (acceso auditado).
 * - Director: ve todos los mensajes de la institución (auditado).
 * - Docente tutor: ve los mensajes de las secciones donde es tutor.
 * - Apoderado: ve los mensajes de las secciones donde tiene alumnos con matrícula APROBADA.
 * - Alumno: NO tiene acceso a la mensajería (MVP).
 *
 * @param actor Usuario autenticado con sus roles.
 * @param filtros Filtros validados por Zod (seccionId obligatorio).
 * @param prisma Cliente inyectable para las pruebas.
 * @returns Condición `where` de Prisma, hiloId y bandera de auditoría.
 */
export async function construirAlcanceMensajes(
  actor: ActorAcademico,
  filtros: FiltrosConsultaMensajes,
  prisma: PrismaClient = getPrisma(),
): Promise<AlcanceMensajes> {
  const esSA = actor.roles.includes('SUPER_ADMIN')
  const esDI = actor.roles.includes('DIRECTOR')
  const esDO = actor.roles.includes('DOCENTE')
  const esPA = actor.roles.includes('APODERADO')
  const esAL = actor.roles.includes('ALUMNO')

  // Alumno no tiene acceso a mensajería (MVP)
  if (esAL && !esDO && !esPA && !esDI && !esSA) {
    return {
      where: { id: 'NINGUNO' }, // Fuerza resultado vacío
      hiloId: '',
      auditarAcceso: false,
    }
  }

  // Obtener hilo de la sección
  const hilo = await prisma.hiloMensajeria.findUnique({
    where: { seccionId: filtros.seccionId },
    select: { id: true },
  })

  if (!hilo) {
    return {
      where: { id: 'NINGUNO' },
      hiloId: '',
      auditarAcceso: false,
    }
  }

  const hiloId = hilo.id

  // SuperAdmin y Director ven todo (acceso auditado, RF-COM-004)
  if (esSA || esDI) {
    return {
      where: { hiloId, deletedAt: null },
      hiloId,
      auditarAcceso: true,
    }
  }

  // Docente: solo si es tutor de la sección
  if (esDO) {
    const asignacion = await prisma.asignacionDocente.findFirst({
      where: {
        docente: { persona: { usuario: { id: actor.id } } },
        seccionId: filtros.seccionId,
        esTutor: true,
        anio: { estado: 'ACTIVO' },
      },
      select: { id: true },
    })

    if (!asignacion) {
      return { where: { id: 'NINGUNO' }, hiloId, auditarAcceso: false }
    }

    return {
      where: { hiloId, deletedAt: null },
      hiloId,
      auditarAcceso: false,
    }
  }

  // Apoderado: solo si tiene alumno en la sección con matrícula APROBADA
  if (esPA) {
    const apoderado = await prisma.apoderado.findFirst({
      where: { persona: { usuario: { id: actor.id } } },
      select: { id: true },
    })

    if (!apoderado) {
      return { where: { id: 'NINGUNO' }, hiloId, auditarAcceso: false }
    }

    const vinculaciones = await prisma.apoderadoAlumno.findMany({
      where: { apoderadoId: apoderado.id, esPrincipal: true },
      select: { alumnoId: true },
    })

    const matricula = await prisma.matricula.findFirst({
      where: {
        alumnoId: { in: vinculaciones.map((v) => v.alumnoId) },
        seccionId: filtros.seccionId,
        estado: 'APROBADA',
        anio: { estado: 'ACTIVO' },
      },
      select: { id: true },
    })

    if (!matricula) {
      return { where: { id: 'NINGUNO' }, hiloId, auditarAcceso: false }
    }

    return {
      where: { hiloId, deletedAt: null },
      hiloId,
      auditarAcceso: false,
    }
  }

  // Por defecto, sin acceso
  return {
    where: { id: 'NINGUNO' },
    hiloId,
    auditarAcceso: false,
  }
}

/**
 * Verifica que el actor pueda escribir en el hilo de una sección (RF-COM-004).
 *
 * No exige que el hilo exista: se crea con el primer mensaje. Según la matriz
 * RBAC, el SuperAdmin no participa y el Director solo comunica
 * institucionalmente; escriben el docente tutor y los apoderados con alumno
 * matriculado (`APROBADA`) en la sección.
 *
 * @throws AppError `FORBIDDEN` si el actor no tiene vínculo con la sección.
 */
export async function assertVinculoSeccion(
  actor: ActorAcademico,
  seccionId: string,
  prisma: PrismaClient = getPrisma(),
): Promise<void> {
  if (actor.roles.includes('SUPER_ADMIN') || actor.roles.includes('DIRECTOR')) {
    throw new AppError(
      'FORBIDDEN',
      'La mensajería de sección es solo para docentes tutores y apoderados.',
    )
  }

  if (actor.roles.includes('DOCENTE')) {
    const asignacion = await prisma.asignacionDocente.findFirst({
      where: {
        docente: { persona: { usuario: { id: actor.id } } },
        seccionId,
        esTutor: true,
        anio: { estado: 'ACTIVO' },
      },
      select: { id: true },
    })

    if (asignacion) return
  }

  if (actor.roles.includes('APODERADO')) {
    const apoderado = await prisma.apoderado.findFirst({
      where: { persona: { usuario: { id: actor.id } } },
      select: { id: true },
    })

    if (apoderado) {
      const vinculaciones = await prisma.apoderadoAlumno.findMany({
        where: { apoderadoId: apoderado.id, esPrincipal: true },
        select: { alumnoId: true },
      })

      const matricula = await prisma.matricula.findFirst({
        where: {
          alumnoId: { in: vinculaciones.map((v) => v.alumnoId) },
          seccionId,
          estado: 'APROBADA',
          anio: { estado: 'ACTIVO' },
        },
        select: { id: true },
      })

      if (matricula) return
    }
  }

  throw new AppError(
    'FORBIDDEN',
    'No tienes vínculo con esta sección para enviar mensajes.',
  )
}