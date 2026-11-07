import type { DocenteResponse, PaginationInput } from '@intranet/shared'
import type { Prisma } from '../../../generated/prisma/client.js'
import {
  CAMPOS_PERSONA,
  toPersonaResponse,
  type PersonaRow,
} from './persona.repository.js'

const CAMPOS_DOCENTE = {
  id: true,
  codigoDocente: true,
  especialidad: true,
  persona: { select: CAMPOS_PERSONA },
} as const

/** Fila interna de docente con su persona. */
export interface DocenteRow {
  id: string
  codigoDocente: string
  especialidad: string | null
  persona: PersonaRow
}

/** Proyecta la fila interna al contrato público. */
export function toDocenteResponse(fila: DocenteRow): DocenteResponse {
  return {
    id: fila.id,
    codigoDocente: fila.codigoDocente,
    especialidad: fila.especialidad,
    persona: toPersonaResponse(fila.persona),
  }
}

/** Cuenta los docentes vigentes. */
export async function countDocentes(
  db: Prisma.TransactionClient,
): Promise<number> {
  return db.docente.count({ where: { deletedAt: null } })
}

/**
 * Lista los docentes vigentes ordenados por apellidos y nombres.
 *
 * `id` desempata para que la paginación sea estable.
 */
export async function findDocentes(
  db: Prisma.TransactionClient,
  paginacion: PaginationInput,
): Promise<DocenteRow[]> {
  return db.docente.findMany({
    where: { deletedAt: null },
    orderBy: [
      { persona: { apellidos: 'asc' } },
      { persona: { nombres: 'asc' } },
      { id: 'asc' },
    ],
    skip: (paginacion.page - 1) * paginacion.pageSize,
    take: paginacion.pageSize,
    select: CAMPOS_DOCENTE,
  })
}

/** Busca un docente vigente por identificador. */
export async function findDocentePorId(
  db: Prisma.TransactionClient,
  id: string,
): Promise<DocenteRow | null> {
  return db.docente.findFirst({
    where: { id, deletedAt: null },
    select: CAMPOS_DOCENTE,
  })
}

export interface CrearDocenteData {
  personaId: string
  codigoDocente: string
  especialidad?: string | null
  createdBy: string
}

/** Crea el registro de docente para una persona ya creada en la transacción. */
export async function createDocenteRecord(
  db: Prisma.TransactionClient,
  datos: CrearDocenteData,
): Promise<DocenteRow> {
  return db.docente.create({
    data: {
      personaId: datos.personaId,
      codigoDocente: datos.codigoDocente,
      especialidad: datos.especialidad ?? null,
      createdBy: datos.createdBy,
    },
    select: CAMPOS_DOCENTE,
  })
}

export interface ActualizarDocenteData {
  codigoDocente?: string
  especialidad?: string | null
  updatedBy: string
}

/** Actualiza solo los campos enviados del docente. */
export async function updateDocenteRecord(
  db: Prisma.TransactionClient,
  id: string,
  datos: ActualizarDocenteData,
): Promise<DocenteRow> {
  return db.docente.update({
    where: { id },
    data: {
      ...(datos.codigoDocente !== undefined
        ? { codigoDocente: datos.codigoDocente }
        : {}),
      ...(datos.especialidad !== undefined
        ? { especialidad: datos.especialidad }
        : {}),
      updatedBy: datos.updatedBy,
    },
    select: CAMPOS_DOCENTE,
  })
}
