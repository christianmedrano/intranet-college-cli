import type {
  ActualizarNivelInput,
  CrearNivelInput,
  NivelResponse,
  Paginated,
  PaginationInput,
} from '@intranet/shared'
import { getPrisma } from '../../../core/db.js'
import { AppError } from '../../../core/errors.js'
import { esConflictoDeUnicidad } from '../../../core/prisma-errors.js'
import type { PrismaClient } from '../../../generated/prisma/client.js'
import { institucionActual } from './institucion-actual.js'
import {
  countNiveles,
  createNivel,
  findNivelPorId,
  findNiveles,
  updateNivel,
} from './nivel.repository.js'

/** Mensaje único para la violación de `(institucionId, nombre)`. */
const MENSAJE_CONFLICTO =
  'Ya existe un nivel con ese nombre en la institución.'

/**
 * Lista los niveles vigentes de la institución (RF-CORE-010).
 *
 * @param paginacion Página y tamaño ya validados por Zod.
 * @param prisma Cliente inyectable para las pruebas.
 */
export async function listarNiveles(
  paginacion: PaginationInput,
  prisma: PrismaClient = getPrisma(),
): Promise<Paginated<NivelResponse>> {
  const institucion = await institucionActual(prisma)

  const total = await countNiveles(prisma, institucion.id)
  const data = await findNiveles(prisma, institucion.id, paginacion)

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
 * Crea un nivel educativo dentro de la institución (RF-CORE-010).
 *
 * @param input Datos validados por Zod.
 * @param usuarioId Usuario que crea el registro.
 * @param prisma Cliente inyectable para las pruebas.
 * @throws AppError `CONFLICT` si el nombre ya existe en la institución.
 */
export async function crearNivel(
  input: CrearNivelInput,
  usuarioId: string,
  prisma: PrismaClient = getPrisma(),
): Promise<NivelResponse> {
  const institucion = await institucionActual(prisma)

  try {
    return await createNivel(prisma, {
      institucionId: institucion.id,
      nombre: input.nombre,
      orden: input.orden,
      createdBy: usuarioId,
    })
  } catch (error) {
    if (esConflictoDeUnicidad(error)) {
      throw new AppError('CONFLICT', MENSAJE_CONFLICTO)
    }

    throw error
  }
}

/**
 * Actualiza parcialmente un nivel (RF-CORE-010).
 *
 * @param id Nivel a editar.
 * @param input Campos validados por Zod.
 * @param usuarioId Usuario que edita el registro.
 * @param prisma Cliente inyectable para las pruebas.
 * @throws AppError `NOT_FOUND` si no existe; `CONFLICT` si el nombre choca.
 */
export async function actualizarNivel(
  id: string,
  input: ActualizarNivelInput,
  usuarioId: string,
  prisma: PrismaClient = getPrisma(),
): Promise<NivelResponse> {
  const institucion = await institucionActual(prisma)
  const actual = await findNivelPorId(prisma, id, institucion.id)

  if (!actual) {
    throw new AppError('NOT_FOUND', 'El nivel no existe.')
  }

  try {
    return await updateNivel(prisma, id, {
      ...input,
      updatedBy: usuarioId,
    })
  } catch (error) {
    if (esConflictoDeUnicidad(error)) {
      throw new AppError('CONFLICT', MENSAJE_CONFLICTO)
    }

    throw error
  }
}
