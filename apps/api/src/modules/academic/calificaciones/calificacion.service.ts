import type {
  ActualizarCalificacionInput,
  CalificacionResponse,
  CrearCalificacionInput,
  Paginated,
  PaginationInput,
  ResumenCalificacionesResponse,
} from '@intranet/shared'
import {
  registrarAuditoria,
  type ContextoAuditoria,
} from '../../../core/audit.js'
import { getPrisma } from '../../../core/db.js'
import { AppError } from '../../../core/errors.js'
import { esConflictoDeUnicidad } from '../../../core/prisma-errors.js'
import { hasPermission } from '../../../core/rbac.js'
import type { PrismaClient } from '../../../generated/prisma/client.js'
import { findAlumnoPorId } from '../../core/personas/alumno.repository.js'
import { findCursoPorId } from '../../core/estructura/curso.repository.js'
import { institucionActual } from '../../core/estructura/institucion-actual.js'
import {
  assertDocenteDeCursoSeccion,
  assertPermiso,
  construirAlcanceCalificaciones,
  resolverSeccionDeAlumnoEnAnio,
  type ActorAcademico,
  type FiltrosConsultaCalificaciones,
} from '../scope.js'
import {
  countCalificaciones,
  countRegistrosDelPeriodo,
  createCalificacion,
  findCalificacionPorId,
  findCalificaciones,
  findPeriodoParaCalificar,
  updateCalificacion,
} from './calificacion.repository.js'
import { auditarAccesoAcademico } from '../consulta-audit.js'

const MENSAJE_DUPLICADO =
  'El alumno ya tiene una calificación para ese curso y período.'

const MENSAJE_PERIODO_CERRADO =
  'El período está cerrado; solo el Director puede corregir con motivo.'

const MENSAJE_MOTIVO = 'motivo: es obligatorio para corregir tras el cierre'

/**
 * Indica si un período tiene calificaciones o notas finales (RF-ACAD-012).
 *
 * `core` consume este resumen para bloquear el borrado de un año con notas.
 * Cuenta solo registros vigentes: los borrados lógicamente no bloquean.
 *
 * @param periodoId Período consultado.
 * @param actor Usuario autenticado con sus roles.
 * @param prisma Cliente inyectable para las pruebas.
 * @throws AppError `FORBIDDEN` sin `academic.calificaciones.leer`; `NOT_FOUND`
 * si el período no existe o es de otra institución.
 */
export async function resumenCalificacionesPeriodo(
  periodoId: string,
  actor: ActorAcademico,
  prisma: PrismaClient = getPrisma(),
): Promise<ResumenCalificacionesResponse> {
  assertPermiso(actor, 'academic.calificaciones.leer')

  const institucion = await institucionActual(prisma)
  const periodo = await findPeriodoParaCalificar(
    prisma,
    periodoId,
    institucion.id,
  )

  if (!periodo) {
    throw new AppError('NOT_FOUND', 'El período no existe.')
  }

  const conteo = await countRegistrosDelPeriodo(prisma, periodoId)

  return {
    ...conteo,
    tieneCalificaciones:
      conteo.totalCalificaciones > 0 || conteo.totalNotasFinales > 0,
  }
}

/**
 * Lista las calificaciones de un período con el alcance del solicitante
 * (RF-ACAD-003).
 *
 * El Director ve todo el período; el SuperAdmin también, y su acceso queda
 * auditado; el docente solo sus cursos y secciones; el apoderado, sus alumnos
 * vinculados; el alumno, lo propio.
 *
 * @param periodoId Período consultado.
 * @param filtros Curso y/o sección opcionales.
 * @param paginacion Página y tamaño ya validados por Zod.
 * @param actor Usuario autenticado con sus roles.
 * @param contexto IP y user-agent para la auditoría.
 * @param prisma Cliente inyectable para las pruebas.
 * @throws AppError `FORBIDDEN` si un filtro del docente está fuera de alcance;
 * `NOT_FOUND` si el período no existe.
 */
export async function listarCalificaciones(
  periodoId: string,
  filtros: FiltrosConsultaCalificaciones,
  paginacion: PaginationInput,
  actor: ActorAcademico,
  contexto: ContextoAuditoria = {},
  prisma: PrismaClient = getPrisma(),
): Promise<Paginated<CalificacionResponse>> {
  assertPermiso(actor, 'academic.calificaciones.leer')

  const institucion = await institucionActual(prisma)
  const periodo = await findPeriodoParaCalificar(
    prisma,
    periodoId,
    institucion.id,
  )

  if (!periodo) {
    throw new AppError('NOT_FOUND', 'El período no existe.')
  }

  const { where, auditarAcceso } = await construirAlcanceCalificaciones(
    actor,
    periodoId,
    periodo.anioId,
    filtros,
    prisma,
  )

  const total = await countCalificaciones(prisma, where)
  const data = await findCalificaciones(prisma, where, paginacion)

  if (auditarAcceso) {
    await auditarAccesoAcademico(
      prisma,
      actor,
      'CALIFICACION',
      { entidadId: periodoId, datos: { periodoId } },
      contexto,
    )
  }

  return {
    data,
    meta: {
      page: paginacion.page,
      pageSize: paginacion.pageSize,
      total,
    },
  }
}

/**
 * Registra una calificación literal de un alumno (RF-ACAD-001).
 *
 * Valida el permiso, que el período no esté cerrado, que el alumno tenga
 * matrícula `APROBADA` y que el docente esté asignado al curso y sección
 * (RN-ACAD-005 a RN-ACAD-008). La calificación y su auditoría se guardan en la
 * misma transacción.
 *
 * @param input Datos validados por Zod.
 * @param actor Usuario autenticado con sus roles.
 * @param contexto IP y user-agent para la auditoría.
 * @param prisma Cliente inyectable para las pruebas.
 * @throws AppError `FORBIDDEN`, `NOT_FOUND`, `CONFLICT` o `VALIDATION_ERROR`
 * según la validación que falle.
 */
export async function crearCalificacion(
  input: CrearCalificacionInput,
  actor: ActorAcademico,
  contexto: ContextoAuditoria = {},
  prisma: PrismaClient = getPrisma(),
): Promise<CalificacionResponse> {
  assertPermiso(actor, 'academic.calificaciones.gestionar')

  const institucion = await institucionActual(prisma)
  const periodo = await findPeriodoParaCalificar(
    prisma,
    input.periodoId,
    institucion.id,
  )

  if (!periodo) {
    throw new AppError('NOT_FOUND', 'El período no existe.')
  }

  if (periodo.estado === 'CERRADO') {
    throw new AppError('CONFLICT', MENSAJE_PERIODO_CERRADO)
  }

  if (!(await findAlumnoPorId(prisma, input.alumnoId))) {
    throw new AppError('NOT_FOUND', 'El alumno no existe.')
  }

  if (!(await findCursoPorId(prisma, input.cursoId, institucion.id))) {
    throw new AppError('NOT_FOUND', 'El curso no existe.')
  }

  const seccionId = await resolverSeccionDeAlumnoEnAnio(
    input.alumnoId,
    periodo.anioId,
    prisma,
  )

  await assertDocenteDeCursoSeccion(
    actor,
    input.cursoId,
    seccionId,
    periodo.anioId,
    prisma,
  )

  try {
    return await prisma.$transaction(async (tx) => {
      const fila = await createCalificacion(tx, {
        alumnoId: input.alumnoId,
        cursoId: input.cursoId,
        periodoId: input.periodoId,
        valor: input.valor,
        observacion: input.observacion,
        createdBy: actor.id,
      })

      await registrarAuditoria(tx, {
        usuarioId: actor.id,
        accion: 'CREAR',
        entidad: 'CALIFICACION',
        entidadId: fila.id,
        datos: {
          alumnoId: fila.alumnoId,
          cursoId: fila.cursoId,
          periodoId: fila.periodoId,
          valor: fila.valor,
        },
        ...contexto,
      })

      return fila
    })
  } catch (error) {
    if (esConflictoDeUnicidad(error)) {
      throw new AppError('CONFLICT', MENSAJE_DUPLICADO)
    }

    throw error
  }
}

/**
 * Edita una calificación mientras el período está abierto (RF-ACAD-001).
 *
 * Con el período `CERRADO`, solo un actor con `academic.calificaciones.corregir`
 * puede cambiarla y debe enviar `motivo`; se auditan el valor anterior, el nuevo
 * y el motivo (RN-ACAD-005, RN-ACAD-006).
 *
 * @param id Calificación a actualizar.
 * @param input Campos a cambiar y, si corresponde, el motivo.
 * @param actor Usuario autenticado con sus roles.
 * @param contexto IP y user-agent para la auditoría.
 * @param prisma Cliente inyectable para las pruebas.
 * @throws AppError `NOT_FOUND`, `CONFLICT`, `FORBIDDEN` o `VALIDATION_ERROR`.
 */
export async function actualizarCalificacion(
  id: string,
  input: ActualizarCalificacionInput,
  actor: ActorAcademico,
  contexto: ContextoAuditoria = {},
  prisma: PrismaClient = getPrisma(),
): Promise<CalificacionResponse> {
  const institucion = await institucionActual(prisma)
  const actual = await findCalificacionPorId(prisma, id, institucion.id)

  if (!actual) {
    throw new AppError('NOT_FOUND', 'La calificación no existe.')
  }

  const periodo = await findPeriodoParaCalificar(
    prisma,
    actual.periodoId,
    institucion.id,
  )

  if (!periodo) {
    throw new AppError('NOT_FOUND', 'El período no existe.')
  }

  if (periodo.estado === 'CERRADO') {
    if (!hasPermission(actor.roles, 'academic.calificaciones.corregir')) {
      throw new AppError('CONFLICT', MENSAJE_PERIODO_CERRADO)
    }

    if (!input.motivo?.trim()) {
      throw new AppError('VALIDATION_ERROR', undefined, [MENSAJE_MOTIVO])
    }
  } else {
    assertPermiso(actor, 'academic.calificaciones.gestionar')

    const seccionId = await resolverSeccionDeAlumnoEnAnio(
      actual.alumnoId,
      periodo.anioId,
      prisma,
    )

    await assertDocenteDeCursoSeccion(
      actor,
      actual.cursoId,
      seccionId,
      periodo.anioId,
      prisma,
    )
  }

  return prisma.$transaction(async (tx) => {
    const fila = await updateCalificacion(tx, {
      id,
      valor: input.valor,
      observacion: input.observacion,
      updatedBy: actor.id,
    })

    await registrarAuditoria(tx, {
      usuarioId: actor.id,
      accion: 'ACTUALIZAR',
      entidad: 'CALIFICACION',
      entidadId: fila.id,
      datos: {
        ...(input.valor !== undefined
          ? { valor: { anterior: actual.valor, nuevo: input.valor } }
          : {}),
        ...(input.observacion !== undefined
          ? {
              observacion: {
                anterior: actual.observacion,
                nuevo: input.observacion,
              },
            }
          : {}),
        ...(input.motivo ? { motivo: input.motivo } : {}),
      },
      ...contexto,
    })

    return fila
  })
}
