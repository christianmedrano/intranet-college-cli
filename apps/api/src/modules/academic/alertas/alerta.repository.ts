import type {
  AlertaAsistenciaResponse,
  PaginationInput,
} from '@intranet/shared'
import type { Prisma } from '../../../generated/prisma/client.js'

const CAMPOS_ALERTA = {
  id: true,
  alumnoId: true,
  anioId: true,
  faltasInjustificadas: true,
  umbral: true,
  generadaEn: true,
  actualizadaEn: true,
} satisfies Prisma.AlertaAsistenciaSelect

interface FilaAlerta {
  id: string
  alumnoId: string
  anioId: string
  faltasInjustificadas: number
  umbral: number
  generadaEn: Date
  actualizadaEn: Date
}

/** Proyecta la fila interna al contrato público. */
function mapear(fila: FilaAlerta): AlertaAsistenciaResponse {
  return {
    id: fila.id,
    alumnoId: fila.alumnoId,
    anioId: fila.anioId,
    faltasInjustificadas: fila.faltasInjustificadas,
    umbral: fila.umbral,
    generadaEn: fila.generadaEn.toISOString(),
    actualizadaEn: fila.actualizadaEn.toISOString(),
  }
}

/** Cuenta las alertas que cumplen la condición de alcance. */
export async function countAlertas(
  prisma: Prisma.TransactionClient,
  where: Prisma.AlertaAsistenciaWhereInput,
): Promise<number> {
  return prisma.alertaAsistencia.count({ where })
}

/**
 * Lista las alertas de la condición, de la más reciente a la más antigua.
 * `id` desempata para que la paginación sea estable.
 */
export async function findAlertas(
  prisma: Prisma.TransactionClient,
  where: Prisma.AlertaAsistenciaWhereInput,
  paginacion: PaginationInput,
): Promise<AlertaAsistenciaResponse[]> {
  const filas = await prisma.alertaAsistencia.findMany({
    where,
    orderBy: [{ actualizadaEn: 'desc' }, { id: 'asc' }],
    skip: (paginacion.page - 1) * paginacion.pageSize,
    take: paginacion.pageSize,
    select: CAMPOS_ALERTA,
  })

  return filas.map(mapear)
}

/** Cuenta las faltas injustificadas del alumno dentro del rango del año. */
export async function countFaltasInjustificadas(
  prisma: Prisma.TransactionClient,
  alumnoId: string,
  fechaInicio: Date,
  fechaFin: Date,
): Promise<number> {
  return prisma.asistencia.count({
    where: {
      alumnoId,
      deletedAt: null,
      estado: 'FALTA_INJUSTIFICADA',
      fecha: { gte: fechaInicio, lte: fechaFin },
    },
  })
}

export interface GuardarAlertaData {
  alumnoId: string
  anioId: string
  faltasInjustificadas: number
  umbral: number
}

/**
 * Crea o actualiza la alerta única del alumno en el año (RN-ACAD-016).
 *
 * El umbral guardado es el vigente al recalcular.
 */
export async function upsertAlerta(
  prisma: Prisma.TransactionClient,
  datos: GuardarAlertaData,
): Promise<AlertaAsistenciaResponse> {
  const fila = await prisma.alertaAsistencia.upsert({
    where: {
      alumnoId_anioId: { alumnoId: datos.alumnoId, anioId: datos.anioId },
    },
    create: {
      alumnoId: datos.alumnoId,
      anioId: datos.anioId,
      faltasInjustificadas: datos.faltasInjustificadas,
      umbral: datos.umbral,
    },
    update: {
      faltasInjustificadas: datos.faltasInjustificadas,
      umbral: datos.umbral,
    },
    select: CAMPOS_ALERTA,
  })

  return mapear(fila)
}

/** Elimina la alerta del alumno en el año, si existe. */
export async function deleteAlerta(
  prisma: Prisma.TransactionClient,
  alumnoId: string,
  anioId: string,
): Promise<void> {
  await prisma.alertaAsistencia.deleteMany({ where: { alumnoId, anioId } })
}

/** Elimina las alertas del año que ya no alcanzan el umbral vigente. */
export async function deleteAlertasBajoUmbral(
  prisma: Prisma.TransactionClient,
  anioId: string,
  umbral: number,
): Promise<void> {
  await prisma.alertaAsistencia.deleteMany({
    where: { anioId, faltasInjustificadas: { lt: umbral } },
  })
}

/** Alumnos del año con al menos una falta injustificada. */
export async function findAlumnoIdsConFaltas(
  prisma: Prisma.TransactionClient,
  fechaInicio: Date,
  fechaFin: Date,
): Promise<string[]> {
  const filas = await prisma.asistencia.findMany({
    where: {
      deletedAt: null,
      estado: 'FALTA_INJUSTIFICADA',
      fecha: { gte: fechaInicio, lte: fechaFin },
    },
    distinct: ['alumnoId'],
    select: { alumnoId: true },
  })

  return filas.map((fila) => fila.alumnoId)
}
