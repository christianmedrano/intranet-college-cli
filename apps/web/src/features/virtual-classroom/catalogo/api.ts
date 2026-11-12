import {
  type CursoResponsePayload,
  type PaginatedCursosPayload,
  type SeccionResponsePayload,
  type PaginatedSeccionesPayload,
  type PeriodoAcademicoResponsePayload,
  type PaginatedPeriodosAcademicosPayload,
  paginatedCursosSchema,
  paginatedSeccionesSchema,
  paginatedPeriodosAcademicosSchema,
  cursoResponseSchema,
  seccionResponseSchema,
  periodoAcademicoResponseSchema,
} from '@intranet/shared'
import { apiRequest } from '../../../shared/api/client'

/** Parámetros para listado de cursos. */
export interface ListarCursosParams {
  /** Filtro opcional por nivel. */
  nivelId?: string
  /** Página (1-indexed). */
  page?: number
  /** Tamaño de página (máx 100). */
  pageSize?: number
}

/** Parámetros para listado de secciones. */
export interface ListarSeccionesParams {
  /** Filtro opcional por grado. */
  gradoId?: string
  /** Filtro opcional por año académico. */
  anioId?: string
  /** Página (1-indexed). */
  page?: number
  /** Tamaño de página (máx 100). */
  pageSize?: number
}

/** Parámetros para listado de períodos de un año académico. */
export interface ListarPeriodosParams {
  /** ID del año académico (requerido). */
  anioId: string
  /** Página (1-indexed). */
  page?: number
  /** Tamaño de página (máx 100). */
  pageSize?: number
}

/** Opción simplificada para selectores (id + nombre). */
export interface CatalogoOpcion {
  id: string
  nombre: string
}

/**
 * Convierte un array paginado a opciones de selector.
 */
function aOpciones<T extends { id: string; nombre: string }>(
  items: T[],
): CatalogoOpcion[] {
  return items.map((item) => ({ id: item.id, nombre: item.nombre }))
}

/**
 * Lista cursos para el catálogo (usando pageSize grande para traer todos).
 *
 * @param params Parámetros de filtro y paginación.
 * @returns Array de opciones `{ id, nombre }`.
 */
export async function listarCursosCatalogo(
  params: ListarCursosParams = {},
): Promise<CatalogoOpcion[]> {
  const { nivelId, page = 1, pageSize = 100 } = params
  const query = new URLSearchParams()
  if (nivelId) query.set('nivelId', nivelId)
  query.set('page', String(page))
  query.set('pageSize', String(pageSize))

  const respuesta = await apiRequest<PaginatedCursosPayload>(
    `/api/v1/cursos?${query.toString()}`,
    paginatedCursosSchema,
  )
  return aOpciones(respuesta.data)
}

/**
 * Lista secciones para el catálogo.
 *
 * @param params Parámetros de filtro y paginación.
 * @returns Array de opciones `{ id, nombre }`.
 */
export async function listarSeccionesCatalogo(
  params: ListarSeccionesParams = {},
): Promise<CatalogoOpcion[]> {
  const { gradoId, anioId, page = 1, pageSize = 100 } = params
  const query = new URLSearchParams()
  if (gradoId) query.set('gradoId', gradoId)
  if (anioId) query.set('anioId', anioId)
  query.set('page', String(page))
  query.set('pageSize', String(pageSize))

  const respuesta = await apiRequest<PaginatedSeccionesPayload>(
    `/api/v1/secciones?${query.toString()}`,
    paginatedSeccionesSchema,
  )
  return aOpciones(respuesta.data)
}

/**
 * Lista períodos de un año académico para el catálogo.
 *
 * @param params Parámetros (requiere anioId).
 * @returns Array de opciones `{ id, nombre }`.
 */
export async function listarPeriodosCatalogo(
  params: ListarPeriodosParams,
): Promise<CatalogoOpcion[]> {
  const { anioId, page = 1, pageSize = 100 } = params
  const query = new URLSearchParams()
  query.set('page', String(page))
  query.set('pageSize', String(pageSize))

  const respuesta = await apiRequest<PaginatedPeriodosAcademicosPayload>(
    `/api/v1/anios-academicos/${anioId}/periodos?${query.toString()}`,
    paginatedPeriodosAcademicosSchema,
  )
  return aOpciones(respuesta.data)
}

/**
 * Obtiene el nombre de un curso por ID (para mostrar en tablas).
 */
export async function obtenerNombreCurso(cursoId: string): Promise<string> {
  const respuesta = await apiRequest<CursoResponsePayload>(
    `/api/v1/cursos/${cursoId}`,
    cursoResponseSchema,
  )
  return respuesta.nombre
}

/**
 * Obtiene el nombre de una sección por ID.
 */
export async function obtenerNombreSeccion(seccionId: string): Promise<string> {
  const respuesta = await apiRequest<SeccionResponsePayload>(
    `/api/v1/secciones/${seccionId}`,
    seccionResponseSchema,
  )
  return respuesta.nombre
}

/**
 * Obtiene el nombre de un período por ID.
 */
export async function obtenerNombrePeriodo(
  periodoId: string,
): Promise<string> {
  const respuesta = await apiRequest<PeriodoAcademicoResponsePayload>(
    `/api/v1/periodos/${periodoId}`,
    periodoAcademicoResponseSchema,
  )
  return respuesta.nombre
}