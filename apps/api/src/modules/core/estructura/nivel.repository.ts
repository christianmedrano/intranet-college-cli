import type { NivelResponse, PaginationInput } from '@intranet/shared'
import type { PrismaClient } from '../../../generated/prisma/client.js'

const CAMPOS = {
  id: true,
  nombre: true,
  orden: true,
} as const

/** Cuenta los niveles vigentes de la institución para la paginación. */
export async function countNiveles(
  prisma: PrismaClient,
  institucionId: string,
): Promise<number> {
  return prisma.nivel.count({
    where: { institucionId, deletedAt: null },
  })
}

/**
 * Lista los niveles vigentes ordenados por `orden` ascendente (RF-CORE-010).
 *
 * `id` desempata para que la paginación sea estable si dos niveles comparten
 * orden.
 */
export async function findNiveles(
  prisma: PrismaClient,
  institucionId: string,
  paginacion: PaginationInput,
): Promise<NivelResponse[]> {
  return prisma.nivel.findMany({
    where: { institucionId, deletedAt: null },
    orderBy: [{ orden: 'asc' }, { id: 'asc' }],
    skip: (paginacion.page - 1) * paginacion.pageSize,
    take: paginacion.pageSize,
    select: CAMPOS,
  })
}

/** Busca un nivel vigente de la institución por identificador. */
export async function findNivelPorId(
  prisma: PrismaClient,
  id: string,
  institucionId: string,
): Promise<NivelResponse | null> {
  return prisma.nivel.findFirst({
    where: { id, institucionId, deletedAt: null },
    select: CAMPOS,
  })
}

export interface CrearNivelData {
  institucionId: string
  nombre: string
  orden: number
  createdBy: string
}

/** Crea un nivel dentro de la institución. */
export async function createNivel(
  prisma: PrismaClient,
  datos: CrearNivelData,
): Promise<NivelResponse> {
  return prisma.nivel.create({
    data: {
      institucionId: datos.institucionId,
      nombre: datos.nombre,
      orden: datos.orden,
      createdBy: datos.createdBy,
    },
    select: CAMPOS,
  })
}

export interface ActualizarNivelData {
  nombre?: string
  orden?: number
  updatedBy: string
}

/** Actualiza solo los campos enviados del nivel. */
export async function updateNivel(
  prisma: PrismaClient,
  id: string,
  datos: ActualizarNivelData,
): Promise<NivelResponse> {
  return prisma.nivel.update({
    where: { id },
    data: {
      ...(datos.nombre !== undefined ? { nombre: datos.nombre } : {}),
      ...(datos.orden !== undefined ? { orden: datos.orden } : {}),
      updatedBy: datos.updatedBy,
    },
    select: CAMPOS,
  })
}
