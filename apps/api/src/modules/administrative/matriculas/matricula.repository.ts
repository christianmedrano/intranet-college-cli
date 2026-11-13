import {
  estadoMatriculaAdminSchema,
  paginatedMatriculasAdminSchema,
  type PaginatedMatriculasAdminPayload,
  type PaginationInput,
} from '@intranet/shared'
import type { Prisma } from '../../../generated/prisma/client.js'

const CAMPOS_MATRICULA = {
  id: true,
  alumnoId: true,
  seccionId: true,
  anioId: true,
  estado: true,
  fechaMatricula: true,
  fechaSolicitud: true,
  fechaAprobacion: true,
  fechaRetiro: true,
  motivoRetiro: true,
  observaciones: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
  updatedBy: true,
  deletedAt: true,
  alumno: {
    select: {
      id: true,
      codigoAlumno: true,
      persona: {
        select: {
          id: true,
          nombres: true,
          apellidos: true,
          tipoDocumento: true,
          numeroDocumento: true,
        },
      },
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
      capacidad: true,
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

interface FilaMatricula {
  id: string
  alumnoId: string
  seccionId: string
  anioId: string
  estado: string
  fechaMatricula: Date
  fechaSolicitud: Date | null
  fechaAprobacion: Date | null
  fechaRetiro: Date | null
  motivoRetiro: string | null
  observaciones: string | null
  createdAt: Date
  updatedAt: Date
  createdBy: string | null
  updatedBy: string | null
  deletedAt: Date | null
  alumno: {
    id: string
    codigoAlumno: string
    persona: {
      id: string
      nombres: string
      apellidos: string
      tipoDocumento: string
      numeroDocumento: string
    }
  }
  anio: {
    id: string
    nombre: string
  }
  seccion: {
    id: string
    nombre: string
    capacidad: number | null
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
function mapear(fila: FilaMatricula) {
  return {
    id: fila.id,
    alumnoId: fila.alumnoId,
    seccionId: fila.seccionId,
    anioId: fila.anioId,
    estado: estadoMatriculaAdminSchema.parse(fila.estado),
    fechaSolicitud: fila.fechaSolicitud?.toISOString() ?? null,
    fechaAprobacion: fila.fechaAprobacion?.toISOString() ?? null,
    fechaRetiro: fila.fechaRetiro?.toISOString() ?? null,
    motivoRetiro: fila.motivoRetiro,
    observaciones: fila.observaciones,
    createdAt: fila.createdAt.toISOString(),
    updatedAt: fila.updatedAt.toISOString(),
    alumno: {
      id: fila.alumno.id,
      codigoAlumno: fila.alumno.codigoAlumno,
      persona: {
        id: fila.alumno.persona.id,
        nombres: fila.alumno.persona.nombres,
        apellidos: fila.alumno.persona.apellidos,
        tipoDocumento: fila.alumno.persona.tipoDocumento,
        numeroDocumento: fila.alumno.persona.numeroDocumento,
      },
    },
    anio: {
      id: fila.anio.id,
      nombre: fila.anio.nombre,
    },
    seccion: {
      id: fila.seccion.id,
      nombre: fila.seccion.nombre,
      capacidad: fila.seccion.capacidad,
      grado: {
        id: fila.seccion.grado.id,
        nombre: fila.seccion.grado.nombre,
        nivel: {
          id: fila.seccion.grado.nivel.id,
          nombre: fila.seccion.grado.nivel.nombre,
        },
      },
    },
  }
}

/** Cuenta matrículas según la condición de alcance. */
export async function countMatriculasAdmin(
  prisma: Prisma.TransactionClient,
  where: Prisma.MatriculaWhereInput,
): Promise<number> {
  return prisma.matricula.count({ where })
}

/**
 * Lista matrículas administrativas con paginación.
 */
export async function findMatriculasAdmin(
  prisma: Prisma.TransactionClient,
  where: Prisma.MatriculaWhereInput,
  paginacion: PaginationInput,
): Promise<PaginatedMatriculasAdminPayload> {
  const [filas, total] = await Promise.all([
    prisma.matricula.findMany({
      where,
      orderBy: [{ fechaMatricula: 'desc' }, { id: 'asc' }],
      skip: (paginacion.page - 1) * paginacion.pageSize,
      take: paginacion.pageSize,
      select: CAMPOS_MATRICULA,
    }),
    prisma.matricula.count({ where }),
  ])

  return paginatedMatriculasAdminSchema.parse({
    data: filas.map(mapear),
    meta: {
      page: paginacion.page,
      pageSize: paginacion.pageSize,
      total,
    },
  })
}

/** Busca una matrícula por ID. */
export async function findMatriculaPorIdAdmin(
  prisma: Prisma.TransactionClient,
  id: string,
): Promise<ReturnType<typeof mapear> | null> {
  const fila = await prisma.matricula.findFirst({
    where: { id, deletedAt: null },
    select: CAMPOS_MATRICULA,
  })
  return fila ? mapear(fila) : null
}

/** Verifica si el alumno existe y no está eliminado. */
export async function assertAlumnoExiste(
  prisma: Prisma.TransactionClient,
  alumnoId: string,
): Promise<boolean> {
  const alumno = await prisma.alumno.findUnique({
    where: { id: alumnoId, deletedAt: null },
    select: { id: true },
  })
  return alumno !== null
}

/** Verifica si la sección existe, pertenece al año y tiene capacidad. */
export async function assertSeccionValida(
  prisma: Prisma.TransactionClient,
  seccionId: string,
  anioId: string,
): Promise<{ id: string; capacidad: number | null } | null> {
  return prisma.seccion.findFirst({
    where: { id: seccionId, anioId, deletedAt: null },
    select: { id: true, capacidad: true },
  })
}

/** Verifica si el año existe y está activo. */
export async function assertAnioActivo(
  prisma: Prisma.TransactionClient,
  anioId: string,
): Promise<{ id: string; estado: string } | null> {
  return prisma.anioAcademico.findFirst({
    where: { id: anioId, estado: 'ACTIVO', deletedAt: null },
    select: { id: true, estado: true },
  })
}

/** Cuenta matrículas aprobadas en una sección. */
export async function countMatriculasAprobadasEnSeccion(
  prisma: Prisma.TransactionClient,
  seccionId: string,
): Promise<number> {
  return prisma.matricula.count({
    where: { seccionId, estado: 'APROBADA', deletedAt: null },
  })
}

/** Cuenta los apoderados principales vigentes de un alumno. */
export async function countApoderadosPrincipales(
  prisma: Prisma.TransactionClient,
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

export interface CrearMatriculaAdminData {
  alumnoId: string
  seccionId: string
  anioId: string
  documentos?: Array<{ tipo: string; archivoNombre: string; archivoRuta: string }>
  createdBy: string
}

/** Crea una matrícula en estado SOLICITADA (RF-ADM-005). */
export async function createMatriculaAdmin(
  prisma: Prisma.TransactionClient,
  datos: CrearMatriculaAdminData,
) {
  const fila = await prisma.matricula.create({
    data: {
      alumnoId: datos.alumnoId,
      seccionId: datos.seccionId,
      anioId: datos.anioId,
      estado: 'SOLICITADA',
      fechaSolicitud: new Date(),
      createdBy: datos.createdBy,
    },
    select: CAMPOS_MATRICULA,
  })
  return mapear(fila)
}

export interface ActualizarEstadoMatriculaAdminData {
  id: string
  estado: string
  motivoRetiro?: string
  observaciones?: string
  updatedBy: string
}

/** Actualiza el estado de una matrícula. */
export async function updateEstadoMatriculaAdmin(
  prisma: Prisma.TransactionClient,
  datos: ActualizarEstadoMatriculaAdminData,
) {
  const updateData: Prisma.MatriculaUpdateInput = {
    estado: datos.estado,
    updatedBy: datos.updatedBy,
  }

  if (datos.estado === 'APROBADA') {
    updateData.fechaAprobacion = new Date()
  }
  if (datos.estado === 'RETIRADA') {
    updateData.fechaRetiro = new Date()
    updateData.motivoRetiro = datos.motivoRetiro
  }
  if (datos.observaciones !== undefined) {
    updateData.observaciones = datos.observaciones
  }

  const fila = await prisma.matricula.update({
    where: { id: datos.id },
    data: updateData,
    select: CAMPOS_MATRICULA,
  })
  return mapear(fila)
}