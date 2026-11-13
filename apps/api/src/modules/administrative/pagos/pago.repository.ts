import {
  pagoResponseSchema,
  paginatedPagosSchema,
  type PagoResponsePayload,
  type PaginatedPagosPayload,
  type PaginationInput,
  type ConceptoPago,
  type MetodoPago,
  type EstadoPago,
} from '@intranet/shared'
import type { Prisma } from '../../../generated/prisma/client.js'

const CAMPOS_PAGO = {
  id: true,
  alumnoId: true,
  concepto: true,
  monto: true,
  moneda: true,
  fechaPago: true,
  metodo: true,
  comprobante: true,
  observaciones: true,
  estado: true,
  anuladoMotivo: true,
  anuladoPorId: true,
  anuladoAt: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
  updatedBy: true,
} satisfies Prisma.PagoSelect

interface FilaPago {
  id: string
  alumnoId: string
  concepto: string
  monto: Prisma.Decimal
  moneda: string
  fechaPago: Date
  metodo: string
  comprobante: string | null
  observaciones: string | null
  estado: string
  anuladoMotivo: string | null
  anuladoPorId: string | null
  anuladoAt: Date | null
  createdAt: Date
  updatedAt: Date
  createdBy: string | null
  updatedBy: string | null
}

/** Proyecta la fila interna al contrato público. */
function mapear(fila: FilaPago): PagoResponsePayload {
  return pagoResponseSchema.parse({
    id: fila.id,
    alumnoId: fila.alumnoId,
    concepto: fila.concepto as ConceptoPago,
    monto: Number(fila.monto),
    moneda: fila.moneda,
    fechaPago: fila.fechaPago.toISOString().split('T')[0],
    metodo: fila.metodo as MetodoPago,
    comprobante: fila.comprobante,
    observaciones: fila.observaciones,
    estado: fila.estado as EstadoPago,
    anuladoMotivo: fila.anuladoMotivo,
    anuladoPorId: fila.anuladoPorId,
    anuladoAt: fila.anuladoAt?.toISOString() ?? null,
    createdAt: fila.createdAt.toISOString(),
    updatedAt: fila.updatedAt.toISOString(),
  })
}

/** Cuenta pagos según la condición de alcance. */
export async function countPagos(
  prisma: Prisma.TransactionClient,
  where: Prisma.PagoWhereInput,
): Promise<number> {
  return prisma.pago.count({ where })
}

/**
 * Lista pagos de la condición, del más reciente al más antiguo.
 * `id` desempata para que la paginación sea estable.
 */
export async function findPagos(
  prisma: Prisma.TransactionClient,
  where: Prisma.PagoWhereInput,
  paginacion: PaginationInput,
): Promise<PaginatedPagosPayload> {
  const [filas, total] = await Promise.all([
    prisma.pago.findMany({
      where,
      orderBy: [{ fechaPago: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }],
      skip: (paginacion.page - 1) * paginacion.pageSize,
      take: paginacion.pageSize,
      select: CAMPOS_PAGO,
    }),
    prisma.pago.count({ where }),
  ])

  return paginatedPagosSchema.parse({
    data: filas.map(mapear),
    meta: {
      page: paginacion.page,
      pageSize: paginacion.pageSize,
      total,
    },
  })
}

/** Busca un pago por ID. */
export async function findPagoPorId(
  prisma: Prisma.TransactionClient,
  id: string,
): Promise<FilaPago | null> {
  return prisma.pago.findFirst({
    where: { id },
    select: CAMPOS_PAGO,
  })
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

export interface CrearPagoData {
  alumnoId: string
  concepto: string
  monto: number
  moneda: string
  fechaPago: Date
  metodo: string
  comprobante?: string | null
  observaciones?: string | null
  createdBy: string
}

/** Crea un pago. */
export async function createPago(
  prisma: Prisma.TransactionClient,
  datos: CrearPagoData,
): Promise<PagoResponsePayload> {
  const fila = await prisma.pago.create({
    data: {
      alumnoId: datos.alumnoId,
      concepto: datos.concepto,
      monto: datos.monto,
      moneda: datos.moneda,
      fechaPago: datos.fechaPago,
      metodo: datos.metodo,
      comprobante: datos.comprobante ?? null,
      observaciones: datos.observaciones ?? null,
      estado: 'REGISTRADO',
      createdBy: datos.createdBy,
    },
    select: CAMPOS_PAGO,
  })

  return mapear(fila)
}

export interface AnularPagoData {
  id: string
  motivo: string
  anuladoPorId: string
}

/** Anula un pago (setea estado ANULADO, motivo y auditoría). */
export async function anularPago(
  prisma: Prisma.TransactionClient,
  datos: AnularPagoData,
): Promise<PagoResponsePayload> {
  const fila = await prisma.pago.update({
    where: { id: datos.id },
    data: {
      estado: 'ANULADO',
      anuladoMotivo: datos.motivo,
      anuladoPorId: datos.anuladoPorId,
      anuladoAt: new Date(),
      updatedBy: datos.anuladoPorId,
    },
    select: CAMPOS_PAGO,
  })

  return mapear(fila)
}

export interface EstadoCuentaData {
  alumnoId: string
}

/** Obtiene el estado de cuenta de un alumno (totales por concepto). */
export async function estadoCuenta(
  prisma: Prisma.TransactionClient,
  { alumnoId }: EstadoCuentaData,
) {
  const [pagos, alumno] = await Promise.all([
    prisma.pago.findMany({
      where: { alumnoId },
      select: {
        concepto: true,
        monto: true,
        estado: true,
      },
    }),
    prisma.alumno.findUnique({
      where: { id: alumnoId },
      select: { id: true, codigoAlumno: true, persona: { select: { nombres: true, apellidos: true } } },
    }),
  ])

  const totalesPorConcepto: Array<{ concepto: string; totalPagado: number; totalPendiente: number; cantidad: number }> = []

  for (const concepto of ['CUOTA_MENSUAL', 'MATRICULA', 'CERTIFICADO', 'OTRO'] as const) {
    const filtrados = pagos.filter((p) => p.concepto === concepto)
    const totalPagado = filtrados
      .filter((p) => p.estado === 'REGISTRADO')
      .reduce((acc, p) => acc + Number(p.monto), 0)
    const totalPendiente = filtrados
      .filter((p) => p.estado !== 'REGISTRADO')
      .reduce((acc, p) => acc + Number(p.monto), 0)
    const cantidad = filtrados.length

    totalesPorConcepto.push({ concepto, totalPagado, totalPendiente, cantidad })
  }

  const totalGeneralPagado = pagos
    .filter((p) => p.estado === 'REGISTRADO')
    .reduce((acc, p) => acc + Number(p.monto), 0)
  const totalGeneralPendiente = pagos
    .filter((p) => p.estado !== 'REGISTRADO')
    .reduce((acc, p) => acc + Number(p.monto), 0)

  return {
    alumno: alumno ? { id: alumno.id, codigo: alumno.codigoAlumno, nombres: alumno.persona.nombres, apellidos: alumno.persona.apellidos } : null,
    totalesPorConcepto,
    totalGeneralPagado,
    totalGeneralPendiente,
  }
}