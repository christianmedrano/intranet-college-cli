import type {
  ActualizarMatriculaInput,
  CrearMatriculaInput,
  MatriculaResponse,
  Paginated,
  PaginationInput,
} from '@intranet/shared'
import {
  registrarAuditoria,
  type ContextoAuditoria,
} from '../../../core/audit.js'
import { getPrisma } from '../../../core/db.js'
import { AppError } from '../../../core/errors.js'
import { esConflictoDeUnicidad } from '../../../core/prisma-errors.js'
import type { PrismaClient } from '../../../generated/prisma/client.js'
import { findAnioAcademicoPorId } from '../estructura/anio-academico.repository.js'
import { institucionActual } from '../estructura/institucion-actual.js'
import { findSeccionPorId } from '../estructura/seccion.repository.js'
import { findAlumnoPorId } from '../personas/alumno.repository.js'
import {
  countApoderadosPrincipales,
  countMatriculas,
  createMatricula,
  findMatriculaPorId,
  findMatriculas,
  updateEstadoMatricula,
  type FiltrosMatricula,
} from './matricula.repository.js'

/** Mensaje único para la violación de `(alumno, año)`. */
const MENSAJE_CONFLICTO = 'El alumno ya tiene una matrícula en ese año.'

/**
 * Lista el historial de matrículas, opcionalmente filtrado (RF-CORE-015).
 *
 * @param filtros Alumno, año y/o estado.
 * @param paginacion Página y tamaño ya validados por Zod.
 * @param prisma Cliente inyectable para las pruebas.
 * @throws AppError `NOT_FOUND` si un filtro apunta a un registro inexistente.
 */
export async function listarMatriculas(
  filtros: FiltrosMatricula,
  paginacion: PaginationInput,
  prisma: PrismaClient = getPrisma(),
): Promise<Paginated<MatriculaResponse>> {
  if (filtros.alumnoId !== undefined) {
    const alumno = await findAlumnoPorId(prisma, filtros.alumnoId)

    if (!alumno) {
      throw new AppError('NOT_FOUND', 'El alumno no existe.')
    }
  }

  if (filtros.anioId !== undefined) {
    const anio = await findAnioAcademicoPorId(prisma, filtros.anioId)

    if (!anio) {
      throw new AppError('NOT_FOUND', 'El año académico no existe.')
    }
  }

  const total = await countMatriculas(prisma, filtros)
  const data = await findMatriculas(prisma, filtros, paginacion)

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
 * Crea una matrícula `SOLICITADA` (RF-CORE-015).
 *
 * @param input Alumno, sección y año validados por Zod.
 * @param usuarioId Usuario que registra la matrícula.
 * @param prisma Cliente inyectable para las pruebas.
 * @throws AppError `NOT_FOUND` si el alumno, la sección o el año no existen;
 * `VALIDATION_ERROR` si la sección no pertenece al año; `CONFLICT` si ya hay
 * una matrícula del alumno en ese año.
 */
export async function crearMatricula(
  input: CrearMatriculaInput,
  usuarioId: string,
  contexto: ContextoAuditoria = {},
  prisma: PrismaClient = getPrisma(),
): Promise<MatriculaResponse> {
  const alumno = await findAlumnoPorId(prisma, input.alumnoId)

  if (!alumno) {
    throw new AppError('NOT_FOUND', 'El alumno no existe.')
  }

  const institucion = await institucionActual(prisma)
  const seccion = await findSeccionPorId(
    prisma,
    input.seccionId,
    institucion.id,
  )

  if (!seccion) {
    throw new AppError('NOT_FOUND', 'La sección no existe.')
  }

  const anio = await findAnioAcademicoPorId(prisma, input.anioId)

  if (!anio || anio.institucionId !== institucion.id) {
    throw new AppError('NOT_FOUND', 'El año académico no existe.')
  }

  if (seccion.anioId !== input.anioId) {
    throw new AppError('VALIDATION_ERROR', undefined, [
      'anioId: la sección no pertenece al año indicado',
    ])
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const creada = await createMatricula(tx, {
        alumnoId: input.alumnoId,
        seccionId: input.seccionId,
        anioId: input.anioId,
        createdBy: usuarioId,
      })

      await registrarAuditoria(tx, {
        usuarioId,
        accion: 'CREAR',
        entidad: 'MATRICULA',
        entidadId: creada.id,
        datos: {
          alumnoId: input.alumnoId,
          seccionId: input.seccionId,
          anioId: input.anioId,
        },
        ...contexto,
      })

      return creada
    })
  } catch (error) {
    if (esConflictoDeUnicidad(error)) {
      throw new AppError('CONFLICT', MENSAJE_CONFLICTO)
    }

    throw error
  }
}

/**
 * Cambia el estado de una matrícula (RF-CORE-015).
 *
 * Transiciones admitidas:
 * - `SOLICITADA → APROBADA`, solo con exactamente un apoderado principal
 *   (RF-CORE-014).
 * - `SOLICITADA → RETIRADA` y `APROBADA → RETIRADA`.
 * - Repetir el estado actual es idempotente.
 *
 * `RETIRADA` es terminal: la matrícula se conserva como historial y no se
 * reabre.
 *
 * @throws AppError `NOT_FOUND` si no existe; `CONFLICT` si la transición no es
 * válida o falta el apoderado principal.
 */
export async function actualizarEstadoMatricula(
  id: string,
  input: ActualizarMatriculaInput,
  usuarioId: string,
  contexto: ContextoAuditoria = {},
  prisma: PrismaClient = getPrisma(),
): Promise<MatriculaResponse> {
  const actual = await findMatriculaPorId(prisma, id)

  if (!actual) {
    throw new AppError('NOT_FOUND', 'La matrícula no existe.')
  }

  if (actual.estado === input.estado) {
    return actual
  }

  if (actual.estado === 'RETIRADA') {
    throw new AppError(
      'CONFLICT',
      'Una matrícula retirada no se puede reabrir.',
    )
  }

  if (input.estado === 'SOLICITADA') {
    throw new AppError(
      'CONFLICT',
      'La matrícula no puede volver al estado SOLICITADA.',
    )
  }

  if (input.estado === 'APROBADA') {
    const principales = await countApoderadosPrincipales(
      prisma,
      actual.alumnoId,
    )

    if (principales !== 1) {
      throw new AppError(
        'CONFLICT',
        'El alumno debe tener exactamente un apoderado principal para aprobar la matrícula.',
      )
    }
  }

  return prisma.$transaction(async (tx) => {
    const actualizada = await updateEstadoMatricula(
      tx,
      id,
      input.estado,
      usuarioId,
    )

    await registrarAuditoria(tx, {
      usuarioId,
      accion: input.estado === 'APROBADA' ? 'APROBAR' : 'RETIRAR',
      entidad: 'MATRICULA',
      entidadId: id,
      datos: { estadoAnterior: actual.estado, estado: input.estado },
      ...contexto,
    })

    return actualizada
  })
}
