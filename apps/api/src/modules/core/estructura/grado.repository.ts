import type { GradoResponse, PaginationInput } from '@intranet/shared'
import type { PrismaClient } from '../../../generated/prisma/client.js'

const CAMPOS = {
  id: true,
  nivelId: true,
  nombre: true,
  orden: true,
} as const

/**
 * Condición de alcance institucional.
 *
 * `Grado` no guarda `institucionId`: se llega a la institución a través de su
 * nivel. El filtro protege contra datos de otra institución en la misma base.
 */
function alcanceDeInstitucion(institucionId: string) {
  return {
    nivel: { institucionId, deletedAt: null },
  } as const
}

/** Filtros admitidos por el listado de grados. */
export interface FiltrosGrado {
  nivelId?: string
}

/** Cuenta los grados vigentes de la institución. */
export async function countGrados(
  prisma: PrismaClient,
  institucionId: string,
  filtros: FiltrosGrado = {},
): Promise<number> {
  return prisma.grado.count({
    where: {
      deletedAt: null,
      ...(filtros.nivelId !== undefined ? { nivelId: filtros.nivelId } : {}),
      ...alcanceDeInstitucion(institucionId),
    },
  })
}

/**
 * Lista los grados vigentes ordenados por nivel y luego por orden
 * (RF-CORE-010). `id` desempata para una paginación estable.
 */
export async function findGrados(
  prisma: PrismaClient,
  institucionId: string,
  filtros: FiltrosGrado,
  paginacion: PaginationInput,
): Promise<GradoResponse[]> {
  return prisma.grado.findMany({
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

/** Busca un grado vigente de la institución por identificador. */
export async function findGradoPorId(
  prisma: PrismaClient,
  id: string,
  institucionId: string,
): Promise<GradoResponse | null> {
  return prisma.grado.findFirst({
    where: {
      id,
      deletedAt: null,
      ...alcanceDeInstitucion(institucionId),
    },
    select: CAMPOS,
  })
}

export interface CrearGradoData {
  nivelId: string
  nombre: string
  orden: number
  createdBy: string
}

/** Crea un grado dentro de un nivel ya validado. */
export async function createGrado(
  prisma: PrismaClient,
  datos: CrearGradoData,
): Promise<GradoResponse> {
  return prisma.grado.create({
    data: {
      nivelId: datos.nivelId,
      nombre: datos.nombre,
      orden: datos.orden,
      createdBy: datos.createdBy,
    },
    select: CAMPOS,
  })
}

export interface ActualizarGradoData {
  nombre?: string
  orden?: number
  updatedBy: string
}

/** Actualiza solo los campos enviados del grado. */
export async function updateGrado(
  prisma: PrismaClient,
  id: string,
  datos: ActualizarGradoData,
): Promise<GradoResponse> {
  return prisma.grado.update({
    where: { id },
    data: {
      ...(datos.nombre !== undefined ? { nombre: datos.nombre } : {}),
      ...(datos.orden !== undefined ? { orden: datos.orden } : {}),
      updatedBy: datos.updatedBy,
    },
    select: CAMPOS,
  })
}
