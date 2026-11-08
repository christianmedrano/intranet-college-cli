import {
  estadoMatriculaSchema,
  type EstadoMatricula,
  type MatriculaResponse,
  type PaginationInput,
} from '@intranet/shared'
import type { Prisma, PrismaClient } from '../../../generated/prisma/client.js'
import {
  CAMPOS_PERSONA,
  toPersonaResponse,
  type PersonaRow,
} from '../personas/persona.repository.js'

const CAMPOS_MATRICULA = {
  id: true,
  alumnoId: true,
  seccionId: true,
  anioId: true,
  estado: true,
  fechaMatricula: true,
  alumno: {
    select: {
      id: true,
      codigoAlumno: true,
      persona: { select: CAMPOS_PERSONA },
    },
  },
  anio: {
    select: {
      id: true,
      nombre: true,
    },
  },
  seccion: {
    select: {
      id: true,
      nombre: true,
      grado: {
        select: {
          id: true,
          nombre: true,
          nivel: {
            select: {
              id: true,
              nombre: true,
            },
          },
        },
      },
    },
  },
} satisfies Prisma.MatriculaSelect

interface FilaCruda {
  id: string
  alumnoId: string
  seccionId: string
  anioId: string
  estado: string
  fechaMatricula: Date
  alumno: {
    id: string
    codigoAlumno: string
    persona: PersonaRow
  }
  anio: {
    id: string
    nombre: string
  }
  seccion: {
    id: string
    nombre: string
    grado: {
      id: string
      nombre: string
      nivel: {
        id: string
        nombre: string
      }
    }
  }
}

/** Proyecta la fila interna al contrato público. */
function mapear(fila: FilaCruda): MatriculaResponse {
  return {
    id: fila.id,
    alumnoId: fila.alumnoId,
    seccionId: fila.seccionId,
    anioId: fila.anioId,
    estado: estadoMatriculaSchema.parse(fila.estado),
    fechaMatricula: fila.fechaMatricula.toISOString(),
    alumno: {
      id: fila.alumno.id,
      codigoAlumno: fila.alumno.codigoAlumno,
      persona: toPersonaResponse(fila.alumno.persona),
    },
    anio: fila.anio,
    nivel: fila.seccion.grado.nivel,
    grado: {
      id: fila.seccion.grado.id,
      nombre: fila.seccion.grado.nombre,
    },
    seccion: {
      id: fila.seccion.id,
      nombre: fila.seccion.nombre,
    },
  }
}

/** Filtros admitidos por el historial de matrículas. */
export interface FiltrosMatricula {
  alumnoId?: string
  anioId?: string
  estado?: EstadoMatricula
}

/** Cuenta las matrículas vigentes que cumplen los filtros. */
export async function countMatriculas(
  prisma: PrismaClient,
  filtros: FiltrosMatricula,
): Promise<number> {
  return prisma.matricula.count({
    where: {
      deletedAt: null,
      ...(filtros.alumnoId !== undefined
        ? { alumnoId: filtros.alumnoId }
        : {}),
      ...(filtros.anioId !== undefined ? { anioId: filtros.anioId } : {}),
      ...(filtros.estado !== undefined ? { estado: filtros.estado } : {}),
    },
  })
}

/**
 * Lista las matrículas vigentes, de la más reciente a la más antigua.
 *
 * `id` desempata para que la paginación sea estable.
 */
export async function findMatriculas(
  prisma: PrismaClient,
  filtros: FiltrosMatricula,
  paginacion: PaginationInput,
): Promise<MatriculaResponse[]> {
  const filas = await prisma.matricula.findMany({
    where: {
      deletedAt: null,
      ...(filtros.alumnoId !== undefined
        ? { alumnoId: filtros.alumnoId }
        : {}),
      ...(filtros.anioId !== undefined ? { anioId: filtros.anioId } : {}),
      ...(filtros.estado !== undefined ? { estado: filtros.estado } : {}),
    },
    orderBy: [{ fechaMatricula: 'desc' }, { id: 'asc' }],
    skip: (paginacion.page - 1) * paginacion.pageSize,
    take: paginacion.pageSize,
    select: CAMPOS_MATRICULA,
  })

  return filas.map(mapear)
}

/** Busca una matrícula vigente por identificador. */
export async function findMatriculaPorId(
  prisma: PrismaClient,
  id: string,
): Promise<MatriculaResponse | null> {
  const fila = await prisma.matricula.findFirst({
    where: { id, deletedAt: null },
    select: CAMPOS_MATRICULA,
  })

  return fila ? mapear(fila) : null
}

export interface CrearMatriculaData {
  alumnoId: string
  seccionId: string
  anioId: string
  createdBy: string
}

/**
 * Crea una matrícula en estado `SOLICITADA` (RF-CORE-015).
 *
 * La unicidad `(alumno, año)` la impone la base de datos; el servicio traduce
 * la violación a `409 CONFLICT`.
 */
export async function createMatricula(
  prisma: Prisma.TransactionClient,
  datos: CrearMatriculaData,
): Promise<MatriculaResponse> {
  const fila = await prisma.matricula.create({
    data: {
      alumnoId: datos.alumnoId,
      seccionId: datos.seccionId,
      anioId: datos.anioId,
      estado: 'SOLICITADA',
      createdBy: datos.createdBy,
    },
    select: CAMPOS_MATRICULA,
  })

  return mapear(fila)
}

/** Actualiza el estado de una matrícula y devuelve la fila resultante. */
export async function updateEstadoMatricula(
  prisma: Prisma.TransactionClient,
  id: string,
  estado: EstadoMatricula,
  usuarioId: string,
): Promise<MatriculaResponse> {
  const fila = await prisma.matricula.update({
    where: { id },
    data: { estado, updatedBy: usuarioId },
    select: CAMPOS_MATRICULA,
  })

  return mapear(fila)
}

/** Cuenta los apoderados principales vigentes de un alumno. */
export async function countApoderadosPrincipales(
  prisma: PrismaClient,
  alumnoId: string,
): Promise<number> {
  return prisma.apoderadoAlumno.count({
    where: {
      alumnoId,
      esPrincipal: true,
      apoderado: { deletedAt: null },
    },
  })
}
