import type { AuditoriaResponse, PaginationInput } from '@intranet/shared'
import type { Prisma, PrismaClient } from '../../../generated/prisma/client.js'

const CAMPOS = {
  id: true,
  usuarioId: true,
  accion: true,
  entidad: true,
  entidadId: true,
  datos: true,
  ip: true,
  userAgent: true,
  createdAt: true,
} as const

interface FilaCruda {
  id: string
  usuarioId: string | null
  accion: string
  entidad: string
  entidadId: string | null
  datos: Prisma.JsonValue
  ip: string | null
  userAgent: string | null
  createdAt: Date
}

/** Proyecta la fila interna al contrato público. */
function mapear(fila: FilaCruda): AuditoriaResponse {
  return {
    id: fila.id,
    usuarioId: fila.usuarioId,
    accion: fila.accion,
    entidad: fila.entidad,
    entidadId: fila.entidadId,
    datos: fila.datos,
    ip: fila.ip,
    userAgent: fila.userAgent,
    createdAt: fila.createdAt.toISOString(),
  }
}

/** Filtros admitidos por el listado de auditoría. */
export interface FiltrosAuditoria {
  usuarioId?: string
  entidad?: string
  entidadId?: string
  accion?: string
  desde?: string
  hasta?: string
}

function whereDe(filtros: FiltrosAuditoria): Prisma.AuditoriaWhereInput {
  const rangoFechas =
    filtros.desde !== undefined || filtros.hasta !== undefined
      ? {
          createdAt: {
            ...(filtros.desde !== undefined
              ? { gte: new Date(filtros.desde) }
              : {}),
            ...(filtros.hasta !== undefined
              ? { lte: new Date(filtros.hasta) }
              : {}),
          },
        }
      : {}

  return {
    ...(filtros.usuarioId !== undefined
      ? { usuarioId: filtros.usuarioId }
      : {}),
    ...(filtros.entidad !== undefined ? { entidad: filtros.entidad } : {}),
    ...(filtros.entidadId !== undefined
      ? { entidadId: filtros.entidadId }
      : {}),
    ...(filtros.accion !== undefined ? { accion: filtros.accion } : {}),
    ...rangoFechas,
  }
}

/** Cuenta los registros de auditoría que cumplen los filtros. */
export async function countAuditoria(
  prisma: PrismaClient,
  filtros: FiltrosAuditoria,
): Promise<number> {
  return prisma.auditoria.count({ where: whereDe(filtros) })
}

/**
 * Lista la auditoría del registro más reciente al más antiguo.
 *
 * `id` desempata para que la paginación sea estable cuando dos operaciones
 * comparten milisegundo.
 */
export async function findAuditoria(
  prisma: PrismaClient,
  filtros: FiltrosAuditoria,
  paginacion: PaginationInput,
): Promise<AuditoriaResponse[]> {
  const filas = await prisma.auditoria.findMany({
    where: whereDe(filtros),
    orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    skip: (paginacion.page - 1) * paginacion.pageSize,
    take: paginacion.pageSize,
    select: CAMPOS,
  })

  return filas.map(mapear)
}
