import {
  materialResponseSchema,
  paginatedMaterialesSchema,
  type MaterialResponsePayload,
  type PaginatedMaterialesPayload,
  type PaginationInput,
} from '@intranet/shared'
import type { Prisma } from '../../../generated/prisma/client.js'

const CAMPOS_MATERIAL = {
  id: true,
  cursoId: true,
  seccionId: true,
  periodoId: true,
  docenteId: true,
  titulo: true,
  descripcion: true,
  archivoNombre: true,
  archivoMime: true,
  tamanoBytes: true,
  archivoRuta: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
} satisfies Prisma.MaterialVirtualSelect

interface FilaMaterial {
  id: string
  cursoId: string
  seccionId: string
  periodoId: string
  docenteId: string
  titulo: string
  descripcion: string | null
  archivoNombre: string
  archivoMime: string
  tamanoBytes: number
  archivoRuta: string
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}

/** Proyecta la fila interna al contrato público. */
function mapear(fila: FilaMaterial): MaterialResponsePayload {
  return materialResponseSchema.parse({
    id: fila.id,
    cursoId: fila.cursoId,
    seccionId: fila.seccionId,
    periodoId: fila.periodoId,
    docenteId: fila.docenteId,
    titulo: fila.titulo,
    descripcion: fila.descripcion,
    archivoNombre: fila.archivoNombre,
    archivoMime: fila.archivoMime,
    tamanoBytes: fila.tamanoBytes,
    createdAt: fila.createdAt.toISOString(),
    updatedAt: fila.updatedAt.toISOString(),
    adjuntos: [],
  })
}

/** Cuenta materiales según la condición de alcance. */
export async function countMateriales(
  prisma: Prisma.TransactionClient,
  where: Prisma.MaterialVirtualWhereInput,
): Promise<number> {
  return prisma.materialVirtual.count({ where })
}

/**
 * Lista materiales de la condición, del más reciente al más antiguo.
 * `id` desempata para que la paginación sea estable.
 */
export async function findMateriales(
  prisma: Prisma.TransactionClient,
  where: Prisma.MaterialVirtualWhereInput,
  paginacion: PaginationInput,
): Promise<PaginatedMaterialesPayload> {
  const [filas, total] = await Promise.all([
    prisma.materialVirtual.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      skip: (paginacion.page - 1) * paginacion.pageSize,
      take: paginacion.pageSize,
      select: CAMPOS_MATERIAL,
    }),
    prisma.materialVirtual.count({ where }),
  ])

  return paginatedMaterialesSchema.parse({
    data: filas.map(mapear),
    meta: {
      page: paginacion.page,
      pageSize: paginacion.pageSize,
      total,
    },
  })
}

/** Busca un material por ID dentro de la institución (evita exponer de otra institución). */
export async function findMaterialPorId(
  prisma: Prisma.TransactionClient,
  id: string,
  institucionId: string,
): Promise<FilaMaterial | null> {
  return prisma.materialVirtual.findFirst({
    where: {
      id,
      deletedAt: null,
      curso: { nivel: { institucionId, deletedAt: null } },
    },
    select: CAMPOS_MATERIAL,
  })
}

/** Busca un material por ID sin filtro de institución (para uso interno del servicio). */
export async function findMaterialPorIdInterno(
  prisma: Prisma.TransactionClient,
  id: string,
): Promise<FilaMaterial | null> {
  return prisma.materialVirtual.findFirst({
    where: { id, deletedAt: null },
    select: CAMPOS_MATERIAL,
  })
}

/** Verifica si existe un duplicado (docente + curso + sección + período + título). */
export async function existeDuplicado(
  prisma: Prisma.TransactionClient,
  docenteId: string,
  cursoId: string,
  seccionId: string,
  periodoId: string,
  titulo: string,
  excluirId?: string,
): Promise<boolean> {
  const material = await prisma.materialVirtual.findFirst({
    where: {
      docenteId,
      cursoId,
      seccionId,
      periodoId,
      titulo,
      deletedAt: null,
      ...(excluirId ? { id: { not: excluirId } } : {}),
    },
    select: { id: true },
  })

  return material !== null
}

export interface CrearMaterialData {
  cursoId: string
  seccionId: string
  periodoId: string
  anioId: string
  docenteId: string
  titulo: string
  descripcion: string | null
  archivoNombre: string
  archivoMime: string
  tamanoBytes: number
  archivoRuta: string
  createdBy: string
}

/** Crea un material virtual. */
export async function createMaterial(
  prisma: Prisma.TransactionClient,
  datos: CrearMaterialData,
): Promise<MaterialResponsePayload> {
  const fila = await prisma.materialVirtual.create({
    data: {
      cursoId: datos.cursoId,
      seccionId: datos.seccionId,
      periodoId: datos.periodoId,
      anioId: datos.anioId,
      docenteId: datos.docenteId,
      titulo: datos.titulo,
      descripcion: datos.descripcion ?? null,
      archivoNombre: datos.archivoNombre,
      archivoMime: datos.archivoMime,
      tamanoBytes: datos.tamanoBytes,
      archivoRuta: datos.archivoRuta,
      createdBy: datos.createdBy,
    },
    select: CAMPOS_MATERIAL,
  })

  return mapear(fila)
}

export interface ActualizarMaterialData {
  id: string
  cursoId?: string
  seccionId?: string
  periodoId?: string
  anioId?: string
  docenteId?: string
  titulo?: string
  descripcion?: string | null
  archivoNombre?: string
  archivoMime?: string
  tamanoBytes?: number
  archivoRuta?: string
  updatedBy: string
}

/** Actualiza solo los campos enviados y devuelve el material completo. */
export async function updateMaterial(
  prisma: Prisma.TransactionClient,
  datos: ActualizarMaterialData,
): Promise<MaterialResponsePayload> {
  const fila = await prisma.materialVirtual.update({
    where: { id: datos.id },
    data: {
      ...(datos.cursoId !== undefined ? { cursoId: datos.cursoId } : {}),
      ...(datos.seccionId !== undefined ? { seccionId: datos.seccionId } : {}),
      ...(datos.periodoId !== undefined ? { periodoId: datos.periodoId } : {}),
      ...(datos.anioId !== undefined ? { anioId: datos.anioId } : {}),
      ...(datos.docenteId !== undefined ? { docenteId: datos.docenteId } : {}),
      ...(datos.titulo !== undefined ? { titulo: datos.titulo } : {}),
      ...(datos.descripcion !== undefined ? { descripcion: datos.descripcion } : {}),
      ...(datos.archivoNombre !== undefined ? { archivoNombre: datos.archivoNombre } : {}),
      ...(datos.archivoMime !== undefined ? { archivoMime: datos.archivoMime } : {}),
      ...(datos.tamanoBytes !== undefined ? { tamanoBytes: datos.tamanoBytes } : {}),
      ...(datos.archivoRuta !== undefined ? { archivoRuta: datos.archivoRuta } : {}),
      updatedBy: datos.updatedBy,
    },
    select: CAMPOS_MATERIAL,
  })

  return mapear(fila)
}

/** Elimina lógicamente un material (setea deletedAt). */
export async function softDeleteMaterial(
  prisma: Prisma.TransactionClient,
  id: string,
  updatedBy: string,
): Promise<void> {
  await prisma.materialVirtual.update({
    where: { id },
    data: {
      deletedAt: new Date(),
      updatedBy,
    },
  })
}