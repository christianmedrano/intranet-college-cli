import type {
  ActualizarPeriodoAcademicoInput,
  CrearPeriodoAcademicoInput,
  Paginated,
  PaginationInput,
  PeriodoAcademicoResponse,
} from '@intranet/shared'
import { getPrisma } from '../../../core/db.js'
import { AppError } from '../../../core/errors.js'
import { esConflictoDeUnicidad } from '../../../core/prisma-errors.js'
import type { PrismaClient } from '../../../generated/prisma/client.js'
import { findAnioAcademicoPorId } from './anio-academico.repository.js'
import { assertRangoDeFechas } from './fechas.js'
import {
  cerrarPeriodoAcademicoRecord,
  countPeriodosAcademicos,
  createPeriodoAcademico,
  findPeriodoAcademicoPorId,
  findPeriodosAcademicos,
  updatePeriodoAcademico,
} from './periodo-academico.repository.js'

/** Comprueba que el año exista y esté vigente (sin borrado lógico). */
async function assertAnioVigente(
  anioId: string,
  prisma: PrismaClient,
): Promise<void> {
  const anio = await findAnioAcademicoPorId(prisma, anioId)

  if (!anio) {
    throw new AppError('NOT_FOUND', 'El año académico no existe.')
  }
}

/**
 * Lista los períodos de un año, ordenados por `orden` (RF-CORE-009).
 *
 * @param anioId Año al que pertenecen los períodos.
 * @param paginacion Página y tamaño ya validados por Zod.
 * @param prisma Cliente inyectable para las pruebas.
 * @throws AppError `NOT_FOUND` si el año no existe o fue borrado lógicamente.
 */
export async function listarPeriodosAcademicos(
  anioId: string,
  paginacion: PaginationInput,
  prisma: PrismaClient = getPrisma(),
): Promise<Paginated<PeriodoAcademicoResponse>> {
  await assertAnioVigente(anioId, prisma)

  const total = await countPeriodosAcademicos(prisma, anioId)
  const data = await findPeriodosAcademicos(prisma, anioId, paginacion)

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
 * Crea un período académico (RF-CORE-009).
 *
 * No impone una cantidad fija: el año puede tener 3, 4 o cualquier N períodos
 * (RN-CORE-003). La unicidad de nombre y orden la garantiza el modelo.
 *
 * @param anioId Año al que pertenece el período.
 * @param input Datos validados por Zod.
 * @param usuarioId Usuario que crea el registro.
 * @param prisma Cliente inyectable para las pruebas.
 * @throws AppError `NOT_FOUND` si el año no existe; `CONFLICT` si nombre u
 * orden se repiten; `VALIDATION_ERROR` si las fechas están invertidas.
 */
export async function crearPeriodoAcademico(
  anioId: string,
  input: CrearPeriodoAcademicoInput,
  usuarioId: string,
  prisma: PrismaClient = getPrisma(),
): Promise<PeriodoAcademicoResponse> {
  await assertAnioVigente(anioId, prisma)

  assertRangoDeFechas(input.fechaInicio, input.fechaFin)

  try {
    return await createPeriodoAcademico(prisma, {
      anioId,
      nombre: input.nombre,
      orden: input.orden,
      fechaInicio: input.fechaInicio,
      fechaFin: input.fechaFin,
      createdBy: usuarioId,
    })
  } catch (error) {
    if (esConflictoDeUnicidad(error)) {
      throw new AppError(
        'CONFLICT',
        'Ya existe un período con ese nombre u orden en el año.',
      )
    }

    throw error
  }
}

/**
 * Actualiza parcialmente un período (RF-CORE-009).
 *
 * Un período `CERRADO` no se edita: el cierre es el punto de no retorno que
 * protege las calificaciones ya registradas (RN-CORE-004).
 *
 * @param id Período a editar.
 * @param input Campos validados por Zod.
 * @param usuarioId Usuario que edita.
 * @param prisma Cliente inyectable para las pruebas.
 * @throws AppError `NOT_FOUND` si no existe; `CONFLICT` si está cerrado o si
 * nombre/orden chocan con otro período; `VALIDATION_ERROR` por rango invertido.
 */
export async function actualizarPeriodoAcademico(
  id: string,
  input: ActualizarPeriodoAcademicoInput,
  usuarioId: string,
  prisma: PrismaClient = getPrisma(),
): Promise<PeriodoAcademicoResponse> {
  const actual = await findPeriodoAcademicoPorId(prisma, id)

  if (!actual) {
    throw new AppError('NOT_FOUND', 'El período académico no existe.')
  }

  if (actual.estado === 'CERRADO') {
    throw new AppError(
      'CONFLICT',
      'El período está cerrado y no puede editarse.',
    )
  }

  assertRangoDeFechas(
    input.fechaInicio ?? actual.fechaInicio,
    input.fechaFin ?? actual.fechaFin,
  )

  try {
    return await updatePeriodoAcademico(prisma, id, {
      ...input,
      updatedBy: usuarioId,
    })
  } catch (error) {
    if (esConflictoDeUnicidad(error)) {
      throw new AppError(
        'CONFLICT',
        'Ya existe un período con ese nombre u orden en el año.',
      )
    }

    throw error
  }
}

/**
 * Cierra un período académico (RF-CORE-009, RN-CORE-004).
 *
 * Es idempotente: cerrar un período ya cerrado devuelve `200` sin reescribir
 * `updatedBy`.
 *
 * @param id Período a cerrar.
 * @param usuarioId Usuario que cierra.
 * @param prisma Cliente inyectable para las pruebas.
 * @throws AppError `NOT_FOUND` si no existe.
 */
export async function cerrarPeriodoAcademico(
  id: string,
  usuarioId: string,
  prisma: PrismaClient = getPrisma(),
): Promise<PeriodoAcademicoResponse> {
  const actual = await findPeriodoAcademicoPorId(prisma, id)

  if (!actual) {
    throw new AppError('NOT_FOUND', 'El período académico no existe.')
  }

  if (actual.estado === 'CERRADO') {
    return actual
  }

  return cerrarPeriodoAcademicoRecord(prisma, id, usuarioId)
}
