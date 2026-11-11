import type {
  MensajeResponse,
  Paginated,
  PaginationInput,
} from '@intranet/shared'
import type { PrismaClient } from '../../../generated/prisma/client.js'
import type { Prisma } from '../../../generated/prisma/client.js'
import { getPrisma } from '../../../core/db.js'
import { aFechaISO } from '../../core/estructura/fechas.js'

/** Fila interna de mensaje con adjuntos. */
interface FilaMensaje {
  id: string
  hiloId: string
  autorId: string
  cuerpo: string
  createdAt: Date
  updatedAt: Date
  adjuntos: AdjuntoFila[]
  autorNombre: string
  autorRol: string
}

/** Fila interna de adjunto de mensaje. */
interface AdjuntoFila {
  id: string
  nombreOriginal: string
  nombreAlmacenado: string
  tipoMime: string
  tamanoBytes: number
  createdAt: Date
}

/** Proyecta la fila interna al contrato público MensajeResponse. */
function mapearMensaje(fila: FilaMensaje): MensajeResponse {
  return {
    id: fila.id,
    hiloId: fila.hiloId,
    autorId: fila.autorId,
    autorNombre: fila.autorNombre,
    autorRol: fila.autorRol,
    cuerpo: fila.cuerpo,
    createdAt: aFechaISO(fila.createdAt),
    updatedAt: aFechaISO(fila.updatedAt),
    adjuntos: fila.adjuntos.map((a) => ({
      id: a.id,
      nombreOriginal: a.nombreOriginal,
      url: `/api/v1/mensajes/adjuntos/${a.id}/download`,
      tipoMime: a.tipoMime,
      tamanoBytes: a.tamanoBytes,
      createdAt: aFechaISO(a.createdAt),
    })),
  }
}

/**
 * Obtiene o crea el hilo de mensajería de una sección (upsert).
 */
export async function obtenerOCrearHilo(
  seccionId: string,
  prisma: PrismaClient | Prisma.TransactionClient = getPrisma(),
) {
  return prisma.hiloMensajeria.upsert({
    where: { seccionId },
    create: { seccionId },
    update: {},
    select: { id: true, seccionId: true, createdAt: true, updatedAt: true },
  })
}

/**
 * Crea un mensaje en un hilo.
 */
export async function crearMensaje(
  hiloId: string,
  autorId: string,
  cuerpo: string,
  prisma: PrismaClient | Prisma.TransactionClient = getPrisma(),
) {
  const creado = await prisma.mensajeSeccion.create({
    data: { hiloId, autorId, cuerpo },
    include: { adjuntos: true, autor: { select: { persona: { select: { nombres: true, apellidos: true } } } } },
  })

  return mapearMensaje({
    id: creado.id,
    hiloId: creado.hiloId,
    autorId: creado.autorId,
    cuerpo: creado.cuerpo,
    createdAt: creado.createdAt,
    updatedAt: creado.updatedAt,
    adjuntos: creado.adjuntos,
    autorNombre: `${creado.autor.persona.nombres} ${creado.autor.persona.apellidos}`,
    autorRol: 'TODO',
  })
}

/**
 * Lista mensajes de un hilo con paginación (más recientes primero).
 */
export async function listarMensajes(
  hiloId: string,
  paginacion: PaginationInput,
  prisma: PrismaClient | Prisma.TransactionClient = getPrisma(),
): Promise<Paginated<MensajeResponse>> {
  const [total, filas] = await prisma.$transaction([
    prisma.mensajeSeccion.count({ where: { hiloId, deletedAt: null } }),
    prisma.mensajeSeccion.findMany({
      where: { hiloId, deletedAt: null },
      include: { adjuntos: true, autor: { select: { persona: { select: { nombres: true, apellidos: true } } } } },
      orderBy: { createdAt: 'desc' },
      skip: (paginacion.page - 1) * paginacion.pageSize,
      take: paginacion.pageSize,
    }),
  ])

  const mensajes = filas.map((f) => ({
    id: f.id,
    hiloId: f.hiloId,
    autorId: f.autorId,
    cuerpo: f.cuerpo,
    createdAt: f.createdAt,
    updatedAt: f.updatedAt,
    adjuntos: f.adjuntos,
    autorNombre: `${f.autor.persona.nombres} ${f.autor.persona.apellidos}`,
    autorRol: 'TODO',
  }))

  const mensajesMapeados = mensajes.map(mapearMensaje)

  return {
    data: mensajesMapeados,
    meta: {
      page: paginacion.page,
      pageSize: paginacion.pageSize,
      total,
    },
  }
}

/**
 * Borrado lógico (soft delete) de un mensaje.
 */
export async function archivarMensaje(
  id: string,
  prisma: PrismaClient | Prisma.TransactionClient = getPrisma(),
): Promise<void> {
  await prisma.mensajeSeccion.update({
    where: { id },
    data: { deletedAt: new Date() },
  })
}

/**
 * Cuenta mensajes de un hilo.
 */
export async function contarMensajes(
  hiloId: string,
  prisma: PrismaClient | Prisma.TransactionClient = getPrisma(),
): Promise<number> {
  return prisma.mensajeSeccion.count({ where: { hiloId, deletedAt: null } })
}