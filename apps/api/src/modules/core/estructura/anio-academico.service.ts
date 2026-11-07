import type {
  ActualizarAnioAcademicoInput,
  AnioAcademicoResponse,
  CrearAnioAcademicoInput,
  Paginated,
  PaginationInput,
} from '@intranet/shared'
import { getPrisma } from '../../../core/db.js'
import { AppError } from '../../../core/errors.js'
import { esConflictoDeUnicidad } from '../../../core/prisma-errors.js'
import type { PrismaClient } from '../../../generated/prisma/client.js'
import {
  activarAnioAcademicoRecord,
  countAniosAcademicos,
  createAnioAcademico,
  findAnioAcademicoPorId,
  findAniosAcademicos,
  toAnioAcademicoResponse,
  updateAnioAcademico,
} from './anio-academico.repository.js'
import { assertRangoDeFechas } from './fechas.js'
import { institucionActual } from './institucion-actual.js'

/**
 * Lista los años académicos vigentes de la institución (RF-CORE-008).
 *
 * @param paginacion Página y tamaño ya validados por Zod.
 * @param prisma Cliente inyectable para las pruebas.
 */
export async function listarAniosAcademicos(
  paginacion: PaginationInput,
  prisma: PrismaClient = getPrisma(),
): Promise<Paginated<AnioAcademicoResponse>> {
  const institucion = await institucionActual(prisma)

  const total = await countAniosAcademicos(prisma, institucion.id)
  const filas = await findAniosAcademicos(prisma, institucion.id, paginacion)

  return {
    data: filas,
    meta: {
      page: paginacion.page,
      pageSize: paginacion.pageSize,
      total,
    },
  }
}

/**
 * Crea un año académico en estado `PLANIFICADO` (RF-CORE-008).
 *
 * @param input Datos validados por Zod.
 * @param usuarioId Usuario que crea el registro.
 * @param prisma Cliente inyectable para las pruebas.
 * @throws AppError `CONFLICT` si el nombre ya existe en la institución;
 * `VALIDATION_ERROR` si las fechas están invertidas.
 */
export async function crearAnioAcademico(
  input: CrearAnioAcademicoInput,
  usuarioId: string,
  prisma: PrismaClient = getPrisma(),
): Promise<AnioAcademicoResponse> {
  const institucion = await institucionActual(prisma)

  assertRangoDeFechas(input.fechaInicio, input.fechaFin)

  try {
    const fila = await createAnioAcademico(prisma, {
      institucionId: institucion.id,
      nombre: input.nombre,
      fechaInicio: input.fechaInicio,
      fechaFin: input.fechaFin,
      createdBy: usuarioId,
    })

    return toAnioAcademicoResponse(fila)
  } catch (error) {
    if (esConflictoDeUnicidad(error)) {
      throw new AppError(
        'CONFLICT',
        'Ya existe un año académico con ese nombre.',
      )
    }

    throw error
  }
}

/**
 * Actualiza parcialmente un año académico (RF-CORE-008).
 *
 * El rango se valida sobre el resultado combinado, no solo sobre los campos
 * enviados: cambiar únicamente `fechaFin` también puede invertir el rango.
 *
 * @param id Año a editar.
 * @param input Campos validados por Zod.
 * @param usuarioId Usuario que edita el registro.
 * @param prisma Cliente inyectable para las pruebas.
 * @throws AppError `NOT_FOUND` si el año no existe; `CONFLICT` si el nombre
 * choca con otro año; `VALIDATION_ERROR` si el rango queda invertido.
 */
export async function actualizarAnioAcademico(
  id: string,
  input: ActualizarAnioAcademicoInput,
  usuarioId: string,
  prisma: PrismaClient = getPrisma(),
): Promise<AnioAcademicoResponse> {
  const actual = await findAnioAcademicoPorId(prisma, id)

  if (!actual) {
    throw new AppError('NOT_FOUND', 'El año académico no existe.')
  }

  assertRangoDeFechas(
    input.fechaInicio ?? actual.fechaInicio,
    input.fechaFin ?? actual.fechaFin,
  )

  try {
    const fila = await updateAnioAcademico(prisma, id, {
      ...input,
      updatedBy: usuarioId,
    })

    return toAnioAcademicoResponse(fila)
  } catch (error) {
    if (esConflictoDeUnicidad(error)) {
      throw new AppError(
        'CONFLICT',
        'Ya existe un año académico con ese nombre.',
      )
    }

    throw error
  }
}

/**
 * Activa un año académico y cierra el anterior si lo hubiera (RF-CORE-008,
 * RN-CORE-002).
 *
 * Es idempotente: activar el año que ya está activo devuelve `200` sin escribir
 * nada, lo que evita un `updatedBy` engañoso.
 *
 * @param id Año a activar.
 * @param usuarioId Usuario que activa.
 * @param prisma Cliente inyectable para las pruebas.
 * @throws AppError `NOT_FOUND` si el año no existe.
 */
export async function activarAnioAcademico(
  id: string,
  usuarioId: string,
  prisma: PrismaClient = getPrisma(),
): Promise<AnioAcademicoResponse> {
  const actual = await findAnioAcademicoPorId(prisma, id)

  if (!actual) {
    throw new AppError('NOT_FOUND', 'El año académico no existe.')
  }

  if (actual.estado === 'ACTIVO') {
    return toAnioAcademicoResponse(actual)
  }

  return toAnioAcademicoResponse(
    await activarAnioAcademicoRecord(prisma, actual, usuarioId),
  )
}
