import type { AlumnoResponse, PaginationInput } from '@intranet/shared'
import type { Prisma } from '../../../generated/prisma/client.js'
import { aFechaISO, aFechaUTC } from '../estructura/fechas.js'
import {
  CAMPOS_PERSONA,
  toPersonaResponse,
  type PersonaRow,
} from './persona.repository.js'

const CAMPOS_VINCULO_APODERADO = {
  apoderadoId: true,
  parentesco: true,
  esPrincipal: true,
  apoderado: {
    select: {
      persona: { select: CAMPOS_PERSONA },
    },
  },
} as const

const CAMPOS_ALUMNO = {
  id: true,
  codigoAlumno: true,
  fechaIngreso: true,
  observaciones: true,
  persona: { select: CAMPOS_PERSONA },
  apoderados: {
    where: { apoderado: { deletedAt: null } },
    orderBy: [{ esPrincipal: 'desc' }, { createdAt: 'asc' }],
    select: CAMPOS_VINCULO_APODERADO,
  },
} satisfies Prisma.AlumnoSelect

/** Fila interna de alumno con la persona y sus vínculos vigentes. */
export interface AlumnoRow {
  id: string
  codigoAlumno: string
  fechaIngreso: Date | null
  observaciones: string | null
  persona: PersonaRow
  apoderados: Array<{
    apoderadoId: string
    parentesco: string
    esPrincipal: boolean
    apoderado: { persona: PersonaRow }
  }>
}

/** Proyecta la fila interna al contrato público. */
export function toAlumnoResponse(fila: AlumnoRow): AlumnoResponse {
  return {
    id: fila.id,
    codigoAlumno: fila.codigoAlumno,
    fechaIngreso: fila.fechaIngreso ? aFechaISO(fila.fechaIngreso) : null,
    observaciones: fila.observaciones,
    persona: toPersonaResponse(fila.persona),
    apoderados: fila.apoderados.map((vinculo) => ({
      apoderadoId: vinculo.apoderadoId,
      parentesco: vinculo.parentesco,
      esPrincipal: vinculo.esPrincipal,
      apoderado: toPersonaResponse(vinculo.apoderado.persona),
    })),
  }
}

/** Cuenta los alumnos vigentes. */
export async function countAlumnos(
  db: Prisma.TransactionClient,
): Promise<number> {
  return db.alumno.count({ where: { deletedAt: null } })
}

/**
 * Lista los alumnos vigentes ordenados por apellidos y nombres.
 *
 * `id` desempata para que la paginación sea estable.
 */
export async function findAlumnos(
  db: Prisma.TransactionClient,
  paginacion: PaginationInput,
): Promise<AlumnoRow[]> {
  return db.alumno.findMany({
    where: { deletedAt: null },
    orderBy: [
      { persona: { apellidos: 'asc' } },
      { persona: { nombres: 'asc' } },
      { id: 'asc' },
    ],
    skip: (paginacion.page - 1) * paginacion.pageSize,
    take: paginacion.pageSize,
    select: CAMPOS_ALUMNO,
  })
}

/** Busca un alumno vigente por identificador. */
export async function findAlumnoPorId(
  db: Prisma.TransactionClient,
  id: string,
): Promise<AlumnoRow | null> {
  return db.alumno.findFirst({
    where: { id, deletedAt: null },
    select: CAMPOS_ALUMNO,
  })
}

export interface CrearAlumnoData {
  personaId: string
  codigoAlumno: string
  fechaIngreso?: string | null
  observaciones?: string | null
  createdBy: string
}

/** Crea el registro de alumno para una persona ya creada en la transacción. */
export async function createAlumnoRecord(
  db: Prisma.TransactionClient,
  datos: CrearAlumnoData,
): Promise<AlumnoRow> {
  return db.alumno.create({
    data: {
      personaId: datos.personaId,
      codigoAlumno: datos.codigoAlumno,
      fechaIngreso:
        datos.fechaIngreso === null || datos.fechaIngreso === undefined
          ? null
          : aFechaUTC(datos.fechaIngreso),
      observaciones: datos.observaciones ?? null,
      createdBy: datos.createdBy,
    },
    select: CAMPOS_ALUMNO,
  })
}

export interface ActualizarAlumnoData {
  codigoAlumno?: string
  fechaIngreso?: string | null
  observaciones?: string | null
  updatedBy: string
}

/** Actualiza solo los campos enviados del alumno. */
export async function updateAlumnoRecord(
  db: Prisma.TransactionClient,
  id: string,
  datos: ActualizarAlumnoData,
): Promise<AlumnoRow> {
  return db.alumno.update({
    where: { id },
    data: {
      ...(datos.codigoAlumno !== undefined
        ? { codigoAlumno: datos.codigoAlumno }
        : {}),
      ...(datos.fechaIngreso !== undefined
        ? {
            fechaIngreso: datos.fechaIngreso
              ? aFechaUTC(datos.fechaIngreso)
              : null,
          }
        : {}),
      ...(datos.observaciones !== undefined
        ? { observaciones: datos.observaciones }
        : {}),
      updatedBy: datos.updatedBy,
    },
    select: CAMPOS_ALUMNO,
  })
}
