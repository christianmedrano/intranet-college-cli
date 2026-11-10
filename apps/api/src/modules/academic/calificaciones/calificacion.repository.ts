import {
  estadoPeriodoAcademicoSchema,
  valorLiteralSchema,
  type CalificacionResponse,
  type PaginationInput,
} from '@intranet/shared'
import type { Prisma } from '../../../generated/prisma/client.js'

const CAMPOS_CALIFICACION = {
  id: true,
  alumnoId: true,
  cursoId: true,
  periodoId: true,
  valor: true,
  observacion: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CalificacionSelect

interface FilaCalificacion {
  id: string
  alumnoId: string
  cursoId: string
  periodoId: string
  valor: string
  observacion: string | null
  createdAt: Date
  updatedAt: Date
}

/** Proyecta la fila interna al contrato público. */
function mapear(fila: FilaCalificacion): CalificacionResponse {
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

/** Período mínimo para validar estado y año. */
export interface PeriodoParaCalificar {
  id: string
  anioId: string
  estado: 'PLANIFICADO' | 'ACTIVO' | 'CERRADO'
}

/**
 * Busca un período vigente de la institución y normaliza su estado.
 *
 * @returns `null` si no existe o pertenece a otra institución.
 */
export async function findPeriodoParaCalificar(
  prisma: Prisma.TransactionClient,
  periodoId: string,
  institucionId: string,
): Promise<PeriodoParaCalificar | null> {
  const fila = await prisma.periodoAcademico.findFirst({
    where: {
      id: periodoId,
      anio: { institucionId, deletedAt: null },
    },
    select: { id: true, anioId: true, estado: true },
  })

  if (!fila) {
    return null
  }

  return {
    id: fila.id,
    anioId: fila.anioId,
    estado: estadoPeriodoAcademicoSchema.parse(fila.estado),
  }
}

/** Fila mínima de una calificación para validar alcance y auditar cambios. */
export interface CalificacionRow {
  id: string
  alumnoId: string
  cursoId: string
  periodoId: string
  valor: string
  observacion: string | null
}

/**
 * Busca una calificación vigente dentro de la institución.
 *
 * La condición sobre el período evita exponer registros de otra institución.
 */
export async function findCalificacionPorId(
  prisma: Prisma.TransactionClient,
  id: string,
  institucionId: string,
): Promise<CalificacionRow | null> {
  return prisma.calificacion.findFirst({
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

/** Conteo de registros vigentes de un período (RF-ACAD-012). */
export interface ConteoPeriodo {
  totalCalificaciones: number
  totalNotasFinales: number
}

/**
 * Cuenta las calificaciones y notas finales vigentes del período.
 *
 * Excluye los registros con borrado lógico para que el resumen refleje solo lo
 * que sigue siendo válido.
 */
export async function countRegistrosDelPeriodo(
  prisma: Prisma.TransactionClient,
  periodoId: string,
): Promise<ConteoPeriodo> {
  const [totalCalificaciones, totalNotasFinales] = await Promise.all([
    prisma.calificacion.count({ where: { periodoId, deletedAt: null } }),
    prisma.notaFinalPeriodo.count({ where: { periodoId, deletedAt: null } }),
  ])

  return { totalCalificaciones, totalNotasFinales }
}

/** Cuenta las calificaciones que cumplen la condición de alcance. */
export async function countCalificaciones(
  prisma: Prisma.TransactionClient,
  where: Prisma.CalificacionWhereInput,
): Promise<number> {
  return prisma.calificacion.count({ where })
}

/**
 * Lista las calificaciones de la condición, de la más reciente a la más
 * antigua. `id` desempata para que la paginación sea estable.
 */
export async function findCalificaciones(
  prisma: Prisma.TransactionClient,
  where: Prisma.CalificacionWhereInput,
  paginacion: PaginationInput,
): Promise<CalificacionResponse[]> {
  const filas = await prisma.calificacion.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    skip: (paginacion.page - 1) * paginacion.pageSize,
    take: paginacion.pageSize,
    select: CAMPOS_CALIFICACION,
  })

  return filas.map(mapear)
}

export interface CrearCalificacionData {
  alumnoId: string
  cursoId: string
  periodoId: string
  valor: string
  observacion?: string
  createdBy: string
}

/**
 * Crea una calificación literal (RF-ACAD-001).
 *
 * La unicidad `(alumno, curso, período)` la impone la base de datos.
 */
export async function createCalificacion(
  prisma: Prisma.TransactionClient,
  datos: CrearCalificacionData,
): Promise<CalificacionResponse> {
  const fila = await prisma.calificacion.create({
    data: {
      alumnoId: datos.alumnoId,
      cursoId: datos.cursoId,
      periodoId: datos.periodoId,
      valor: datos.valor,
      observacion: datos.observacion ?? null,
      createdBy: datos.createdBy,
    },
    select: CAMPOS_CALIFICACION,
  })

  return mapear(fila)
}

export interface ActualizarCalificacionData {
  id: string
  valor?: string
  observacion?: string
  updatedBy: string
}

/** Actualiza solo los campos enviados y devuelve la calificación completa. */
export async function updateCalificacion(
  prisma: Prisma.TransactionClient,
  datos: ActualizarCalificacionData,
): Promise<CalificacionResponse> {
  const fila = await prisma.calificacion.update({
    where: { id: datos.id },
    data: {
      ...(datos.valor !== undefined ? { valor: datos.valor } : {}),
      ...(datos.observacion !== undefined
        ? { observacion: datos.observacion }
        : {}),
      updatedBy: datos.updatedBy,
    },
    select: CAMPOS_CALIFICACION,
  })

  return mapear(fila)
}
