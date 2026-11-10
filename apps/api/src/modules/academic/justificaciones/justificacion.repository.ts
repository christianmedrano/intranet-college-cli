import {
  estadoJustificacionSchema,
  type JustificacionResponse,
  type PaginationInput,
} from '@intranet/shared'
import type { Prisma } from '../../../generated/prisma/client.js'

const CAMPOS_JUSTIFICACION = {
  id: true,
  asistenciaId: true,
  solicitanteUsuarioId: true,
  motivo: true,
  estado: true,
  resueltoPor: true,
  resueltoEn: true,
  motivoResolucion: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.JustificacionFaltaSelect

interface FilaJustificacion {
  id: string
  asistenciaId: string
  solicitanteUsuarioId: string
  motivo: string
  estado: string
  resueltoPor: string | null
  resueltoEn: Date | null
  motivoResolucion: string | null
  createdAt: Date
  updatedAt: Date
}

/** Proyecta la fila interna al contrato público. */
function mapear(fila: FilaJustificacion): JustificacionResponse {
  return {
    id: fila.id,
    asistenciaId: fila.asistenciaId,
    solicitanteUsuarioId: fila.solicitanteUsuarioId,
    motivo: fila.motivo,
    estado: estadoJustificacionSchema.parse(fila.estado),
    resueltoPor: fila.resueltoPor,
    resueltoEn: fila.resueltoEn?.toISOString() ?? null,
    motivoResolucion: fila.motivoResolucion,
    createdAt: fila.createdAt.toISOString(),
    updatedAt: fila.updatedAt.toISOString(),
  }
}

/** Cuenta las justificaciones que cumplen la condición de alcance. */
export async function countJustificaciones(
  prisma: Prisma.TransactionClient,
  where: Prisma.JustificacionFaltaWhereInput,
): Promise<number> {
  return prisma.justificacionFalta.count({ where })
}

/**
 * Lista las justificaciones de la condición, de la más reciente a la más
 * antigua. `id` desempata para que la paginación sea estable.
 */
export async function findJustificaciones(
  prisma: Prisma.TransactionClient,
  where: Prisma.JustificacionFaltaWhereInput,
  paginacion: PaginationInput,
): Promise<JustificacionResponse[]> {
  const filas = await prisma.justificacionFalta.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    skip: (paginacion.page - 1) * paginacion.pageSize,
    take: paginacion.pageSize,
    select: CAMPOS_JUSTIFICACION,
  })

  return filas.map(mapear)
}

/** Fila mínima de una justificación para validar su estado y alcance. */
export interface JustificacionRow {
  id: string
  asistenciaId: string
  solicitanteUsuarioId: string
  estado: string
  motivo: string
  motivoResolucion: string | null
}

/** Busca una justificación vigente por identificador. */
export async function findJustificacionPorId(
  prisma: Prisma.TransactionClient,
  id: string,
): Promise<JustificacionRow | null> {
  return prisma.justificacionFalta.findFirst({
    where: { id },
    select: {
      id: true,
      asistenciaId: true,
      solicitanteUsuarioId: true,
      estado: true,
      motivo: true,
      motivoResolucion: true,
    },
  })
}

/** Indica si la asistencia ya tiene una solicitud en estado `SOLICITADA`. */
export async function existeSolicitudAbierta(
  prisma: Prisma.TransactionClient,
  asistenciaId: string,
): Promise<boolean> {
  const fila = await prisma.justificacionFalta.findFirst({
    where: { asistenciaId, estado: 'SOLICITADA' },
    select: { id: true },
  })

  return fila !== null
}

export interface CrearJustificacionData {
  asistenciaId: string
  solicitanteUsuarioId: string
  motivo: string
}

/** Crea la solicitud de justificación en estado `SOLICITADA`. */
export async function createJustificacion(
  prisma: Prisma.TransactionClient,
  datos: CrearJustificacionData,
): Promise<JustificacionResponse> {
  const fila = await prisma.justificacionFalta.create({
    data: {
      asistenciaId: datos.asistenciaId,
      solicitanteUsuarioId: datos.solicitanteUsuarioId,
      motivo: datos.motivo,
    },
    select: CAMPOS_JUSTIFICACION,
  })

  return mapear(fila)
}

export interface ResolverJustificacionData {
  id: string
  estado: 'APROBADA' | 'RECHAZADA'
  resueltoPor: string
  resueltoEn: Date
  motivoResolucion?: string
}

/** Cierra la solicitud con su resolución. */
export async function resolverJustificacion(
  prisma: Prisma.TransactionClient,
  datos: ResolverJustificacionData,
): Promise<JustificacionResponse> {
  const fila = await prisma.justificacionFalta.update({
    where: { id: datos.id },
    data: {
      estado: datos.estado,
      resueltoPor: datos.resueltoPor,
      resueltoEn: datos.resueltoEn,
      motivoResolucion: datos.motivoResolucion ?? null,
    },
    select: CAMPOS_JUSTIFICACION,
  })

  return mapear(fila)
}

/**
 * Indica si el usuario es docente tutor (`es_tutor = true`) de la sección y el
 * año indicados (RN-ACAD-012, RN-ACAD-025).
 */
export async function esTutorDeSeccion(
  prisma: Prisma.TransactionClient,
  usuarioId: string,
  seccionId: string,
  anioId: string,
): Promise<boolean> {
  const asignacion = await prisma.asignacionDocente.findFirst({
    where: {
      seccionId,
      anioId,
      esTutor: true,
      docente: {
        deletedAt: null,
        persona: {
          usuario: { id: usuarioId, activo: true, deletedAt: null },
        },
      },
    },
    select: { id: true },
  })

  return asignacion !== null
}
