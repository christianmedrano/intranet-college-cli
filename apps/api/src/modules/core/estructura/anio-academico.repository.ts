import {
  estadoAnioAcademicoSchema,
  type AnioAcademicoResponse,
  type EstadoAnioAcademico,
  type PaginationInput,
} from '@intranet/shared'
import type { PrismaClient } from '../../../generated/prisma/client.js'
import { aFechaISO, aFechaUTC } from './fechas.js'

/**
 * Fila interna: incluye `institucionId` para operar dentro de la transacción
 * de activación, pero nunca se expone en la respuesta.
 */
export interface AnioAcademicoRow {
  id: string
  institucionId: string
  nombre: string
  fechaInicio: string
  fechaFin: string
  estado: EstadoAnioAcademico
}

const CAMPOS = {
  id: true,
  institucionId: true,
  nombre: true,
  fechaInicio: true,
  fechaFin: true,
  estado: true,
} as const

/** Proyecta la fila interna al contrato público. */
export function toAnioAcademicoResponse(
  fila: AnioAcademicoRow,
): AnioAcademicoResponse {
  return {
    id: fila.id,
    nombre: fila.nombre,
    fechaInicio: fila.fechaInicio,
    fechaFin: fila.fechaFin,
    estado: fila.estado,
  }
}

interface FilaCruda {
  id: string
  institucionId: string
  nombre: string
  fechaInicio: Date
  fechaFin: Date
  estado: string
}

function mapear(fila: FilaCruda): AnioAcademicoRow {
  return {
    id: fila.id,
    institucionId: fila.institucionId,
    nombre: fila.nombre,
    fechaInicio: aFechaISO(fila.fechaInicio),
    fechaFin: aFechaISO(fila.fechaFin),
    estado: estadoAnioAcademicoSchema.parse(fila.estado),
  }
}

/** Cuenta los años vigentes de la institución para la paginación. */
export async function countAniosAcademicos(
  prisma: PrismaClient,
  institucionId: string,
): Promise<number> {
  return prisma.anioAcademico.count({
    where: { institucionId, deletedAt: null },
  })
}

/**
 * Lista los años vigentes ordenados del más reciente al más antiguo.
 *
 * El orden incluye `id` como desempate para que la paginación sea estable
 * cuando dos años comparten fecha de inicio.
 */
export async function findAniosAcademicos(
  prisma: PrismaClient,
  institucionId: string,
  paginacion: PaginationInput,
): Promise<AnioAcademicoResponse[]> {
  const filas = await prisma.anioAcademico.findMany({
    where: { institucionId, deletedAt: null },
    orderBy: [
      { fechaInicio: 'desc' },
      { nombre: 'desc' },
      { id: 'asc' },
    ],
    skip: (paginacion.page - 1) * paginacion.pageSize,
    take: paginacion.pageSize,
    select: CAMPOS,
  })

  return filas.map((fila) => toAnioAcademicoResponse(mapear(fila)))
}

/** Busca un año vigente por identificador. */
export async function findAnioAcademicoPorId(
  prisma: PrismaClient,
  id: string,
): Promise<AnioAcademicoRow | null> {
  const fila = await prisma.anioAcademico.findFirst({
    where: { id, deletedAt: null },
    select: CAMPOS,
  })

  return fila ? mapear(fila) : null
}

export interface CrearAnioAcademicoData {
  institucionId: string
  nombre: string
  fechaInicio: string
  fechaFin: string
  createdBy: string
}

/** Crea un año en estado `PLANIFICADO`. */
export async function createAnioAcademico(
  prisma: PrismaClient,
  datos: CrearAnioAcademicoData,
): Promise<AnioAcademicoRow> {
  const fila = await prisma.anioAcademico.create({
    data: {
      institucionId: datos.institucionId,
      nombre: datos.nombre,
      fechaInicio: aFechaUTC(datos.fechaInicio),
      fechaFin: aFechaUTC(datos.fechaFin),
      estado: 'PLANIFICADO',
      createdBy: datos.createdBy,
    },
    select: CAMPOS,
  })

  return mapear(fila)
}

export interface ActualizarAnioAcademicoData {
  nombre?: string
  fechaInicio?: string
  fechaFin?: string
  updatedBy: string
}

/** Actualiza solo los campos enviados. */
export async function updateAnioAcademico(
  prisma: PrismaClient,
  id: string,
  datos: ActualizarAnioAcademicoData,
): Promise<AnioAcademicoRow> {
  const fila = await prisma.anioAcademico.update({
    where: { id },
    data: {
      ...(datos.nombre !== undefined ? { nombre: datos.nombre } : {}),
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
 * Activa un año y cierra el que estuviera activo en la misma transacción
 * (RN-CORE-002, RF-CORE-008).
 *
 * MySQL no tiene índices parciales, así que la unicidad no puede expresarse
 * como constraint. El `SELECT ... FOR UPDATE` sobre la institución serializa
 * las activaciones concurrentes: la segunda espera a que la primera confirme
 * y luego cierra el año que esta dejó activo. Sin ese bloqueo, dos
 * transacciones que no vieran ningún año activo podrían activar dos a la vez.
 *
 * @param prisma Cliente inyectable para las pruebas.
 * @param fila Año vigente que se desea activar.
 * @param usuarioId Usuario que ejecuta la activación.
 */
export async function activarAnioAcademicoRecord(
  prisma: PrismaClient,
  fila: AnioAcademicoRow,
  usuarioId: string,
): Promise<AnioAcademicoRow> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM institucion WHERE id = ${fila.institucionId} FOR UPDATE`

    await tx.anioAcademico.updateMany({
      where: {
        institucionId: fila.institucionId,
        estado: 'ACTIVO',
        id: { not: fila.id },
        deletedAt: null,
      },
      data: { estado: 'CERRADO', updatedBy: usuarioId },
    })

    const actualizado = await tx.anioAcademico.update({
      where: { id: fila.id },
      data: { estado: 'ACTIVO', updatedBy: usuarioId },
      select: CAMPOS,
    })

    return mapear(actualizado)
  })
}
