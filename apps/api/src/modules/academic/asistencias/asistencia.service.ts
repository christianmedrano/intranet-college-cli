import type {
  AsistenciaResponse,
  CorregirAsistenciaInput,
  Paginated,
  PaginationInput,
  RegistrarAsistenciaLoteInput,
} from '@intranet/shared'
import {
  registrarAuditoria,
  type ContextoAuditoria,
} from '../../../core/audit.js'
import { getPrisma } from '../../../core/db.js'
import { AppError } from '../../../core/errors.js'
import { esConflictoDeUnicidad } from '../../../core/prisma-errors.js'
import type { PrismaClient } from '../../../generated/prisma/client.js'
import {
  aFechaUTC,
  fechaEscolarHoy,
} from '../../core/estructura/fechas.js'
import { institucionActual } from '../../core/estructura/institucion-actual.js'
import { auditarAccesoAcademico } from '../consulta-audit.js'
import {
  assertDocenteDeSeccion,
  assertPermiso,
  type ActorAcademico,
} from '../scope.js'
import {
  countAsistencias,
  createAsistencias,
  findAlumnosMatriculados,
  findAsistencias,
  findAsistenciaPorId,
  findMatriculaAprobadaPorFecha,
  findSeccionParaAsistencia,
  updateAsistencia,
} from './asistencia.repository.js'
import {
  construirAlcanceAsistencias,
  type FiltrosConsultaAsistencias,
} from './asistencia.scope.js'

const MENSAJE_DUPLICADO =
  'El alumno ya tiene asistencia registrada en esa fecha.'

const MENSAJE_MATRICULA =
  'Uno o más alumnos no tienen matrícula aprobada en la sección y año indicados.'

const MENSAJE_FECHA =
  'fecha: debe estar dentro del año académico y no puede ser futura'

const MENSAJE_MOTIVO = 'motivo: es obligatorio para corregir la asistencia'

/**
 * Lista las asistencias con el alcance del solicitante (RF-ACAD-007).
 *
 * El Director y el SuperAdmin ven todo (el segundo con acceso auditado); el
 * docente, solo sus secciones y años; el apoderado, sus alumnos vinculados; el
 * alumno, lo propio. Los filtros de sección, año o alumno ajenos devuelven
 * `403`.
 *
 * @param filtros Filtros validados por Zod.
 * @param paginacion Página y tamaño ya validados por Zod.
 * @param actor Usuario autenticado con sus roles.
 * @param contexto IP y user-agent para la auditoría.
 * @param prisma Cliente inyectable para las pruebas.
 * @throws AppError `FORBIDDEN` si un filtro está fuera de alcance.
 */
export async function listarAsistencias(
  filtros: FiltrosConsultaAsistencias,
  paginacion: PaginationInput,
  actor: ActorAcademico,
  contexto: ContextoAuditoria = {},
  prisma: PrismaClient = getPrisma(),
): Promise<Paginated<AsistenciaResponse>> {
  assertPermiso(actor, 'academic.asistencias.leer')

  const { where, datosAcceso, auditarAcceso } =
    await construirAlcanceAsistencias(actor, filtros, prisma)

  const total = await countAsistencias(prisma, where)
  const data = await findAsistencias(prisma, where, paginacion)

  if (auditarAcceso) {
    await auditarAccesoAcademico(
      prisma,
      actor,
      'ASISTENCIA',
      { entidadId: null, datos: datosAcceso },
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
 * Registra la asistencia diaria de una sección (RF-ACAD-004).
 *
 * El lote es atómico: si un alumno no tiene matrícula `APROBADA` o la fecha es
 * inválida, no se guarda ningún registro. Valida la asignación del docente a la
 * sección y la unicidad por alumno y fecha (RN-ACAD-007 a RN-ACAD-009).
 *
 * @param input Datos validados por Zod.
 * @param actor Usuario autenticado con sus roles.
 * @param contexto IP y user-agent para la auditoría.
 * @param prisma Cliente inyectable para las pruebas.
 * @throws AppError `FORBIDDEN`, `NOT_FOUND`, `CONFLICT` o `VALIDATION_ERROR`.
 */
export async function registrarAsistenciaLote(
  input: RegistrarAsistenciaLoteInput,
  actor: ActorAcademico,
  contexto: ContextoAuditoria = {},
  prisma: PrismaClient = getPrisma(),
): Promise<AsistenciaResponse[]> {
  assertPermiso(actor, 'academic.asistencias.gestionar')

  const institucion = await institucionActual(prisma)
  const seccion = await findSeccionParaAsistencia(
    prisma,
    input.seccionId,
    institucion.id,
  )

  if (!seccion) {
    throw new AppError('NOT_FOUND', 'La sección no existe.')
  }

  if (
    input.fecha > fechaEscolarHoy() ||
    input.fecha < seccion.fechaInicio ||
    input.fecha > seccion.fechaFin
  ) {
    throw new AppError('VALIDATION_ERROR', undefined, [MENSAJE_FECHA])
  }

  await assertDocenteDeSeccion(actor, seccion.id, seccion.anioId, prisma)

  const alumnoIds = input.registros.map((registro) => registro.alumnoId)
  const matriculados = await findAlumnosMatriculados(
    prisma,
    alumnoIds,
    seccion.id,
    seccion.anioId,
  )

  if (matriculados.size !== alumnoIds.length) {
    throw new AppError('CONFLICT', MENSAJE_MATRICULA)
  }

  const fecha = aFechaUTC(input.fecha)

  try {
    return await prisma.$transaction(async (tx) => {
      const filas = await createAsistencias(
        tx,
        input.registros.map((registro) => ({
          alumnoId: registro.alumnoId,
          fecha,
          estado: registro.estado,
          observacion: registro.observacion,
          createdBy: actor.id,
        })),
      )

      for (const fila of filas) {
        await registrarAuditoria(tx, {
          usuarioId: actor.id,
          accion: 'CREAR',
          entidad: 'ASISTENCIA',
          entidadId: fila.id,
          datos: {
            alumnoId: fila.alumnoId,
            fecha: fila.fecha,
            estado: fila.estado,
          },
          ...contexto,
        })
      }

      return filas
    })
  } catch (error) {
    if (esConflictoDeUnicidad(error)) {
      throw new AppError('CONFLICT', MENSAJE_DUPLICADO)
    }

    throw error
  }
}

/**
 * Corrige el estado o la observación de una asistencia (RF-ACAD-005).
 *
 * El motivo es obligatorio y la auditoría guarda el valor anterior, el nuevo,
 * el autor y la fecha (RN-ACAD-010). El docente solo corrige asistencias de sus
 * secciones; el Director no necesita asignación.
 *
 * @param id Asistencia a corregir.
 * @param input Campos a cambiar y motivo.
 * @param actor Usuario autenticado con sus roles.
 * @param contexto IP y user-agent para la auditoría.
 * @param prisma Cliente inyectable para las pruebas.
 * @throws AppError `FORBIDDEN`, `NOT_FOUND`, `CONFLICT` o `VALIDATION_ERROR`.
 */
export async function corregirAsistencia(
  id: string,
  input: CorregirAsistenciaInput,
  actor: ActorAcademico,
  contexto: ContextoAuditoria = {},
  prisma: PrismaClient = getPrisma(),
): Promise<AsistenciaResponse> {
  assertPermiso(actor, 'academic.asistencias.gestionar')

  if (!input.motivo.trim()) {
    throw new AppError('VALIDATION_ERROR', undefined, [MENSAJE_MOTIVO])
  }

  const actual = await findAsistenciaPorId(prisma, id)

  if (!actual) {
    throw new AppError('NOT_FOUND', 'La asistencia no existe.')
  }

  const matricula = await findMatriculaAprobadaPorFecha(
    prisma,
    actual.alumnoId,
    actual.fecha,
  )

  if (!matricula) {
    throw new AppError('CONFLICT', MENSAJE_MATRICULA)
  }

  await assertDocenteDeSeccion(
    actor,
    matricula.seccionId,
    matricula.anioId,
    prisma,
  )

  return prisma.$transaction(async (tx) => {
    const fila = await updateAsistencia(tx, {
      id,
      estado: input.estado,
      observacion: input.observacion,
      updatedBy: actor.id,
    })

    await registrarAuditoria(tx, {
      usuarioId: actor.id,
      accion: 'ACTUALIZAR',
      entidad: 'ASISTENCIA',
      entidadId: fila.id,
      datos: {
        ...(input.estado !== undefined
          ? { estado: { anterior: actual.estado, nuevo: input.estado } }
          : {}),
        ...(input.observacion !== undefined
          ? {
              observacion: {
                anterior: actual.observacion,
                nuevo: input.observacion,
              },
            }
          : {}),
        motivo: input.motivo,
      },
      ...contexto,
    })

    return fila
  })
}
