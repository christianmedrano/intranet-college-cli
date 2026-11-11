import type { Prisma } from '../../../generated/prisma/client.js'
import type { PrismaClient } from '../../../generated/prisma/client.js'
import { getPrisma } from '../../../core/db.js'
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

  // SuperAdmin y Director ven todo (auditado)
  if (esSA || esDI) {
    return {
      where: { hiloId, deletedAt: null },
      hiloId,
      auditarAcceso: esSA,
    }
  }

  // Docente: solo si es tutor de la sección
  if (esDO) {
    const asignacion = await prisma.asignacionDocente.findFirst({
      where: {
        docente: { usuarioId: actor.id },
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
      where: { persona: { usuarioId: actor.id } },
      select: { id: true },
    })

    if (!apoderado) {
      return { where: { id: 'NINGUNO' }, hiloId, auditarAcceso: false }
    }

    const vinculacion = await prisma.apoderadoAlumno.findFirst({
      where: { apoderadoId: apoderado.id, esPrincipal: true },
      select: { alumnoId: true },
    })

    if (!vinculacion) {
      return { where: { id: 'NINGUNO' }, hiloId, auditarAcceso: false }
    }

    const matricula = await prisma.matricula.findFirst({
      where: {
        alumnoId: vinculacion.alumnoId,
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