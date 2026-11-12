import {
  adjuntoVirtualResponseSchema,
  type AdjuntoVirtualResponsePayload,
  type PaginationInput,
} from '@intranet/shared'
import type { Prisma } from '../../../generated/prisma/client.js'

const CAMPOS_ADJUNTO = {
  id: true,
  materialId: true,
  nombreOriginal: true,
  nombreAlmacenado: true,
  tipoMime: true,
  tamanoBytes: true,
  createdAt: true,
} satisfies Prisma.AdjuntoVirtualSelect

interface FilaAdjunto {
  id: string
  materialId: string
  nombreOriginal: string
  nombreAlmacenado: string
  tipoMime: string
  tamanoBytes: number
  createdAt: Date
}

/** Proyecta la fila interna al contrato público. */
function mapear(fila: FilaAdjunto): AdjuntoVirtualResponsePayload {
  return adjuntoVirtualResponseSchema.parse({
    id: fila.id,
    materialId: fila.materialId,
    nombreOriginal: fila.nombreOriginal,
    url: `/api/v1/virtual/materiales/${fila.materialId}/adjuntos/${fila.id}/download`,
    tipoMime: fila.tipoMime,
    tamanoBytes: fila.tamanoBytes,
    createdAt: fila.createdAt.toISOString(),
  })
}

/** Cuenta adjuntos de un material. */
export async function countAdjuntos(
  prisma: Prisma.TransactionClient,
  materialId: string,
): Promise<number> {
  return prisma.adjuntoVirtual.count({ where: { materialId } })
}

/** Lista adjuntos de un material. */
export async function findAdjuntosPorMaterial(
  prisma: Prisma.TransactionClient,
  materialId: string,
  paginacion: PaginationInput,
): Promise<AdjuntoVirtualResponsePayload[]> {
  const filas = await prisma.adjuntoVirtual.findMany({
    where: { materialId },
    orderBy: { createdAt: 'asc' },
    skip: (paginacion.page - 1) * paginacion.pageSize,
    take: paginacion.pageSize,
    select: CAMPOS_ADJUNTO,
  })

  return filas.map(mapear)
}

/** Busca un adjunto por ID. */
export async function findAdjuntoPorId(
  prisma: Prisma.TransactionClient,
  id: string,
): Promise<FilaAdjunto | null> {
  return prisma.adjuntoVirtual.findUnique({
    where: { id },
    select: CAMPOS_ADJUNTO,
  })
}

/** Verifica si el adjunto pertenece al material indicado. */
export async function assertAdjuntoPerteneceAMaterial(
  prisma: Prisma.TransactionClient,
  adjuntoId: string,
  materialId: string,
): Promise<void> {
  const adjunto = await prisma.adjuntoVirtual.findUnique({
    where: { id: adjuntoId },
    select: { materialId: true },
  })

  if (!adjunto || adjunto.materialId !== materialId) {
    throw new Error('ADJUNTO_NO_PERTENECE')
  }
}

interface CrearAdjuntoData {
  materialId: string
  nombreOriginal: string
  nombreAlmacenado: string
  tipoMime: string
  tamanoBytes: number
}

/** Crea un adjunto. */
export async function createAdjunto(
  prisma: Prisma.TransactionClient,
  datos: CrearAdjuntoData,
): Promise<AdjuntoVirtualResponsePayload> {
  const fila = await prisma.adjuntoVirtual.create({
    data: {
      materialId: datos.materialId,
      nombreOriginal: datos.nombreOriginal,
      nombreAlmacenado: datos.nombreAlmacenado,
      tipoMime: datos.tipoMime,
      tamanoBytes: datos.tamanoBytes,
    },
    select: CAMPOS_ADJUNTO,
  })

  return mapear(fila)
}

/** Elimina un adjunto. */
export async function deleteAdjunto(
  prisma: Prisma.TransactionClient,
  id: string,
): Promise<void> {
  await prisma.adjuntoVirtual.delete({ where: { id } })
}