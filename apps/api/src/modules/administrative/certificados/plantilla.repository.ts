import {
  plantillaCertificadoResponseSchema,
  paginatedPlantillasSchema,
  type PlantillaCertificadoResponsePayload,
  type PaginatedPlantillasPayload,
  type PaginationInput,
} from '@intranet/shared'
import type { Prisma } from '../../../generated/prisma/client.js'

const CAMPOS_PLANTILLA = {
  id: true,
  tipo: true,
  nombre: true,
  contenido: true,
  activa: true,
  version: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
  updatedBy: true,
  deletedAt: true,
} satisfies Prisma.PlantillaCertificadoSelect

interface FilaPlantilla {
  id: string
  tipo: string
  nombre: string
  contenido: string
  activa: boolean
  version: number
  createdAt: Date
  updatedAt: Date
  createdBy: string | null
  updatedBy: string | null
  deletedAt: Date | null
}

/** Proyecta la fila interna al contrato público. */
function mapear(fila: FilaPlantilla): PlantillaCertificadoResponsePayload {
  return plantillaCertificadoResponseSchema.parse({
    id: fila.id,
    tipo: fila.tipo,
    nombre: fila.nombre,
    contenido: fila.contenido,
    activa: fila.activa,
    version: fila.version,
    createdAt: fila.createdAt.toISOString(),
    updatedAt: fila.updatedAt.toISOString(),
  })
}

/** Cuenta plantillas según la condición de alcance. */
export async function countPlantillas(
  prisma: Prisma.TransactionClient,
  where: Prisma.PlantillaCertificadoWhereInput,
): Promise<number> {
  return prisma.plantillaCertificado.count({ where })
}

/**
 * Lista plantillas con paginación.
 */
export async function findPlantillas(
  prisma: Prisma.TransactionClient,
  where: Prisma.PlantillaCertificadoWhereInput,
  paginacion: PaginationInput,
): Promise<PaginatedPlantillasPayload> {
  const [filas, total] = await Promise.all([
    prisma.plantillaCertificado.findMany({
      where,
      orderBy: [{ tipo: 'asc' }, { version: 'desc' }],
      skip: (paginacion.page - 1) * paginacion.pageSize,
      take: paginacion.pageSize,
      select: CAMPOS_PLANTILLA,
    }),
    prisma.plantillaCertificado.count({ where }),
  ])

  return paginatedPlantillasSchema.parse({
    data: filas.map(mapear),
    meta: {
      page: paginacion.page,
      pageSize: paginacion.pageSize,
      total,
    },
  })
}

/** Busca una plantilla por ID. */
export async function findPlantillaPorId(
  prisma: Prisma.TransactionClient,
  id: string,
): Promise<PlantillaCertificadoResponsePayload | null> {
  const fila = await prisma.plantillaCertificado.findFirst({
    where: { id, deletedAt: null },
    select: CAMPOS_PLANTILLA,
  })
  return fila ? mapear(fila) : null
}

/** Busca la plantilla activa más reciente para un tipo. */
export async function findPlantillaActivaPorTipo(
  prisma: Prisma.TransactionClient,
  tipo: string,
): Promise<PlantillaCertificadoResponsePayload | null> {
  const fila = await prisma.plantillaCertificado.findFirst({
    where: { tipo, activa: true, deletedAt: null },
    orderBy: { version: 'desc' },
    select: CAMPOS_PLANTILLA,
  })
  return fila ? mapear(fila) : null
}

/** Verifica si existe una plantilla con el mismo tipo y versión. */
export async function existeVersion(
  prisma: Prisma.TransactionClient,
  tipo: string,
  version: number,
  excluirId?: string,
): Promise<boolean> {
  const plantilla = await prisma.plantillaCertificado.findFirst({
    where: {
      tipo,
      version,
      deletedAt: null,
      ...(excluirId ? { id: { not: excluirId } } : {}),
    },
    select: { id: true },
  })
  return plantilla !== null
}

export interface CrearPlantillaData {
  tipo: string
  nombre: string
  contenido: string
  activa: boolean
  createdBy: string
}

/** Crea una plantilla con versionado automático. */
export async function createPlantilla(
  prisma: Prisma.TransactionClient,
  datos: CrearPlantillaData,
): Promise<PlantillaCertificadoResponsePayload> {
  // Calcular la siguiente versión para el tipo
  const ultima = await prisma.plantillaCertificado.findFirst({
    where: { tipo: datos.tipo, deletedAt: null },
    orderBy: { version: 'desc' },
    select: { version: true },
  })
  const version = (ultima?.version ?? 0) + 1

  const fila = await prisma.plantillaCertificado.create({
    data: {
      tipo: datos.tipo,
      nombre: datos.nombre,
      contenido: datos.contenido,
      activa: datos.activa,
      version,
      createdBy: datos.createdBy,
    },
    select: CAMPOS_PLANTILLA,
  })

  return mapear(fila)
}

export interface ActualizarPlantillaData {
  id: string
  nombre?: string
  contenido?: string
  activa?: boolean
  updatedBy: string
}

/** Actualiza una plantilla (no cambia la versión). */
export async function updatePlantilla(
  prisma: Prisma.TransactionClient,
  datos: ActualizarPlantillaData,
): Promise<PlantillaCertificadoResponsePayload> {
  const fila = await prisma.plantillaCertificado.update({
    where: { id: datos.id },
    data: {
      ...(datos.nombre !== undefined ? { nombre: datos.nombre } : {}),
      ...(datos.contenido !== undefined ? { contenido: datos.contenido } : {}),
      ...(datos.activa !== undefined ? { activa: datos.activa } : {}),
      updatedBy: datos.updatedBy,
    },
    select: CAMPOS_PLANTILLA,
  })

  return mapear(fila)
}

/** Elimina lógicamente una plantilla (solo si no tiene certificados asociados). */
export async function softDeletePlantilla(
  prisma: Prisma.TransactionClient,
  id: string,
  updatedBy: string,
): Promise<void> {
  const certificados = await prisma.certificado.count({
    where: { plantillaId: id },
  })
  if (certificados > 0) {
    throw new Error('No se puede eliminar una plantilla con certificados asociados')
  }

  await prisma.plantillaCertificado.update({
    where: { id },
    data: {
      deletedAt: new Date(),
      updatedBy,
    },
  })
}