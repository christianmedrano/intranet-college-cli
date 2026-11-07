import type { CursoResponse, PaginationInput } from '@intranet/shared'
import type { PrismaClient } from '../../../generated/prisma/client.js'

const CAMPOS = {
  id: true,
  nivelId: true,
  nombre: true,
  area: true,
  orden: true,
} as const

/**
 * Condición de alcance institucional.
 *
 * `Curso` llega a la institución a través de su nivel, igual que `Grado`.
 */
function alcanceDeInstitucion(institucionId: string) {
  return {
    nivel: { institucionId, deletedAt: null },
  } as const
}

/** Filtros admitidos por el listado de cursos. */
export interface FiltrosCurso {
  nivelId?: string
}

/** Cuenta los cursos vigentes de la institución. */
export async function countCursos(
  prisma: PrismaClient,
  institucionId: string,
  filtros: FiltrosCurso = {},
): Promise<number> {
  return prisma.curso.count({
    where: {
      deletedAt: null,
      ...(filtros.nivelId !== undefined ? { nivelId: filtros.nivelId } : {}),
      ...alcanceDeInstitucion(institucionId),
    },
  })
}

/**
 * Lista los cursos vigentes ordenados por nivel y luego por orden
 * (RF-CORE-011). `id` desempata para una paginación estable.
 */
export async function findCursos(
  prisma: PrismaClient,
  institucionId: string,
  filtros: FiltrosCurso,
  paginacion: PaginationInput,
): Promise<CursoResponse[]> {
  return prisma.curso.findMany({
    where: {
      deletedAt: null,
      ...(filtros.nivelId !== undefined ? { nivelId: filtros.nivelId } : {}),
      ...alcanceDeInstitucion(institucionId),
    },
    orderBy: [{ nivel: { orden: 'asc' } }, { orden: 'asc' }, { id: 'asc' }],
    skip: (paginacion.page - 1) * paginacion.pageSize,
    take: paginacion.pageSize,
    select: CAMPOS,
  })
}

/** Busca un curso vigente de la institución por identificador. */
export async function findCursoPorId(
  prisma: PrismaClient,
  id: string,
  institucionId: string,
): Promise<CursoResponse | null> {
  return prisma.curso.findFirst({
    where: {
      id,
      deletedAt: null,
      ...alcanceDeInstitucion(institucionId),
    },
    select: CAMPOS,
  })
}

export interface CrearCursoData {
  nivelId: string
  nombre: string
  area?: string | null
  orden: number
  createdBy: string
}

/** Crea un curso dentro de un nivel ya validado. */
export async function createCurso(
  prisma: PrismaClient,
  datos: CrearCursoData,
): Promise<CursoResponse> {
  return prisma.curso.create({
    data: {
      nivelId: datos.nivelId,
      nombre: datos.nombre,
      area: datos.area ?? null,
      orden: datos.orden,
      createdBy: datos.createdBy,
    },
    select: CAMPOS,
  })
}

export interface ActualizarCursoData {
  nombre?: string
  area?: string | null
  orden?: number
  updatedBy: string
}

/** Actualiza solo los campos enviados del curso. */
export async function updateCurso(
  prisma: PrismaClient,
  id: string,
  datos: ActualizarCursoData,
): Promise<CursoResponse> {
  return prisma.curso.update({
    where: { id },
    data: {
      ...(datos.nombre !== undefined ? { nombre: datos.nombre } : {}),
      ...(datos.area !== undefined ? { area: datos.area } : {}),
      ...(datos.orden !== undefined ? { orden: datos.orden } : {}),
      updatedBy: datos.updatedBy,
    },
    select: CAMPOS,
  })
}
