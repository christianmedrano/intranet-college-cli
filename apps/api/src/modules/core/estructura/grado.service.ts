import type {
  ActualizarGradoInput,
  CrearGradoInput,
  GradoResponse,
  Paginated,
  PaginationInput,
} from '@intranet/shared'
import { getPrisma } from '../../../core/db.js'
import { AppError } from '../../../core/errors.js'
import { esConflictoDeUnicidad } from '../../../core/prisma-errors.js'
import type { PrismaClient } from '../../../generated/prisma/client.js'
import { institucionActual } from './institucion-actual.js'
import {
  countGrados,
  createGrado,
  findGradoPorId,
  findGrados,
  updateGrado,
} from './grado.repository.js'
import { findNivelPorId } from './nivel.repository.js'

/** Mensaje único para la violación de `(nivelId, orden)`. */
const MENSAJE_CONFLICTO = 'Ya existe un grado con ese orden en el nivel.'

/**
 * Comprueba que el nivel exista, esté vigente y pertenezca a la institución.
 *
 * @throws AppError `NOT_FOUND` si no cumple alguna condición.
 */
async function assertNivelVigente(
  nivelId: string,
  institucionId: string,
  prisma: PrismaClient,
): Promise<void> {
  const nivel = await findNivelPorId(prisma, nivelId, institucionId)

  if (!nivel) {
    throw new AppError('NOT_FOUND', 'El nivel no existe.')
  }
}

/**
 * Lista los grados vigentes, opcionalmente filtrados por nivel (RF-CORE-010).
 *
 * @param nivelId Filtro opcional; si se envía, el nivel debe existir.
 * @param paginacion Página y tamaño ya validados por Zod.
 * @param prisma Cliente inyectable para las pruebas.
 * @throws AppError `NOT_FOUND` si el `nivelId` no existe en la institución.
 */
export async function listarGrados(
  nivelId: string | undefined,
  paginacion: PaginationInput,
  prisma: PrismaClient = getPrisma(),
): Promise<Paginated<GradoResponse>> {
  const institucion = await institucionActual(prisma)

  if (nivelId !== undefined) {
    await assertNivelVigente(nivelId, institucion.id, prisma)
  }

  const filtros = { nivelId }
  const total = await countGrados(prisma, institucion.id, filtros)
  const data = await findGrados(prisma, institucion.id, filtros, paginacion)

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
 * Crea un grado asociado a un nivel (RF-CORE-010).
 *
 * @param input Datos validados por Zod.
 * @param usuarioId Usuario que crea el registro.
 * @param prisma Cliente inyectable para las pruebas.
 * @throws AppError `NOT_FOUND` si el nivel no existe; `CONFLICT` si el orden
 * ya está ocupado dentro del nivel.
 */
export async function crearGrado(
  input: CrearGradoInput,
  usuarioId: string,
  prisma: PrismaClient = getPrisma(),
): Promise<GradoResponse> {
  const institucion = await institucionActual(prisma)

  await assertNivelVigente(input.nivelId, institucion.id, prisma)

  try {
    return await createGrado(prisma, {
      nivelId: input.nivelId,
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
 * Actualiza parcialmente un grado (RF-CORE-010).
 *
 * No permite mover el grado de nivel: `nivelId` queda fijo desde la creación.
 *
 * @param id Grado a editar.
 * @param input Campos validados por Zod.
 * @param usuarioId Usuario que edita el registro.
 * @param prisma Cliente inyectable para las pruebas.
 * @throws AppError `NOT_FOUND` si no existe; `CONFLICT` si el orden choca.
 */
export async function actualizarGrado(
  id: string,
  input: ActualizarGradoInput,
  usuarioId: string,
  prisma: PrismaClient = getPrisma(),
): Promise<GradoResponse> {
  const institucion = await institucionActual(prisma)
  const actual = await findGradoPorId(prisma, id, institucion.id)

  if (!actual) {
    throw new AppError('NOT_FOUND', 'El grado no existe.')
  }

  try {
    return await updateGrado(prisma, id, {
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
