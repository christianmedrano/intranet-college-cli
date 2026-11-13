import {
  certificadoResponseSchema,
  paginatedCertificadosSchema,
  type CertificadoResponsePayload,
  type PaginatedCertificadosPayload,
  type PaginationInput,
} from '@intranet/shared'
import { Prisma } from '../../../generated/prisma/client.js'

const CAMPOS_CERTIFICADO = {
  id: true,
  tipo: true,
  numero: true,
  alumnoId: true,
  anioId: true,
  plantillaId: true,
  variables: true,
  estado: true,
  solicitadoPorId: true,
  solicitadoAt: true,
  aprobadoPorId: true,
  aprobadoAt: true,
  rechazadoMotivo: true,
  pdfRuta: true,
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
  plantilla: {
    select: {
      id: true,
      tipo: true,
      nombre: true,
      version: true,
    },
  },
  solicitadoPor: {
    select: {
      id: true,
      persona: {
        select: {
          nombres: true,
          apellidos: true,
        },
      },
    },
  },
  aprobadoPor: {
    select: {
      id: true,
      persona: {
        select: {
          nombres: true,
          apellidos: true,
        },
      },
    },
  },
} satisfies Prisma.CertificadoSelect

// Select simplificado para listados (sin relaciones anidadas)
const CAMPOS_CERTIFICADO_LISTA = {
  id: true,
  tipo: true,
  numero: true,
  alumnoId: true,
  anioId: true,
  plantillaId: true,
  variables: true,
  estado: true,
  solicitadoPorId: true,
  solicitadoAt: true,
  aprobadoPorId: true,
  aprobadoAt: true,
  rechazadoMotivo: true,
  pdfRuta: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
  updatedBy: true,
  deletedAt: true,
} satisfies Prisma.CertificadoSelect

interface FilaCertificado {
  id: string
  tipo: string
  numero: string
  alumnoId: string
  anioId: string
  plantillaId: string | null
  variables: Prisma.JsonValue | null
  estado: string
  solicitadoPorId: string | null
  solicitadoAt: Date | null
  aprobadoPorId: string | null
  aprobadoAt: Date | null
  rechazadoMotivo: string | null
  pdfRuta: string | null
  createdAt: Date
  updatedAt: Date
  createdBy: string | null
  updatedBy: string | null
  deletedAt: Date | null
  alumno?: Record<string, unknown>
  anio?: {
    id: string
    nombre: string
  }
  plantilla?: {
    id: string
    tipo: string
    nombre: string
    version: number
  } | null
  solicitadoPor?: {
    id: string
    persona?: {
      nombres: string
      apellidos: string
    } | null
  } | null
  aprobadoPor?: {
    id: string
    persona?: {
      nombres: string
      apellidos: string
    } | null
  } | null
}

/** Proyecta la fila interna al contrato público. */
function mapear(fila: FilaCertificado): CertificadoResponsePayload {
  return certificadoResponseSchema.parse({
    id: fila.id,
    tipo: fila.tipo,
    numero: fila.numero,
    alumnoId: fila.alumnoId,
    anioId: fila.anioId,
    plantillaId: fila.plantillaId,
    variables: (fila.variables as Record<string, string> | null) ?? null,
    estado: fila.estado,
    solicitadoPorId: fila.solicitadoPorId,
    solicitadoAt: fila.solicitadoAt?.toISOString() ?? null,
    aprobadoPorId: fila.aprobadoPorId,
    aprobadoAt: fila.aprobadoAt?.toISOString() ?? null,
    rechazadoMotivo: fila.rechazadoMotivo,
    pdfRuta: fila.pdfRuta,
    createdAt: fila.createdAt.toISOString(),
    updatedAt: fila.updatedAt.toISOString(),
  })
}

/** Cuenta certificados según la condición de alcance. */
export async function countCertificados(
  prisma: Prisma.TransactionClient,
  where: Prisma.CertificadoWhereInput,
): Promise<number> {
  return prisma.certificado.count({ where })
}

/**
 * Lista certificados con paginación.
 */
export async function findCertificados(
  prisma: Prisma.TransactionClient,
  where: Prisma.CertificadoWhereInput,
  paginacion: PaginationInput,
): Promise<PaginatedCertificadosPayload> {
  const [filas, total] = await Promise.all([
    prisma.certificado.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      skip: (paginacion.page - 1) * paginacion.pageSize,
      take: paginacion.pageSize,
      select: CAMPOS_CERTIFICADO_LISTA,
    }),
    prisma.certificado.count({ where }),
  ])

  return paginatedCertificadosSchema.parse({
    data: filas.map(mapear),
    meta: {
      page: paginacion.page,
      pageSize: paginacion.pageSize,
      total,
    },
  })
}

/** Busca un certificado por ID. */
export async function findCertificadoPorId(
  prisma: Prisma.TransactionClient,
  id: string,
): Promise<CertificadoResponsePayload | null> {
  const fila = await prisma.certificado.findFirst({
    where: { id, deletedAt: null },
    select: {
      ...CAMPOS_CERTIFICADO,
      alumno: {
        select: {
          id: true,
          codigoAlumno: true,
          persona: {
            select: {
              id: true,
              nombres: true,
              apellidos: true,
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
      plantilla: {
        select: {
          id: true,
          tipo: true,
          nombre: true,
          version: true,
        },
      },
      solicitadoPor: {
        select: {
          id: true,
          persona: {
            select: {
              nombres: true,
              apellidos: true,
            },
          },
        },
      },
      aprobadoPor: {
        select: {
          id: true,
          persona: {
            select: {
              nombres: true,
              apellidos: true,
            },
          },
        },
      },
    } as Prisma.CertificadoSelect,
  })
  return fila ? mapear(fila as FilaCertificado) : null
}

/** Busca un certificado por número. */
export async function findCertificadoPorNumero(
  prisma: Prisma.TransactionClient,
  numero: string,
): Promise<CertificadoResponsePayload | null> {
  const fila = await prisma.certificado.findFirst({
    where: { numero, deletedAt: null },
    select: {
      ...CAMPOS_CERTIFICADO,
      alumno: {
        select: {
          id: true,
          codigoAlumno: true,
          persona: {
            select: {
              id: true,
              nombres: true,
              apellidos: true,
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
      plantilla: {
        select: {
          id: true,
          tipo: true,
          nombre: true,
          version: true,
        },
      },
      solicitadoPor: {
        select: {
          id: true,
          persona: {
            select: {
              nombres: true,
              apellidos: true,
            },
          },
        },
      },
      aprobadoPor: {
        select: {
          id: true,
          persona: {
            select: {
              nombres: true,
              apellidos: true,
            },
          },
        },
      },
    } as Prisma.CertificadoSelect,
  })
  return fila ? mapear(fila) : null
}

/** Obtiene el último número de secuencia para un tipo y año. */
export async function getUltimoNumeroSecuencia(
  prisma: Prisma.TransactionClient,
  tipo: string,
  anioId: string,
): Promise<number> {
  const anio = await prisma.anioAcademico.findUnique({
    where: { id: anioId },
    select: { nombre: true },
  })
  if (!anio) {
    throw new Error('Año académico no encontrado')
  }

  const prefijo = `CERT-${tipo}-${anio.nombre}-`
  const ultimo = await prisma.certificado.findFirst({
    where: {
      numero: { startsWith: prefijo },
      deletedAt: null,
    },
    orderBy: { numero: 'desc' },
    select: { numero: true },
  })

  if (!ultimo) {
    return 0
  }

  const secuencia = parseInt(ultimo.numero.replace(prefijo, ''), 10)
  return isNaN(secuencia) ? 0 : secuencia
}

/** Genera el número de certificado con formato CERT-{TIPO}-{AÑO}-{SEQ}. */
export async function generarNumeroCertificado(
  prisma: Prisma.TransactionClient,
  tipo: string,
  anioId: string,
): Promise<string> {
  const secuencia = await getUltimoNumeroSecuencia(prisma, tipo, anioId) + 1
  const anio = await prisma.anioAcademico.findUnique({
    where: { id: anioId },
    select: { nombre: true },
  })
  if (!anio) {
    throw new Error('Año académico no encontrado')
  }
  return `CERT-${tipo}-${anio.nombre}-${secuencia.toString().padStart(4, '0')}`
}

export interface CrearCertificadoData {
  tipo: string
  alumnoId: string
  anioId: string
  plantillaId?: string | null
  variables?: Record<string, string> | null
  estado: string
  solicitadoPorId?: string | null
  solicitadoAt?: Date | null
  createdBy: string
}

/** Crea un certificado (emisión directa o solicitud). */
export async function createCertificado(
  prisma: Prisma.TransactionClient,
  datos: CrearCertificadoData,
): Promise<CertificadoResponsePayload> {
  // Siempre generar número para cumplir con la restricción NOT NULL en BD
  const numero = await generarNumeroCertificado(prisma, datos.tipo, datos.anioId)

  const fila = await prisma.certificado.create({
    data: {
      tipo: datos.tipo,
      numero,
      alumnoId: datos.alumnoId,
      anioId: datos.anioId,
      plantillaId: datos.plantillaId,
      variables: datos.variables ?? {},
      estado: datos.estado,
      solicitadoPorId: datos.solicitadoPorId,
      solicitadoAt: datos.solicitadoAt,
      createdBy: datos.createdBy,
    },
    select: CAMPOS_CERTIFICADO,
  })

  return mapear(fila)
}

export interface ActualizarCertificadoData {
  id: string
  plantillaId?: string
  variables?: Record<string, string> | null
  estado?: string
  aprobadoPorId?: string
  aprobadoAt?: Date
  rechazadoMotivo?: string
  pdfRuta?: string
  updatedBy: string
}

/** Actualiza un certificado (aprobar, rechazar, emitir, etc.). */
export async function updateCertificado(
  prisma: Prisma.TransactionClient,
  datos: ActualizarCertificadoData,
): Promise<CertificadoResponsePayload> {
  const data: Prisma.CertificadoUpdateInput = {
    updatedBy: datos.updatedBy,
  }

  if (datos.plantillaId !== undefined) {
    data.plantilla = datos.plantillaId ? { connect: { id: datos.plantillaId } } : { disconnect: true }
  }
  if (datos.variables !== undefined) {
    data.variables = datos.variables ?? Prisma.JsonNull
  }
  if (datos.estado !== undefined) {
    data.estado = datos.estado
  }
  if (datos.aprobadoPorId !== undefined) {
    data.aprobadoPor = datos.aprobadoPorId ? { connect: { id: datos.aprobadoPorId } } : { disconnect: true }
  }
  if (datos.aprobadoAt !== undefined) {
    data.aprobadoAt = datos.aprobadoAt
  }
  if (datos.rechazadoMotivo !== undefined) {
    data.rechazadoMotivo = datos.rechazadoMotivo
  }
  if (datos.pdfRuta !== undefined) {
    data.pdfRuta = datos.pdfRuta
  }

  const fila = await prisma.certificado.update({
    where: { id: datos.id },
    data,
    select: CAMPOS_CERTIFICADO,
  })

  return mapear(fila)
}