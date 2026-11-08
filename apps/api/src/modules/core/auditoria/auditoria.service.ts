import type {
  AuditoriaResponse,
  Paginated,
  PaginationInput,
} from '@intranet/shared'
import { getPrisma } from '../../../core/db.js'
import type { PrismaClient } from '../../../generated/prisma/client.js'
import {
  countAuditoria,
  findAuditoria,
  type FiltrosAuditoria,
} from './auditoria.repository.js'

/**
 * Lista la auditoría de solo lectura con filtros y paginación (RF-CORE-016).
 *
 * No hay operaciones de escritura: la tabla se alimenta únicamente desde
 * {@link registrarAuditoria} dentro de las transacciones de negocio.
 *
 * @param filtros Usuario, entidad, acción y rango de fechas.
 * @param paginacion Página y tamaño ya validados por Zod.
 * @param prisma Cliente inyectable para las pruebas.
 */
export async function listarAuditoria(
  filtros: FiltrosAuditoria,
  paginacion: PaginationInput,
  prisma: PrismaClient = getPrisma(),
): Promise<Paginated<AuditoriaResponse>> {
  const total = await countAuditoria(prisma, filtros)
  const data = await findAuditoria(prisma, filtros, paginacion)

  return {
    data,
    meta: {
      page: paginacion.page,
      pageSize: paginacion.pageSize,
      total,
    },
  }
}
