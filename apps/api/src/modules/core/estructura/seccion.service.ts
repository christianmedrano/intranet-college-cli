import type {
  ActualizarSeccionInput,
  CrearSeccionInput,
  Paginated,
  PaginationInput,
  SeccionResponse,
} from '@intranet/shared'
import { getPrisma } from '../../../core/db.js'
import { AppError } from '../../../core/errors.js'
import { esConflictoDeUnicidad } from '../../../core/prisma-errors.js'
import type { PrismaClient } from '../../../generated/prisma/client.js'
import { findAnioAcademicoPorId } from './anio-academico.repository.js'
import { findGradoPorId } from './grado.repository.js'
import { institucionActual } from './institucion-actual.js'
import {
  countSecciones,
  createSeccion,
  findSeccionPorId,
  findSecciones,
  updateSeccion,
} from './seccion.repository.js'

/** Mensaje único para la violación de `(gradoId, anioId, nombre)`. */
const MENSAJE_CONFLICTO =
  'Ya existe una sección con ese nombre en el grado y año.'

/**
 * Comprueba que el grado exista, esté vigente y pertenezca a la institución.
 *
 * @throws AppError `NOT_FOUND` si no cumple alguna condición.
 */
async function assertGradoVigente(
  gradoId: string,
  institucionId: string,
  prisma: PrismaClient,
): Promise<void> {
  const grado = await findGradoPorId(prisma, gradoId, institucionId)

  if (!grado) {
    throw new AppError('NOT_FOUND', 'El grado no existe.')
  }
}

/**
 * Comprueba que el año exista, esté vigente y pertenezca a la institución.
 *
 * @throws AppError `NOT_FOUND` si no cumple alguna condición.
 */
async function assertAnioVigente(
  anioId: string,
  institucionId: string,
  prisma: PrismaClient,
): Promise<void> {
  const anio = await findAnioAcademicoPorId(prisma, anioId)

  if (!anio || anio.institucionId !== institucionId) {
    throw new AppError('NOT_FOUND', 'El año académico no existe.')
  }
}

/**
 * Lista las secciones vigentes, opcionalmente por grado y/o año (RF-CORE-010).
 *
 * @param filtros Grado y/o año; si se envían, deben existir.
 * @param paginacion Página y tamaño ya validados por Zod.
 * @param prisma Cliente inyectable para las pruebas.
 * @throws AppError `NOT_FOUND` si un filtro apunta a un registro inexistente.
 */
export async function listarSecciones(
  filtros: { gradoId?: string; anioId?: string },
  paginacion: PaginationInput,
  prisma: PrismaClient = getPrisma(),
): Promise<Paginated<SeccionResponse>> {
  const institucion = await institucionActual(prisma)

  if (filtros.gradoId !== undefined) {
    await assertGradoVigente(filtros.gradoId, institucion.id, prisma)
  }

  if (filtros.anioId !== undefined) {
    await assertAnioVigente(filtros.anioId, institucion.id, prisma)
  }

  const total = await countSecciones(prisma, institucion.id, filtros)
  const data = await findSecciones(prisma, institucion.id, filtros, paginacion)

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
 * Crea una sección dentro de un grado y año académico (RF-CORE-010).
 *
 * @param input Datos validados por Zod.
 * @param usuarioId Usuario que crea el registro.
 * @param prisma Cliente inyectable para las pruebas.
 * @throws AppError `NOT_FOUND` si el grado o el año no existen; `CONFLICT` si
 * el nombre se repite para el mismo grado y año.
 */
export async function crearSeccion(
  input: CrearSeccionInput,
  usuarioId: string,
  prisma: PrismaClient = getPrisma(),
): Promise<SeccionResponse> {
  const institucion = await institucionActual(prisma)

  await assertGradoVigente(input.gradoId, institucion.id, prisma)
  await assertAnioVigente(input.anioId, institucion.id, prisma)

  try {
    return await createSeccion(prisma, {
      gradoId: input.gradoId,
      anioId: input.anioId,
      nombre: input.nombre,
      capacidad: input.capacidad,
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
 * Actualiza parcialmente una sección (RF-CORE-010).
 *
 * No permite moverla de grado ni de año: ambos quedan fijos desde la creación.
 * Enviar `capacidad: null` vacía el aforo.
 *
 * @param id Sección a editar.
 * @param input Campos validados por Zod.
 * @param usuarioId Usuario que edita el registro.
 * @param prisma Cliente inyectable para las pruebas.
 * @throws AppError `NOT_FOUND` si no existe; `CONFLICT` si el nombre choca.
 */
export async function actualizarSeccion(
  id: string,
  input: ActualizarSeccionInput,
  usuarioId: string,
  prisma: PrismaClient = getPrisma(),
): Promise<SeccionResponse> {
  const institucion = await institucionActual(prisma)
  const actual = await findSeccionPorId(prisma, id, institucion.id)

  if (!actual) {
    throw new AppError('NOT_FOUND', 'La sección no existe.')
  }

  try {
    return await updateSeccion(prisma, id, {
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
