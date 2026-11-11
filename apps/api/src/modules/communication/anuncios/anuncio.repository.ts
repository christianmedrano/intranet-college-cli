import type {
  AnuncioResponse,
  CrearAnuncioInput,
  ActualizarAnuncioInput,
  ListarAnunciosQuery,
  PaginationInput,
  Paginated,
  RoleCode,
} from '@intranet/shared'
import type { Prisma } from '../../../generated/prisma/client.js'
import type { PrismaClient } from '../../../generated/prisma/client.js'
import { getPrisma } from '../../../core/db.js'
import { aFechaISO } from '../../core/estructura/fechas.js'

/** Cliente Prisma (incluye transaccional). */
type PrismaClientOrTx = PrismaClient | Prisma.TransactionClient

/** Fila interna de anuncio con adjuntos. */
interface FilaAnuncio {
  id: string
  institucionId: string
  autorId: string
  titulo: string
  cuerpo: string
  tipo: 'INSTITUCIONAL' | 'SECCION'
  estado: 'BORRADOR' | 'PUBLICADO' | 'EXPIRADO' | 'ARCHIVADO'
  audienciaNiveles: string[]
  audienciaGrados: string[]
  audienciaSecciones: string[]
  audienciaRoles: RoleCode[]
  publicadoEn: Date | null
  expiraEn: Date | null
  createdAt: Date
  updatedAt: Date
  adjuntos: AdjuntoFila[]
}

/** Fila interna de adjunto de anuncio. */
interface AdjuntoFila {
  id: string
  nombreOriginal: string
  nombreAlmacenado: string
  tipoMime: string
  tamanoBytes: number
  createdAt: Date
}

/** Proyecta la fila interna al contrato público AnuncioResponse. */
function mapearAnuncio(fila: FilaAnuncio): AnuncioResponse {
  return {
    id: fila.id,
    institucionId: fila.institucionId,
    autorId: fila.autorId,
    titulo: fila.titulo,
    cuerpo: fila.cuerpo,
    tipo: fila.tipo,
    estado: fila.estado,
    audienciaNiveles: fila.audienciaNiveles,
    audienciaGrados: fila.audienciaGrados,
    audienciaSecciones: fila.audienciaSecciones,
    audienciaRoles: fila.audienciaRoles,
    publicadoEn: fila.publicadoEn ? aFechaISO(fila.publicadoEn) : null,
    expiraEn: fila.expiraEn ? aFechaISO(fila.expiraEn) : null,
    createdAt: fila.createdAt.toISOString(),
    updatedAt: fila.updatedAt.toISOString(),
    adjuntos: fila.adjuntos.map((a) => ({
      id: a.id,
      nombreOriginal: a.nombreOriginal,
      url: `/api/v1/anuncios/adjuntos/${a.id}/download`,
      tipoMime: a.tipoMime,
      tamanoBytes: a.tamanoBytes,
      createdAt: a.createdAt.toISOString(),
    })),
  }
}

/** Construye el where de Prisma a partir de los filtros validados. */
function construirWhere(filtros: ListarAnunciosQuery): Prisma.AnuncioWhereInput {
  const where: Prisma.AnuncioWhereInput = {
    deletedAt: null,
  }

  if (filtros.tipo) where.tipo = filtros.tipo
  if (filtros.estado) where.estado = filtros.estado

  // Filtros de audiencia (arrays JSON) usando JSON_CONTAINS vía path filter
  // TypeScript no conoce los operadores JSON de MySQL; usamos 'as any' para el path filter
  if (filtros.nivelId) {
    (where as Record<string, unknown>).audienciaNiveles = {
      path: ['$*', { string_contains: filtros.nivelId }],
    }
  }
  if (filtros.gradoId) {
    (where as Record<string, unknown>).audienciaGrados = {
      path: ['$*', { string_contains: filtros.gradoId }],
    }
  }
  if (filtros.seccionId) {
    (where as Record<string, unknown>).audienciaSecciones = {
      path: ['$*', { string_contains: filtros.seccionId }],
    }
  }
  if (filtros.rol) {
    (where as Record<string, unknown>).audienciaRoles = {
      path: ['$*', { string_contains: filtros.rol }],
    }
  }

  if (filtros.desde || filtros.hasta) {
    where.publicadoEn = {}
    if (filtros.desde) where.publicadoEn.gte = new Date(filtros.desde)
    if (filtros.hasta) where.publicadoEn.lte = new Date(filtros.hasta)
  }

  return where
}

/**
 * Crea un nuevo anuncio.
 */
export async function crearAnuncio(
  data: CrearAnuncioInput & { autorId: string; institucionId: string },
  prisma: PrismaClientOrTx = getPrisma(),
): Promise<AnuncioResponse> {
  const creado = await prisma.anuncio.create({
    data: {
      ...data,
      audienciaNiveles: data.audienciaNiveles ?? [],
      audienciaGrados: data.audienciaGrados ?? [],
      audienciaSecciones: data.audienciaSecciones ?? [],
      audienciaRoles: data.audienciaRoles ?? [],
      publicadoEn: data.estado === 'PUBLICADO' ? new Date() : null,
    },
    include: { adjuntos: true },
  })

  return mapearAnuncio(creado as unknown as FilaAnuncio)
}

/**
 * Busca un anuncio por ID (incluye adjuntos).
 */
export async function encontrarAnuncioPorId(
  id: string,
  prisma: PrismaClientOrTx = getPrisma(),
): Promise<AnuncioResponse | null> {
  const fila = await prisma.anuncio.findUnique({
    where: { id, deletedAt: null },
    include: { adjuntos: true },
  })

  if (!fila) return null

  return mapearAnuncio(fila as unknown as FilaAnuncio)
}

/**
 * Actualiza parcialmente un anuncio.
 */
export async function actualizarAnuncio(
  id: string,
  data: ActualizarAnuncioInput,
  prisma: PrismaClientOrTx = getPrisma(),
): Promise<AnuncioResponse> {
  const datos: Prisma.AnuncioUpdateInput = {}

  if (data.titulo !== undefined) datos.titulo = data.titulo
  if (data.cuerpo !== undefined) datos.cuerpo = data.cuerpo
  if (data.tipo !== undefined) datos.tipo = data.tipo
  if (data.estado !== undefined) datos.estado = data.estado
  if (data.audienciaNiveles !== undefined) datos.audienciaNiveles = data.audienciaNiveles
  if (data.audienciaGrados !== undefined) datos.audienciaGrados = data.audienciaGrados
  if (data.audienciaSecciones !== undefined) datos.audienciaSecciones = data.audienciaSecciones
  if (data.audienciaRoles !== undefined) datos.audienciaRoles = data.audienciaRoles
  if (data.expiraEn !== undefined) datos.expiraEn = data.expiraEn ? new Date(data.expiraEn) : null

  // Si pasa a PUBLICADO y no tenía publicadoEn, setear ahora
  if (data.estado === 'PUBLICADO') {
    const actual = await prisma.anuncio.findUnique({ where: { id }, select: { publicadoEn: true, estado: true } })
    if (actual && !actual.publicadoEn && actual.estado !== 'PUBLICADO') {
      datos.publicadoEn = new Date()
    }
  }

  const actualizado = await prisma.anuncio.update({
    where: { id },
    data: datos,
    include: { adjuntos: true },
  })

  return mapearAnuncio(actualizado as unknown as FilaAnuncio)
}

/**
 * Borrado lógico (archivar) de un anuncio.
 */
export async function archivarAnuncio(
  id: string,
  prisma: PrismaClientOrTx = getPrisma(),
): Promise<void> {
  await prisma.anuncio.update({
    where: { id },
    data: { estado: 'ARCHIVADO', deletedAt: new Date() },
  })
}

/**
 * Lista anuncios con filtros, paginación y orden descendente por fecha de publicación.
 */
export async function listarAnuncios(
  filtros: ListarAnunciosQuery,
  paginacion: PaginationInput,
  prisma: PrismaClientOrTx = getPrisma(),
): Promise<Paginated<AnuncioResponse>> {
  const where = construirWhere(filtros)

  const [total, filas] = await prisma.$transaction([
    prisma.anuncio.count({ where }),
    prisma.anuncio.findMany({
      where,
      include: { adjuntos: true },
      orderBy: [{ publicadoEn: 'desc' }, { createdAt: 'desc' }],
      skip: (paginacion.page - 1) * paginacion.pageSize,
      take: paginacion.pageSize,
    }),
  ])

  return {
    data: (filas as unknown as FilaAnuncio[]).map(mapearAnuncio),
    meta: {
      page: paginacion.page,
      pageSize: paginacion.pageSize,
      total,
    },
  }
}

/**
 * Cuenta anuncios para un autor (para auditoría/estadísticas).
 */
export async function contarAnunciosPorAutor(
  autorId: string,
  prisma: PrismaClientOrTx = getPrisma(),
): Promise<number> {
  return prisma.anuncio.count({
    where: { autorId, deletedAt: null },
  })
}