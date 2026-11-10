import {
  valorLiteralSchema,
  type NotaFinalResponse,
  type PaginationInput,
} from '@intranet/shared'
import type { Prisma } from '../../../generated/prisma/client.js'

const CAMPOS_NOTA_FINAL = {
  id: true,
  alumnoId: true,
  cursoId: true,
  periodoId: true,
  valor: true,
  observacion: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.NotaFinalPeriodoSelect

interface FilaNotaFinal {
  id: string
  alumnoId: string
  cursoId: string
  periodoId: string
  valor: string
  observacion: string | null
  createdAt: Date
  updatedAt: Date
}

/**
 * Proyecta la fila interna al contrato público.
 *
 * No se consulta ninguna calificación: la nota se devuelve tal como se guardó
 * (RN-ACAD-004).
 */
function mapear(fila: FilaNotaFinal): NotaFinalResponse {
  return {
    id: fila.id,
    alumnoId: fila.alumnoId,
    cursoId: fila.cursoId,
    periodoId: fila.periodoId,
    valor: valorLiteralSchema.parse(fila.valor),
    observacion: fila.observacion,
    createdAt: fila.createdAt.toISOString(),
    updatedAt: fila.updatedAt.toISOString(),
  }
}

/** Fila mínima de una nota final para validar alcance y auditar cambios. */
export interface NotaFinalRow {
  id: string
  alumnoId: string
  cursoId: string
  periodoId: string
  valor: string
  observacion: string | null
}

/**
 * Busca una nota final vigente dentro de la institución.
 *
 * La condición sobre el período evita exponer registros de otra institución.
 */
export async function findNotaFinalPorId(
  prisma: Prisma.TransactionClient,
  id: string,
  institucionId: string,
): Promise<NotaFinalRow | null> {
  return prisma.notaFinalPeriodo.findFirst({
    where: {
      id,
      deletedAt: null,
      alumno: { deletedAt: null },
      periodo: { anio: { institucionId, deletedAt: null } },
    },
    select: {
      id: true,
      alumnoId: true,
      cursoId: true,
      periodoId: true,
      valor: true,
      observacion: true,
    },
  })
}

/** Cuenta las notas finales que cumplen la condición de alcance. */
export async function countNotasFinales(
  prisma: Prisma.TransactionClient,
  where: Prisma.NotaFinalPeriodoWhereInput,
): Promise<number> {
  return prisma.notaFinalPeriodo.count({ where })
}

/**
 * Lista las notas finales de la condición, de la más reciente a la más
 * antigua. `id` desempata para que la paginación sea estable.
 */
export async function findNotasFinales(
  prisma: Prisma.TransactionClient,
  where: Prisma.NotaFinalPeriodoWhereInput,
  paginacion: PaginationInput,
): Promise<NotaFinalResponse[]> {
  const filas = await prisma.notaFinalPeriodo.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    skip: (paginacion.page - 1) * paginacion.pageSize,
    take: paginacion.pageSize,
    select: CAMPOS_NOTA_FINAL,
  })

  return filas.map(mapear)
}

export interface CrearNotaFinalData {
  alumnoId: string
  cursoId: string
  periodoId: string
  valor: string
  observacion?: string
  createdBy: string
}

/**
 * Crea la nota final manual del período (RF-ACAD-002).
 *
 * La unicidad `(alumno, curso, período)` la impone la base de datos.
 */
export async function createNotaFinal(
  prisma: Prisma.TransactionClient,
  datos: CrearNotaFinalData,
): Promise<NotaFinalResponse> {
  const fila = await prisma.notaFinalPeriodo.create({
    data: {
      alumnoId: datos.alumnoId,
      cursoId: datos.cursoId,
      periodoId: datos.periodoId,
      valor: datos.valor,
      observacion: datos.observacion ?? null,
      createdBy: datos.createdBy,
    },
    select: CAMPOS_NOTA_FINAL,
  })

  return mapear(fila)
}

export interface ActualizarNotaFinalData {
  id: string
  valor?: string
  observacion?: string
  updatedBy: string
}

/** Actualiza solo los campos enviados y devuelve la nota final completa. */
export async function updateNotaFinal(
  prisma: Prisma.TransactionClient,
  datos: ActualizarNotaFinalData,
): Promise<NotaFinalResponse> {
  const fila = await prisma.notaFinalPeriodo.update({
    where: { id: datos.id },
    data: {
      ...(datos.valor !== undefined ? { valor: datos.valor } : {}),
      ...(datos.observacion !== undefined
        ? { observacion: datos.observacion }
        : {}),
      updatedBy: datos.updatedBy,
    },
    select: CAMPOS_NOTA_FINAL,
  })

  return mapear(fila)
}
