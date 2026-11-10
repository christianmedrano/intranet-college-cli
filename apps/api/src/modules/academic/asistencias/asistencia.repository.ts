import {
  estadoAsistenciaSchema,
  type AsistenciaResponse,
} from '@intranet/shared'
import type { Prisma } from '../../../generated/prisma/client.js'
import { aFechaISO } from '../../core/estructura/fechas.js'

const CAMPOS_ASISTENCIA = {
  id: true,
  alumnoId: true,
  fecha: true,
  estado: true,
  observacion: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.AsistenciaSelect

interface FilaAsistencia {
  id: string
  alumnoId: string
  fecha: Date
  estado: string
  observacion: string | null
  createdAt: Date
  updatedAt: Date
}

/** Proyecta la fila interna al contrato público, con la fecha escolar. */
function mapear(fila: FilaAsistencia): AsistenciaResponse {
  return {
    id: fila.id,
    alumnoId: fila.alumnoId,
    fecha: aFechaISO(fila.fecha),
    estado: estadoAsistenciaSchema.parse(fila.estado),
    observacion: fila.observacion,
    createdAt: fila.createdAt.toISOString(),
    updatedAt: fila.updatedAt.toISOString(),
  }
}

/** Sección mínima para registrar la asistencia del día. */
export interface SeccionParaAsistencia {
  id: string
  anioId: string
  fechaInicio: string
  fechaFin: string
}

/**
 * Busca una sección vigente de la institución con el rango de su año.
 *
 * @returns `null` si la sección no existe o pertenece a otra institución.
 */
export async function findSeccionParaAsistencia(
  prisma: Prisma.TransactionClient,
  seccionId: string,
  institucionId: string,
): Promise<SeccionParaAsistencia | null> {
  const fila = await prisma.seccion.findFirst({
    where: {
      id: seccionId,
      deletedAt: null,
      anio: { institucionId, deletedAt: null },
    },
    select: {
      id: true,
      anioId: true,
      anio: { select: { fechaInicio: true, fechaFin: true } },
    },
  })

  if (!fila) {
    return null
  }

  return {
    id: fila.id,
    anioId: fila.anioId,
    fechaInicio: aFechaISO(fila.anio.fechaInicio),
    fechaFin: aFechaISO(fila.anio.fechaFin),
  }
}

/**
 * Devuelve los identificadores de los alumnos con matrícula `APROBADA` en la
 * sección y año indicados (RN-ACAD-008).
 */
export async function findAlumnosMatriculados(
  prisma: Prisma.TransactionClient,
  alumnoIds: readonly string[],
  seccionId: string,
  anioId: string,
): Promise<Set<string>> {
  const filas = await prisma.matricula.findMany({
    where: {
      alumnoId: { in: [...alumnoIds] },
      seccionId,
      anioId,
      estado: 'APROBADA',
      deletedAt: null,
    },
    select: { alumnoId: true },
  })

  return new Set(filas.map((fila) => fila.alumnoId))
}

export interface CrearAsistenciaData {
  alumnoId: string
  fecha: Date
  estado: string
  observacion?: string
  createdBy: string
}

/** Crea los registros de asistencia del lote dentro de la transacción. */
export async function createAsistencias(
  prisma: Prisma.TransactionClient,
  datos: readonly CrearAsistenciaData[],
): Promise<AsistenciaResponse[]> {
  const filas: AsistenciaResponse[] = []

  for (const dato of datos) {
    const fila = await prisma.asistencia.create({
      data: {
        alumnoId: dato.alumnoId,
        fecha: dato.fecha,
        estado: dato.estado,
        observacion: dato.observacion ?? null,
        createdBy: dato.createdBy,
      },
      select: CAMPOS_ASISTENCIA,
    })

    filas.push(mapear(fila))
  }

  return filas
}

/** Fila mínima de una asistencia para validar alcance y auditar cambios. */
export interface AsistenciaRow {
  id: string
  alumnoId: string
  fecha: Date
  estado: string
  observacion: string | null
}

/** Busca una asistencia vigente con su alumno vigente. */
export async function findAsistenciaPorId(
  prisma: Prisma.TransactionClient,
  id: string,
): Promise<AsistenciaRow | null> {
  return prisma.asistencia.findFirst({
    where: { id, deletedAt: null, alumno: { deletedAt: null } },
    select: {
      id: true,
      alumnoId: true,
      fecha: true,
      estado: true,
      observacion: true,
    },
  })
}

/** Matrícula que cubre la fecha de la asistencia. */
export interface MatriculaVigente {
  seccionId: string
  anioId: string
}

/**
 * Resuelve la sección y el año de la matrícula `APROBADA` que cubre la fecha
 * escolar indicada.
 *
 * @returns `null` si el alumno no tiene matrícula aprobada en ese rango.
 */
export async function findMatriculaAprobadaPorFecha(
  prisma: Prisma.TransactionClient,
  alumnoId: string,
  fecha: Date,
): Promise<MatriculaVigente | null> {
  return prisma.matricula.findFirst({
    where: {
      alumnoId,
      estado: 'APROBADA',
      deletedAt: null,
      anio: {
        fechaInicio: { lte: fecha },
        fechaFin: { gte: fecha },
        deletedAt: null,
      },
    },
    select: { seccionId: true, anioId: true },
  })
}

export interface ActualizarAsistenciaData {
  id: string
  estado?: string
  observacion?: string
  updatedBy: string
}

/** Actualiza solo los campos enviados y devuelve la asistencia completa. */
export async function updateAsistencia(
  prisma: Prisma.TransactionClient,
  datos: ActualizarAsistenciaData,
): Promise<AsistenciaResponse> {
  const fila = await prisma.asistencia.update({
    where: { id: datos.id },
    data: {
      ...(datos.estado !== undefined ? { estado: datos.estado } : {}),
      ...(datos.observacion !== undefined
        ? { observacion: datos.observacion }
        : {}),
      updatedBy: datos.updatedBy,
    },
    select: CAMPOS_ASISTENCIA,
  })

  return mapear(fila)
}
