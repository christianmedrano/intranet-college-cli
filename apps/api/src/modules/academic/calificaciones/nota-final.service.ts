import type {
  ActualizarNotaFinalInput,
  CrearNotaFinalInput,
  NotaFinalResponse,
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
import { findCursoPorId } from '../../core/estructura/curso.repository.js'
import { institucionActual } from '../../core/estructura/institucion-actual.js'
import { findAlumnoPorId } from '../../core/personas/alumno.repository.js'
import {
  assertDocenteDeCursoSeccion,
  assertPermiso,
  resolverSeccionDeAlumnoEnAnio,
  type ActorAcademico,
} from '../scope.js'
import { findPeriodoParaCalificar } from './calificacion.repository.js'
import {
  createNotaFinal,
  findNotaFinalPorId,
  updateNotaFinal,
} from './nota-final.repository.js'

const MENSAJE_DUPLICADO =
  'El alumno ya tiene una nota final para ese curso y período.'

const MENSAJE_PERIODO_CERRADO =
  'El período está cerrado; solo el Director puede corregir con motivo.'

const MENSAJE_MOTIVO = 'motivo: es obligatorio para corregir tras el cierre'

/**
 * Registra la nota final manual de un alumno en un curso y período
 * (RF-ACAD-002).
 *
 * El valor se guarda exactamente como se envía: no se calcula, promedia ni
 * deriva de las calificaciones parciales (RN-ACAD-004). Se validan el permiso,
 * el estado del período, la matrícula `APROBADA` y la asignación docente.
 *
 * @param input Datos validados por Zod.
 * @param actor Usuario autenticado con sus roles.
 * @param contexto IP y user-agent para la auditoría.
 * @param prisma Cliente inyectable para las pruebas.
 * @throws AppError `FORBIDDEN`, `NOT_FOUND`, `CONFLICT` o `VALIDATION_ERROR`.
 */
export async function crearNotaFinal(
  input: CrearNotaFinalInput,
  actor: ActorAcademico,
  contexto: ContextoAuditoria = {},
  prisma: PrismaClient = getPrisma(),
): Promise<NotaFinalResponse> {
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
      const fila = await createNotaFinal(tx, {
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
        entidad: 'NOTA_FINAL_PERIODO',
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
 * Edita la nota final mientras el período está abierto (RF-ACAD-002).
 *
 * Con el período `CERRADO`, solo un actor con `academic.calificaciones.corregir`
 * puede modificarla y debe enviar `motivo`. Se auditan el valor anterior, el
 * nuevo y el motivo (RN-ACAD-005, RN-ACAD-006).
 *
 * @param id Nota final a actualizar.
 * @param input Campos a cambiar y, si corresponde, el motivo.
 * @param actor Usuario autenticado con sus roles.
 * @param contexto IP y user-agent para la auditoría.
 * @param prisma Cliente inyectable para las pruebas.
 * @throws AppError `NOT_FOUND`, `CONFLICT`, `FORBIDDEN` o `VALIDATION_ERROR`.
 */
export async function actualizarNotaFinal(
  id: string,
  input: ActualizarNotaFinalInput,
  actor: ActorAcademico,
  contexto: ContextoAuditoria = {},
  prisma: PrismaClient = getPrisma(),
): Promise<NotaFinalResponse> {
  const institucion = await institucionActual(prisma)
  const actual = await findNotaFinalPorId(prisma, id, institucion.id)

  if (!actual) {
    throw new AppError('NOT_FOUND', 'La nota final no existe.')
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
    const fila = await updateNotaFinal(tx, {
      id,
      valor: input.valor,
      observacion: input.observacion,
      updatedBy: actor.id,
    })

    await registrarAuditoria(tx, {
      usuarioId: actor.id,
      accion: 'ACTUALIZAR',
      entidad: 'NOTA_FINAL_PERIODO',
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
