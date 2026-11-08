import type {
  ApoderadoResponse,
  PaginationInput,
  VinculoAlumnoResponse,
} from '@intranet/shared'
import { AppError } from '../../../core/errors.js'
import type { Prisma } from '../../../generated/prisma/client.js'
import {
  CAMPOS_PERSONA,
  toPersonaResponse,
  type PersonaRow,
} from './persona.repository.js'

const CAMPOS_VINCULO_ALUMNO = {
  alumnoId: true,
  parentesco: true,
  esPrincipal: true,
  alumno: {
    select: {
      id: true,
      codigoAlumno: true,
      persona: { select: CAMPOS_PERSONA },
    },
  },
} as const

const CAMPOS_APODERADO = {
  id: true,
  ocupacion: true,
  persona: { select: CAMPOS_PERSONA },
  alumnos: {
    where: { alumno: { deletedAt: null } },
    orderBy: [{ esPrincipal: 'desc' }, { createdAt: 'asc' }],
    select: CAMPOS_VINCULO_ALUMNO,
  },
} satisfies Prisma.ApoderadoSelect

/** Fila interna de apoderado con su persona y sus alumnos vigentes. */
export interface ApoderadoRow {
  id: string
  ocupacion: string | null
  persona: PersonaRow
  alumnos: Array<{
    alumnoId: string
    parentesco: string
    esPrincipal: boolean
    alumno: {
      id: string
      codigoAlumno: string
      persona: PersonaRow
    }
  }>
}

/** Proyecta la fila interna al contrato público. */
export function toApoderadoResponse(fila: ApoderadoRow): ApoderadoResponse {
  return {
    id: fila.id,
    ocupacion: fila.ocupacion,
    persona: toPersonaResponse(fila.persona),
    alumnos: fila.alumnos.map((vinculo) => ({
      alumnoId: vinculo.alumnoId,
      parentesco: vinculo.parentesco,
      esPrincipal: vinculo.esPrincipal,
      alumno: {
        id: vinculo.alumno.id,
        codigoAlumno: vinculo.alumno.codigoAlumno,
        persona: toPersonaResponse(vinculo.alumno.persona),
      },
    })),
  }
}

/** Cuenta los apoderados vigentes. */
export async function countApoderados(
  db: Prisma.TransactionClient,
): Promise<number> {
  return db.apoderado.count({ where: { deletedAt: null } })
}

/**
 * Lista los apoderados vigentes ordenados por apellidos y nombres.
 *
 * `id` desempata para que la paginación sea estable.
 */
export async function findApoderados(
  db: Prisma.TransactionClient,
  paginacion: PaginationInput,
): Promise<ApoderadoRow[]> {
  return db.apoderado.findMany({
    where: { deletedAt: null },
    orderBy: [
      { persona: { apellidos: 'asc' } },
      { persona: { nombres: 'asc' } },
      { id: 'asc' },
    ],
    skip: (paginacion.page - 1) * paginacion.pageSize,
    take: paginacion.pageSize,
    select: CAMPOS_APODERADO,
  })
}

/** Busca un apoderado vigente por identificador. */
export async function findApoderadoPorId(
  db: Prisma.TransactionClient,
  id: string,
): Promise<ApoderadoRow | null> {
  return db.apoderado.findFirst({
    where: { id, deletedAt: null },
    select: CAMPOS_APODERADO,
  })
}

export interface CrearApoderadoData {
  personaId: string
  ocupacion?: string | null
  createdBy: string
}

/** Crea el registro de apoderado para una persona ya creada en la transacción. */
export async function createApoderadoRecord(
  db: Prisma.TransactionClient,
  datos: CrearApoderadoData,
): Promise<ApoderadoRow> {
  return db.apoderado.create({
    data: {
      personaId: datos.personaId,
      ocupacion: datos.ocupacion ?? null,
      createdBy: datos.createdBy,
    },
    select: CAMPOS_APODERADO,
  })
}

export interface ActualizarApoderadoData {
  ocupacion?: string | null
  updatedBy: string
}

/** Actualiza solo los campos enviados del apoderado. */
export async function updateApoderadoRecord(
  db: Prisma.TransactionClient,
  id: string,
  datos: ActualizarApoderadoData,
): Promise<ApoderadoRow> {
  return db.apoderado.update({
    where: { id },
    data: {
      ...(datos.ocupacion !== undefined ? { ocupacion: datos.ocupacion } : {}),
      updatedBy: datos.updatedBy,
    },
    select: CAMPOS_APODERADO,
  })
}

const CAMPOS_VINCULO = {
  apoderadoId: true,
  alumnoId: true,
  parentesco: true,
  esPrincipal: true,
} as const

export interface VincularAlumnoData {
  apoderadoId: string
  alumnoId: string
  parentesco: string
  esPrincipal: boolean
  createdBy: string
}

/** Resultado de la vinculación: el vínculo y si se creó en esta petición. */
export interface ResultadoVinculo {
  vinculo: VinculoAlumnoResponse
  creado: boolean
}

/**
 * Vincula un alumno a un apoderado garantizando un solo principal por alumno
 * (RF-CORE-014, RN-CORE-008).
 *
 * MySQL no tiene índices parciales, así que la unicidad del principal no puede
 * expresarse como constraint. El `SELECT ... FOR UPDATE` sobre la fila del
 * alumno serializa las vinculaciones concurrentes: la segunda espera a que la
 * primera confirme y luego desmarca el principal anterior. Sin ese bloqueo,
 * dos peticiones simultáneas podrían dejar dos principales.
 *
 * Si el vínculo ya existe se actualiza (parentesco y, opcionalmente, el flag
 * de principal) en lugar de duplicarlo. Un principal existente nunca se
 * desmarca implícitamente: enviar `esPrincipal: false` no lo degrada.
 *
 * @throws AppError `NOT_FOUND` si el alumno no existe o tiene borrado lógico.
 */
export async function vincularAlumnoRecord(
  tx: Prisma.TransactionClient,
  datos: VincularAlumnoData,
): Promise<ResultadoVinculo> {
  const filas = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM alumno
    WHERE id = ${datos.alumnoId} AND deleted_at IS NULL
    FOR UPDATE
  `

  if (filas.length === 0) {
    throw new AppError('NOT_FOUND', 'El alumno no existe.')
  }

  if (datos.esPrincipal) {
    await tx.apoderadoAlumno.updateMany({
      where: {
        alumnoId: datos.alumnoId,
        apoderadoId: { not: datos.apoderadoId },
      },
      data: { esPrincipal: false },
    })
  }

  const clave = {
    apoderadoId_alumnoId: {
      apoderadoId: datos.apoderadoId,
      alumnoId: datos.alumnoId,
    },
  }

  const existente = await tx.apoderadoAlumno.findUnique({
    where: clave,
    select: { esPrincipal: true },
  })

  if (existente) {
    const vinculo = await tx.apoderadoAlumno.update({
      where: clave,
      data: {
        parentesco: datos.parentesco,
        ...(datos.esPrincipal ? { esPrincipal: true } : {}),
      },
      select: CAMPOS_VINCULO,
    })

    return { vinculo, creado: false }
  }

  const vinculo = await tx.apoderadoAlumno.create({
    data: {
      apoderadoId: datos.apoderadoId,
      alumnoId: datos.alumnoId,
      parentesco: datos.parentesco,
      esPrincipal: datos.esPrincipal,
      createdBy: datos.createdBy,
    },
    select: CAMPOS_VINCULO,
  })

  return { vinculo, creado: true }
}
