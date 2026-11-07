import type {
  ActualizarCursoInput,
  CrearCursoInput,
  CursoResponse,
  Paginated,
  PaginationInput,
} from '@intranet/shared'
import { getPrisma } from '../../../core/db.js'
import { AppError } from '../../../core/errors.js'
import { esConflictoDeUnicidad } from '../../../core/prisma-errors.js'
import type { PrismaClient } from '../../../generated/prisma/client.js'
import {
  countCursos,
  createCurso,
  findCursoPorId,
  findCursos,
  updateCurso,
} from './curso.repository.js'
import { institucionActual } from './institucion-actual.js'
import { findNivelPorId } from './nivel.repository.js'

/** Mensaje único para la violación de `(nivelId, nombre)`. */
const MENSAJE_CONFLICTO = 'Ya existe un curso con ese nombre en el nivel.'

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
 * Lista los cursos vigentes, opcionalmente filtrados por nivel (RF-CORE-011).
 *
 * @param nivelId Filtro opcional; si se envía, el nivel debe existir.
 * @param paginacion Página y tamaño ya validados por Zod.
 * @param prisma Cliente inyectable para las pruebas.
 * @throws AppError `NOT_FOUND` si el `nivelId` no existe en la institución.
 */
export async function listarCursos(
  nivelId: string | undefined,
  paginacion: PaginationInput,
  prisma: PrismaClient = getPrisma(),
): Promise<Paginated<CursoResponse>> {
  const institucion = await institucionActual(prisma)

  if (nivelId !== undefined) {
    await assertNivelVigente(nivelId, institucion.id, prisma)
  }

  const filtros = { nivelId }
  const total = await countCursos(prisma, institucion.id, filtros)
  const data = await findCursos(prisma, institucion.id, filtros, paginacion)

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
 * Crea un curso asociado a un nivel (RF-CORE-011).
 *
 * @param input Datos validados por Zod.
 * @param usuarioId Usuario que crea el registro.
 * @param prisma Cliente inyectable para las pruebas.
 * @throws AppError `NOT_FOUND` si el nivel no existe; `CONFLICT` si el nombre
 * ya existe dentro del nivel.
 */
export async function crearCurso(
  input: CrearCursoInput,
  usuarioId: string,
  prisma: PrismaClient = getPrisma(),
): Promise<CursoResponse> {
  const institucion = await institucionActual(prisma)

  await assertNivelVigente(input.nivelId, institucion.id, prisma)

  try {
    return await createCurso(prisma, {
      nivelId: input.nivelId,
      nombre: input.nombre,
      area: input.area,
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
 * Actualiza parcialmente un curso (RF-CORE-011).
 *
 * No permite moverlo de nivel: `nivelId` queda fijo desde la creación. Enviar
 * `area: null` vacía el área curricular.
 *
 * @param id Curso a editar.
 * @param input Campos validados por Zod.
 * @param usuarioId Usuario que edita el registro.
 * @param prisma Cliente inyectable para las pruebas.
 * @throws AppError `NOT_FOUND` si no existe; `CONFLICT` si el nombre choca.
 */
export async function actualizarCurso(
  id: string,
  input: ActualizarCursoInput,
  usuarioId: string,
  prisma: PrismaClient = getPrisma(),
): Promise<CursoResponse> {
  const institucion = await institucionActual(prisma)
  const actual = await findCursoPorId(prisma, id, institucion.id)

  if (!actual) {
    throw new AppError('NOT_FOUND', 'El curso no existe.')
  }

  try {
    return await updateCurso(prisma, id, {
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
