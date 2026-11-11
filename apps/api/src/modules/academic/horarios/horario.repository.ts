import {
  diaSemanaSchema,
  type HorarioResponse,
  type PaginationInput,
} from '@intranet/shared'
import type { Prisma } from '../../../generated/prisma/client.js'

const CAMPOS_HORARIO = {
  id: true,
  anioId: true,
  seccionId: true,
  cursoId: true,
  docenteId: true,
  diaSemana: true,
  horaInicio: true,
  horaFin: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.HorarioSelect

interface FilaHorario {
  id: string
  anioId: string
  seccionId: string
  cursoId: string
  docenteId: string | null
  diaSemana: number
  horaInicio: string
  horaFin: string
  createdAt: Date
  updatedAt: Date
}

/** Proyecta la fila interna al contrato público. */
function mapear(fila: FilaHorario): HorarioResponse {
  return {
    id: fila.id,
    anioId: fila.anioId,
    seccionId: fila.seccionId,
    cursoId: fila.cursoId,
    docenteId: fila.docenteId,
    diaSemana: diaSemanaSchema.parse(fila.diaSemana),
    horaInicio: fila.horaInicio,
    horaFin: fila.horaFin,
    createdAt: fila.createdAt.toISOString(),
    updatedAt: fila.updatedAt.toISOString(),
  }
}

/** Fila mínima de un horario para validar cambios. */export interface HorarioRow {
  id: string
  anioId: string
  seccionId: string
  cursoId: string
  docenteId: string | null
  diaSemana: number
  horaInicio: string
  horaFin: string
}

/** Busca un horario vigente por identificador. */
export async function findHorarioPorId(
  prisma: Prisma.TransactionClient,
  id: string,
): Promise<HorarioRow | null> {
  return prisma.horario.findFirst({
    where: { id, deletedAt: null },
    select: {
      id: true,
      anioId: true,
      seccionId: true,
      cursoId: true,
      docenteId: true,
      diaSemana: true,
      horaInicio: true,
      horaFin: true,
    },
  })
}

/** Cuenta los horarios que cumplen la condición de alcance. */
export async function countHorarios(
  prisma: Prisma.TransactionClient,
  where: Prisma.HorarioWhereInput,
): Promise<number> {
  return prisma.horario.count({ where })
}

/**
 * Lista los horarios de la condición, ordenados por día y hora de inicio.
 * `id` desempata para que la paginación sea estable.
 */
export async function findHorarios(
  prisma: Prisma.TransactionClient,
  where: Prisma.HorarioWhereInput,
  paginacion: PaginationInput,
): Promise<HorarioResponse[]> {
  const filas = await prisma.horario.findMany({
    where,
    orderBy: [{ diaSemana: 'asc' }, { horaInicio: 'asc' }, { id: 'asc' }],
    skip: (paginacion.page - 1) * paginacion.pageSize,
    take: paginacion.pageSize,
    select: CAMPOS_HORARIO,
  })

  return filas.map(mapear)
}

/** Sección mínima para validar año y nivel (RN-ACAD-018). */
export interface SeccionParaHorario {
  id: string
  anioId: string
  nivelId: string
}

/** Busca una sección vigente con el nivel de su grado. */
export async function findSeccionParaHorario(
  prisma: Prisma.TransactionClient,
  seccionId: string,
): Promise<SeccionParaHorario | null> {
  const fila = await prisma.seccion.findFirst({
    where: {
      id: seccionId,
      deletedAt: null,
      anio: { deletedAt: null },
    },
    select: {
      id: true,
      anioId: true,
      grado: { select: { nivelId: true } },
    },
  })

  if (!fila) {
    return null
  }

  return {
    id: fila.id,
    anioId: fila.anioId,
    nivelId: fila.grado.nivelId,
  }
}

/** Busca un curso vigente y devuelve su nivel. */
export async function findCursoParaHorario(
  prisma: Prisma.TransactionClient,
  cursoId: string,
): Promise<{ id: string; nivelId: string } | null> {
  return prisma.curso.findFirst({
    where: { id: cursoId, deletedAt: null },
    select: { id: true, nivelId: true },
  })
}

/** Indica si el docente existe y está vigente. */
export async function existeDocente(
  prisma: Prisma.TransactionClient,
  docenteId: string,
): Promise<boolean> {
  const fila = await prisma.docente.findFirst({
    where: { id: docenteId, deletedAt: null },
    select: { id: true },
  })

  return fila !== null
}

/** Indica si el docente tiene asignación en curso, sección y año (RN-ACAD-018). */
export async function existeAsignacionDocente(
  prisma: Prisma.TransactionClient,
  docenteId: string,
  cursoId: string,
  seccionId: string,
  anioId: string,
): Promise<boolean> {
  const fila = await prisma.asignacionDocente.findFirst({
    where: {
      docenteId,
      cursoId,
      seccionId,
      anioId,
      docente: { deletedAt: null },
    },
    select: { id: true },
  })

  return fila !== null
}

interface BloqueHorario {
  anioId: string
  diaSemana: number
  horaInicio: string
  horaFin: string
}

/**
 * Indica si otro bloque de la sección se solapa en el mismo año y día
 * (RN-ACAD-017).
 *
 * @param excluirId Horario que se está editando, para no compararlo consigo
 * mismo.
 */
export async function existeSolapamientoSeccion(
  prisma: Prisma.TransactionClient,
  seccionId: string,
  bloque: BloqueHorario,
  excluirId?: string,
): Promise<boolean> {
  const fila = await prisma.horario.findFirst({
    where: {
      seccionId,
      anioId: bloque.anioId,
      diaSemana: bloque.diaSemana,
      deletedAt: null,
      ...(excluirId ? { id: { not: excluirId } } : {}),
      horaInicio: { lt: bloque.horaFin },
      horaFin: { gt: bloque.horaInicio },
    },
    select: { id: true },
  })

  return fila !== null
}

/**
 * Indica si el docente tiene otro bloque solapado en cualquier sección del
 * mismo año y día (RN-ACAD-017).
 *
 * @param excluirId Horario que se está editando.
 */
export async function existeSolapamientoDocente(
  prisma: Prisma.TransactionClient,
  docenteId: string,
  bloque: BloqueHorario,
  excluirId?: string,
): Promise<boolean> {
  const fila = await prisma.horario.findFirst({
    where: {
      docenteId,
      anioId: bloque.anioId,
      diaSemana: bloque.diaSemana,
      deletedAt: null,
      ...(excluirId ? { id: { not: excluirId } } : {}),
      horaInicio: { lt: bloque.horaFin },
      horaFin: { gt: bloque.horaInicio },
    },
    select: { id: true },
  })

  return fila !== null
}

/**
 * Bloquea la fila de la sección hasta el final de la transacción.
 *
 * Serializa las comprobaciones de solapamiento de una misma sección para que
 * dos peticiones concurrentes no reserven el mismo rango (RN-ACAD-017).
 */
export async function bloquearSeccion(
  prisma: Prisma.TransactionClient,
  seccionId: string,
): Promise<void> {
  await prisma.$queryRaw`SELECT id FROM seccion WHERE id = ${seccionId} FOR UPDATE`
}

/**
 * Bloquea la fila del docente hasta el final de la transacción.
 *
 * Serializa las comprobaciones de solapamiento de un mismo docente entre
 * secciones distintas (RN-ACAD-017).
 */
export async function bloquearDocente(
  prisma: Prisma.TransactionClient,
  docenteId: string,
): Promise<void> {
  await prisma.$queryRaw`SELECT id FROM docente WHERE id = ${docenteId} FOR UPDATE`
}

export interface CrearHorarioData {
  anioId: string
  seccionId: string
  cursoId: string
  docenteId?: string
  diaSemana: number
  horaInicio: string
  horaFin: string
  createdBy: string
}

/** Crea un bloque de horario vigente. */
export async function createHorario(
  prisma: Prisma.TransactionClient,
  datos: CrearHorarioData,
): Promise<HorarioResponse> {
  const fila = await prisma.horario.create({
    data: {
      anioId: datos.anioId,
      seccionId: datos.seccionId,
      cursoId: datos.cursoId,
      docenteId: datos.docenteId ?? null,
      diaSemana: datos.diaSemana,
      horaInicio: datos.horaInicio,
      horaFin: datos.horaFin,
      createdBy: datos.createdBy,
    },
    select: CAMPOS_HORARIO,
  })

  return mapear(fila)
}

export interface ActualizarHorarioData {
  id: string
  anioId: string
  seccionId: string
  cursoId: string
  docenteId: string | null
  diaSemana: number
  horaInicio: string
  horaFin: string
  updatedBy: string
}

/** Actualiza el bloque completo y devuelve el contrato público. */
export async function updateHorario(
  prisma: Prisma.TransactionClient,
  datos: ActualizarHorarioData,
): Promise<HorarioResponse> {
  const fila = await prisma.horario.update({
    where: { id: datos.id },
    data: {
      anioId: datos.anioId,
      seccionId: datos.seccionId,
      cursoId: datos.cursoId,
      docenteId: datos.docenteId,
      diaSemana: datos.diaSemana,
      horaInicio: datos.horaInicio,
      horaFin: datos.horaFin,
      updatedBy: datos.updatedBy,
    },
    select: CAMPOS_HORARIO,
  })

  return mapear(fila)
}

/** Marca el bloque como eliminado sin borrarlo físicamente (RN-ACAD-020). */
export async function softDeleteHorario(
  prisma: Prisma.TransactionClient,
  id: string,
  updatedBy: string,
): Promise<void> {
  await prisma.horario.update({
    where: { id },
    data: { deletedAt: new Date(), updatedBy },
  })
}
