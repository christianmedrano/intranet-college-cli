import {
  estadoPeriodoAcademicoSchema,
  type PaginationInput,
  type PeriodoAcademicoResponse,
} from '@intranet/shared'
import type { PrismaClient } from '../../../generated/prisma/client.js'
import { aFechaISO, aFechaUTC } from './fechas.js'

const CAMPOS = {
  id: true,
  anioId: true,
  nombre: true,
  orden: true,
  fechaInicio: true,
  fechaFin: true,
  estado: true,
} as const

interface FilaCruda {
  id: string
  anioId: string
  nombre: string
  orden: number
  fechaInicio: Date
  fechaFin: Date
  estado: string
}

function mapear(fila: FilaCruda): PeriodoAcademicoResponse {
  return {
    id: fila.id,
    anioId: fila.anioId,
    nombre: fila.nombre,
    orden: fila.orden,
    fechaInicio: aFechaISO(fila.fechaInicio),
    fechaFin: aFechaISO(fila.fechaFin),
    estado: estadoPeriodoAcademicoSchema.parse(fila.estado),
  }
}

/** Cuenta los períodos del año para la paginación. */
export async function countPeriodosAcademicos(
  prisma: PrismaClient,
  anioId: string,
): Promise<number> {
  return prisma.periodoAcademico.count({ where: { anioId } })
}

/**
 * Lista los períodos del año ordenados por `orden` ascendente (RF-CORE-009).
 *
 * `id` desempata para que la paginación sea estable aunque dos períodos
 * compartan orden (lo impide la base, pero el orden debe ser determinista).
 */
export async function findPeriodosAcademicos(
  prisma: PrismaClient,
  anioId: string,
  paginacion: PaginationInput,
): Promise<PeriodoAcademicoResponse[]> {
  const filas = await prisma.periodoAcademico.findMany({
    where: { anioId },
    orderBy: [{ orden: 'asc' }, { id: 'asc' }],
    skip: (paginacion.page - 1) * paginacion.pageSize,
    take: paginacion.pageSize,
    select: CAMPOS,
  })

  return filas.map(mapear)
}

/** Busca un período por identificador. */
export async function findPeriodoAcademicoPorId(
  prisma: PrismaClient,
  id: string,
): Promise<PeriodoAcademicoResponse | null> {
  const fila = await prisma.periodoAcademico.findUnique({
    where: { id },
    select: CAMPOS,
  })

  return fila ? mapear(fila) : null
}

export interface CrearPeriodoAcademicoData {
  anioId: string
  nombre: string
  orden: number
  fechaInicio: string
  fechaFin: string
  createdBy: string
}

/** Crea un período en estado `PLANIFICADO`. */
export async function createPeriodoAcademico(
  prisma: PrismaClient,
  datos: CrearPeriodoAcademicoData,
): Promise<PeriodoAcademicoResponse> {
  const fila = await prisma.periodoAcademico.create({
    data: {
      anioId: datos.anioId,
      nombre: datos.nombre,
      orden: datos.orden,
      fechaInicio: aFechaUTC(datos.fechaInicio),
      fechaFin: aFechaUTC(datos.fechaFin),
      estado: 'PLANIFICADO',
      createdBy: datos.createdBy,
    },
    select: CAMPOS,
  })

  return mapear(fila)
}

export interface ActualizarPeriodoAcademicoData {
  nombre?: string
  orden?: number
  fechaInicio?: string
  fechaFin?: string
  updatedBy: string
}

/** Actualiza solo los campos enviados. */
export async function updatePeriodoAcademico(
  prisma: PrismaClient,
  id: string,
  datos: ActualizarPeriodoAcademicoData,
): Promise<PeriodoAcademicoResponse> {
  const fila = await prisma.periodoAcademico.update({
    where: { id },
    data: {
      ...(datos.nombre !== undefined ? { nombre: datos.nombre } : {}),
      ...(datos.orden !== undefined ? { orden: datos.orden } : {}),
      ...(datos.fechaInicio !== undefined
        ? { fechaInicio: aFechaUTC(datos.fechaInicio) }
        : {}),
      ...(datos.fechaFin !== undefined
        ? { fechaFin: aFechaUTC(datos.fechaFin) }
        : {}),
      updatedBy: datos.updatedBy,
    },
    select: CAMPOS,
  })

  return mapear(fila)
}

/**
 * Marca un período como `CERRADO` (RF-CORE-009).
 *
 * El cierre es la alternativa a eliminar un período: la spec §8 impide
 * borrarlo y exige cerrarlo.
 */
export async function cerrarPeriodoAcademicoRecord(
  prisma: PrismaClient,
  id: string,
  usuarioId: string,
): Promise<PeriodoAcademicoResponse> {
  const fila = await prisma.periodoAcademico.update({
    where: { id },
    data: { estado: 'CERRADO', updatedBy: usuarioId },
    select: CAMPOS,
  })

  return mapear(fila)
}
