import type { PaginationInput, SeccionResponse } from '@intranet/shared'
import type { PrismaClient } from '../../../generated/prisma/client.js'

const CAMPOS = {
  id: true,
  gradoId: true,
  anioId: true,
  nombre: true,
  capacidad: true,
} as const

/**
 * Condición de alcance institucional.
 *
 * `Seccion` llega a la institución por `grado → nivel`; además exige que el
 * año siga vigente, igual que el resto de entidades de estructura.
 */
function alcanceDeInstitucion(institucionId: string) {
  return {
    grado: { deletedAt: null, nivel: { institucionId, deletedAt: null } },
    anio: { deletedAt: null },
  } as const
}

/** Filtros admitidos por el listado de secciones. */
export interface FiltrosSeccion {
  gradoId?: string
  anioId?: string
}

/** Cuenta las secciones vigentes de la institución. */
export async function countSecciones(
  prisma: PrismaClient,
  institucionId: string,
  filtros: FiltrosSeccion = {},
): Promise<number> {
  return prisma.seccion.count({
    where: {
      deletedAt: null,
      ...(filtros.gradoId !== undefined ? { gradoId: filtros.gradoId } : {}),
      ...(filtros.anioId !== undefined ? { anioId: filtros.anioId } : {}),
      ...alcanceDeInstitucion(institucionId),
    },
  })
}

/**
 * Lista las secciones vigentes ordenadas por grado y nombre (RF-CORE-010).
 * `id` desempata para una paginación estable.
 */
export async function findSecciones(
  prisma: PrismaClient,
  institucionId: string,
  filtros: FiltrosSeccion,
  paginacion: PaginationInput,
): Promise<SeccionResponse[]> {
  return prisma.seccion.findMany({
    where: {
      deletedAt: null,
      ...(filtros.gradoId !== undefined ? { gradoId: filtros.gradoId } : {}),
      ...(filtros.anioId !== undefined ? { anioId: filtros.anioId } : {}),
      ...alcanceDeInstitucion(institucionId),
    },
    orderBy: [{ grado: { orden: 'asc' } }, { nombre: 'asc' }, { id: 'asc' }],
    skip: (paginacion.page - 1) * paginacion.pageSize,
    take: paginacion.pageSize,
    select: CAMPOS,
  })
}

/** Busca una sección vigente de la institución por identificador. */
export async function findSeccionPorId(
  prisma: PrismaClient,
  id: string,
  institucionId: string,
): Promise<SeccionResponse | null> {
  return prisma.seccion.findFirst({
    where: {
      id,
      deletedAt: null,
      ...alcanceDeInstitucion(institucionId),
    },
    select: CAMPOS,
  })
}

export interface CrearSeccionData {
  gradoId: string
  anioId: string
  nombre: string
  capacidad?: number | null
  createdBy: string
}

/** Crea una sección dentro de un grado y año ya validados. */
export async function createSeccion(
  prisma: PrismaClient,
  datos: CrearSeccionData,
): Promise<SeccionResponse> {
  return prisma.seccion.create({
    data: {
      gradoId: datos.gradoId,
      anioId: datos.anioId,
      nombre: datos.nombre,
      capacidad: datos.capacidad ?? null,
      createdBy: datos.createdBy,
    },
    select: CAMPOS,
  })
}

export interface ActualizarSeccionData {
  nombre?: string
  capacidad?: number | null
  updatedBy: string
}

/** Actualiza solo los campos enviados de la sección. */
export async function updateSeccion(
  prisma: PrismaClient,
  id: string,
  datos: ActualizarSeccionData,
): Promise<SeccionResponse> {
  return prisma.seccion.update({
    where: { id },
    data: {
      ...(datos.nombre !== undefined ? { nombre: datos.nombre } : {}),
      ...(datos.capacidad !== undefined ? { capacidad: datos.capacidad } : {}),
      updatedBy: datos.updatedBy,
    },
    select: CAMPOS,
  })
}
