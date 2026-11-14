import type { Prisma } from '../../../generated/prisma/client.js'
import type { PrismaClient } from '../../../generated/prisma/client.js'
import { getPrisma } from '../../../core/db.js'
import { type ActorAcademico } from '../../academic/scope.js'

/** Filtros del listado de anuncios (ya validados por Zod). */
export interface FiltrosConsultaAnuncios {
  tipo?: 'INSTITUCIONAL' | 'SECCION'
  estado?: 'BORRADOR' | 'PUBLICADO' | 'EXPIRADO' | 'ARCHIVADO'
  nivelId?: string
  gradoId?: string
  seccionId?: string
  rol?: string
  desde?: string
  hasta?: string
}

/** Condición de alcance y bandera de auditoría de acceso. */
export interface AlcanceAnuncios {
  where: Prisma.AnuncioWhereInput
  auditarAcceso: boolean
}

/** IDs de vínculos del actor para filtrar anuncios. */
interface VinculosActor {
  seccionIds: string[]
  gradoIds: string[]
  nivelIds: string[]
  alumnoIds: string[]
}

/**
 * Resuelve el alcance de anuncios según el rol y vínculos del actor.
 *
 * - SuperAdmin: ve todos los anuncios de la institución (acceso auditado).
 * - Director: ve todos los anuncios de la institución.
 * - Docente: ve institucionales + secciones donde es tutor + secciones asignadas a sus cursos.
 * - Apoderado: ve anuncios dirigidos a sus alumnos (nivel/grado/sección/rol ALUMNO/APODERADO).
 * - Alumno: ve anuncios dirigidos a su sección/grado/nivel/rol ALUMNO.
 *
 * @param actor Usuario autenticado con sus roles.
 * @param filtros Filtros validados por Zod.
 * @param prisma Cliente inyectable para las pruebas.
 * @returns Condición `where` de Prisma y bandera de auditoría.
 */
export async function construirAlcanceAnuncios(
  actor: ActorAcademico,
  filtros: FiltrosConsultaAnuncios,
  prisma: PrismaClient = getPrisma(),
): Promise<AlcanceAnuncios> {
  const esSA = actor.roles.includes('SUPER_ADMIN')
  const esDI = actor.roles.includes('DIRECTOR')
  const esDO = actor.roles.includes('DOCENTE')
  const esPA = actor.roles.includes('APODERADO')
  const esAL = actor.roles.includes('ALUMNO')

  // SuperAdmin y Director ven todo (SA auditado)
  if (esSA || esDI) {
    const where: Prisma.AnuncioWhereInput = {
      deletedAt: null,
      institucionId: actor.institucionId,
    }
    if (filtros.tipo) where.tipo = filtros.tipo
    if (filtros.estado) where.estado = filtros.estado
    // MySQL no admite `path` en filtros JSON desde Prisma; `array_contains`
    // comprueba la pertenencia al array JSON almacenado.
    if (filtros.nivelId) where.audienciaNiveles = { array_contains: filtros.nivelId }
    if (filtros.gradoId) where.audienciaGrados = { array_contains: filtros.gradoId }
    if (filtros.seccionId) where.audienciaSecciones = { array_contains: filtros.seccionId }
    if (filtros.rol) where.audienciaRoles = { array_contains: filtros.rol }
    if (filtros.desde || filtros.hasta) {
      where.publicadoEn = {}
      if (filtros.desde) where.publicadoEn.gte = new Date(filtros.desde)
      if (filtros.hasta) where.publicadoEn.lte = new Date(filtros.hasta)
    }

    return {
      where,
      auditarAcceso: esSA, // Solo SuperAdmin deja registro de acceso
    }
  }

  // Para Docente, Apoderado y Alumno: resolver vínculos y construir where
  const vinculos = await resolverVinculosActor(actor, prisma)

  const where: Prisma.AnuncioWhereInput = {
    deletedAt: null,
    institucionId: actor.institucionId,
    // Los roles no administrativos solo ven anuncios publicados (RF-COM-003).
    estado: 'PUBLICADO',
  }

  if (filtros.tipo) where.tipo = filtros.tipo
  if (filtros.desde || filtros.hasta) {
    where.publicadoEn = {}
    if (filtros.desde) where.publicadoEn.gte = new Date(filtros.desde)
    if (filtros.hasta) where.publicadoEn.lte = new Date(filtros.hasta)
  }

  // Construir condición de audiencia según rol
  const condicionesAudiencia: Prisma.AnuncioWhereInput[] = []

  if (esDO) {
    // Docente: ve institucionales + secciones donde es tutor + secciones asignadas
    condicionesAudiencia.push({ tipo: 'INSTITUCIONAL' })
    for (const seccionId of vinculos.seccionIds) {
      condicionesAudiencia.push({
        tipo: 'SECCION',
        audienciaSecciones: { array_contains: seccionId },
      })
    }
  } else if (esPA) {
    // Apoderado: ve anuncios dirigidos a su rol o al nivel/grado/sección de sus alumnos
    condicionesAudiencia.push(
      { tipo: 'INSTITUCIONAL', audienciaRoles: { array_contains: 'APODERADO' } },
      { tipo: 'INSTITUCIONAL', audienciaRoles: { array_contains: 'ALUMNO' } },
    )
    for (const nivelId of vinculos.nivelIds) {
      condicionesAudiencia.push({
        tipo: 'INSTITUCIONAL',
        audienciaNiveles: { array_contains: nivelId },
      })
    }
    for (const gradoId of vinculos.gradoIds) {
      condicionesAudiencia.push({
        tipo: 'INSTITUCIONAL',
        audienciaGrados: { array_contains: gradoId },
      })
    }
    for (const seccionId of vinculos.seccionIds) {
      condicionesAudiencia.push(
        { tipo: 'INSTITUCIONAL', audienciaSecciones: { array_contains: seccionId } },
        { tipo: 'SECCION', audienciaSecciones: { array_contains: seccionId } },
      )
    }
  } else if (esAL) {
    // Alumno: ve anuncios dirigidos a su sección/grado/nivel/rol ALUMNO
    condicionesAudiencia.push({
      tipo: 'INSTITUCIONAL',
      audienciaRoles: { array_contains: 'ALUMNO' },
    })
    for (const nivelId of vinculos.nivelIds) {
      condicionesAudiencia.push({
        tipo: 'INSTITUCIONAL',
        audienciaNiveles: { array_contains: nivelId },
      })
    }
    for (const gradoId of vinculos.gradoIds) {
      condicionesAudiencia.push({
        tipo: 'INSTITUCIONAL',
        audienciaGrados: { array_contains: gradoId },
      })
    }
    for (const seccionId of vinculos.seccionIds) {
      condicionesAudiencia.push(
        { tipo: 'INSTITUCIONAL', audienciaSecciones: { array_contains: seccionId } },
        { tipo: 'SECCION', audienciaSecciones: { array_contains: seccionId } },
      )
    }
  }

  // Aplicar filtros de audiencia adicionales si se proporcionan (refinan el alcance)
  if (filtros.nivelId) where.audienciaNiveles = { array_contains: filtros.nivelId }
  if (filtros.gradoId) where.audienciaGrados = { array_contains: filtros.gradoId }
  if (filtros.seccionId) where.audienciaSecciones = { array_contains: filtros.seccionId }
  if (filtros.rol) where.audienciaRoles = { array_contains: filtros.rol }

  // Combinar alcance base + condiciones de audiencia por rol
  if (condicionesAudiencia.length > 0) {
    where.OR = condicionesAudiencia
  } else {
    // Sin vínculos ni rol reconocido no hay anuncios visibles.
    where.id = { in: [] }
  }

  return {
    where,
    auditarAcceso: false, // Docente/Apoderado/Alumno no dejan registro de acceso
  }
}

/**
 * Resuelve los IDs de secciones, grados, niveles y alumnos vinculados al actor.
 */
async function resolverVinculosActor(
  actor: ActorAcademico,
  prisma: PrismaClient,
): Promise<VinculosActor> {
  const seccionIds = new Set<string>()
  const gradoIds = new Set<string>()
  const nivelIds = new Set<string>()
  const alumnoIds = new Set<string>()

  if (actor.roles.includes('DOCENTE')) {
    // Docente: secciones donde es tutor + secciones de sus asignaciones
    const asignaciones = await prisma.asignacionDocente.findMany({
      where: {
        docente: { persona: { usuario: { id: actor.id } } },
        anio: { estado: 'ACTIVO' },
      },
      select: {
        seccionId: true,
        seccion: { select: { gradoId: true, grado: { select: { nivelId: true } } } },
        esTutor: true,
      },
    })

    for (const a of asignaciones) {
      seccionIds.add(a.seccionId)
      gradoIds.add(a.seccion.gradoId)
      nivelIds.add(a.seccion.grado.nivelId)
    }
  }

  if (actor.roles.includes('APODERADO')) {
    // Apoderado: secciones de sus alumnos con matrícula APROBADA en año ACTIVO
    const apoderado = await prisma.apoderado.findFirst({
      where: { persona: { usuario: { id: actor.id } } },
      select: { id: true },
    })

    if (apoderado) {
      const vinculaciones = await prisma.apoderadoAlumno.findMany({
        where: { apoderadoId: apoderado.id, esPrincipal: true },
        select: { alumnoId: true },
      })

      const alumnoIdsArray = vinculaciones.map((v) => v.alumnoId)
      alumnoIdsArray.forEach((id) => alumnoIds.add(id))

      const matriculas = await prisma.matricula.findMany({
        where: {
          alumnoId: { in: alumnoIdsArray },
          estado: 'APROBADA',
          anio: { estado: 'ACTIVO' },
        },
        select: { seccionId: true, seccion: { select: { gradoId: true, grado: { select: { nivelId: true } } } } },
      })

      for (const m of matriculas) {
        seccionIds.add(m.seccionId)
        gradoIds.add(m.seccion.gradoId)
        nivelIds.add(m.seccion.grado.nivelId)
      }
    }
  }

  if (actor.roles.includes('ALUMNO')) {
    // Alumno: su propia sección actual
    const alumno = await prisma.alumno.findFirst({
      where: { persona: { usuario: { id: actor.id } } },
      select: { id: true },
    })

    if (alumno) {
      alumnoIds.add(alumno.id)

      const matricula = await prisma.matricula.findFirst({
        where: {
          alumnoId: alumno.id,
          estado: 'APROBADA',
          anio: { estado: 'ACTIVO' },
        },
        select: { seccionId: true, seccion: { select: { gradoId: true, grado: { select: { nivelId: true } } } } },
      })

      if (matricula) {
        seccionIds.add(matricula.seccionId)
        gradoIds.add(matricula.seccion.gradoId)
        nivelIds.add(matricula.seccion.grado.nivelId)
      }
    }
  }

  return {
    seccionIds: Array.from(seccionIds),
    gradoIds: Array.from(gradoIds),
    nivelIds: Array.from(nivelIds),
    alumnoIds: Array.from(alumnoIds),
  }
}