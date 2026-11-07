import type {
  AsignacionDocenteResponse,
  PaginationInput,
} from '@intranet/shared'
import type { Prisma, PrismaClient } from '../../../generated/prisma/client.js'
import {
  CAMPOS_PERSONA,
  toPersonaResponse,
  type PersonaRow,
} from '../personas/persona.repository.js'

const CAMPOS_ASIGNACION = {
  id: true,
  docenteId: true,
  cursoId: true,
  seccionId: true,
  anioId: true,
  docente: {
    select: {
      id: true,
      codigoDocente: true,
      persona: { select: CAMPOS_PERSONA },
    },
  },
  curso: {
    select: {
      id: true,
      nombre: true,
      nivelId: true,
    },
  },
  seccion: {
    select: {
      id: true,
      nombre: true,
      gradoId: true,
    },
  },
  anio: {
    select: {
      id: true,
      nombre: true,
    },
  },
} satisfies Prisma.AsignacionDocenteSelect

interface FilaCruda {
  id: string
  docenteId: string
  cursoId: string
  seccionId: string
  anioId: string
  docente: {
    id: string
    codigoDocente: string
    persona: PersonaRow
  }
  curso: {
    id: string
    nombre: string
    nivelId: string
  }
  seccion: {
    id: string
    nombre: string
    gradoId: string
  }
  anio: {
    id: string
    nombre: string
  }
}

/** Proyecta la fila interna al contrato público. */
function mapear(fila: FilaCruda): AsignacionDocenteResponse {
  return {
    id: fila.id,
    docenteId: fila.docenteId,
    cursoId: fila.cursoId,
    seccionId: fila.seccionId,
    anioId: fila.anioId,
    docente: {
      id: fila.docente.id,
      codigoDocente: fila.docente.codigoDocente,
      persona: toPersonaResponse(fila.docente.persona),
    },
    curso: fila.curso,
    seccion: fila.seccion,
    anio: fila.anio,
  }
}

/**
 * Condición de alcance institucional.
 *
 * `AsignacionDocente` se acota por el nivel del curso, el nivel del grado de la
 * sección y el año, además de exigir que todas las fichas estén vigentes.
 */
function alcanceDeInstitucion(institucionId: string) {
  return {
    docente: { deletedAt: null },
    curso: {
      deletedAt: null,
      nivel: { institucionId, deletedAt: null },
    },
    seccion: {
      deletedAt: null,
      grado: {
        deletedAt: null,
        nivel: { institucionId, deletedAt: null },
      },
    },
    anio: { institucionId, deletedAt: null },
  } as const
}

/** Filtros admitidos por el listado de asignaciones. */
export interface FiltrosAsignacionDocente {
  docenteId?: string
  cursoId?: string
  seccionId?: string
  anioId?: string
}

function whereDe(
  institucionId: string,
  filtros: FiltrosAsignacionDocente,
): Prisma.AsignacionDocenteWhereInput {
  return {
    ...alcanceDeInstitucion(institucionId),
    ...(filtros.docenteId !== undefined
      ? { docenteId: filtros.docenteId }
      : {}),
    ...(filtros.cursoId !== undefined ? { cursoId: filtros.cursoId } : {}),
    ...(filtros.seccionId !== undefined
      ? { seccionId: filtros.seccionId }
      : {}),
    ...(filtros.anioId !== undefined ? { anioId: filtros.anioId } : {}),
  }
}

/** Cuenta las asignaciones vigentes que cumplen los filtros. */
export async function countAsignacionesDocente(
  prisma: PrismaClient,
  institucionId: string,
  filtros: FiltrosAsignacionDocente,
): Promise<number> {
  return prisma.asignacionDocente.count({
    where: whereDe(institucionId, filtros),
  })
}

/**
 * Lista las asignaciones vigentes, de la más reciente a la más antigua.
 *
 * `id` desempata para que la paginación sea estable.
 */
export async function findAsignacionesDocente(
  prisma: PrismaClient,
  institucionId: string,
  filtros: FiltrosAsignacionDocente,
  paginacion: PaginationInput,
): Promise<AsignacionDocenteResponse[]> {
  const filas = await prisma.asignacionDocente.findMany({
    where: whereDe(institucionId, filtros),
    orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    skip: (paginacion.page - 1) * paginacion.pageSize,
    take: paginacion.pageSize,
    select: CAMPOS_ASIGNACION,
  })

  return filas.map(mapear)
}

export interface CrearAsignacionDocenteData {
  docenteId: string
  cursoId: string
  seccionId: string
  anioId: string
  createdBy: string
}

/**
 * Crea una asignación docente–curso–sección–año (RF-CORE-011).
 *
 * La unicidad de la combinación la impone la base de datos; el servicio
 * traduce la violación a `409 CONFLICT`.
 */
export async function createAsignacionDocente(
  prisma: PrismaClient,
  datos: CrearAsignacionDocenteData,
): Promise<AsignacionDocenteResponse> {
  const fila = await prisma.asignacionDocente.create({
    data: {
      docenteId: datos.docenteId,
      cursoId: datos.cursoId,
      seccionId: datos.seccionId,
      anioId: datos.anioId,
      createdBy: datos.createdBy,
    },
    select: CAMPOS_ASIGNACION,
  })

  return mapear(fila)
}
