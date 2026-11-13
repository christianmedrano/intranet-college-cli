import { AppError } from '../../../core/errors.js'
import { registrarAuditoria, type AccionAuditoria } from '../../../core/audit.js'
import { getPrisma } from '../../../core/db.js'
import {
  findPagos,
  findPagoPorId,
  createPago,
  anularPago,
  estadoCuenta,
  type CrearPagoData,
} from './pago.repository.js'
import { construirAlcancePagos, type ActorPagos, type FiltrosPagos, assertVinculoPago } from './pago.scope.js'
import { hasPermission } from '../../../core/rbac.js'

const prisma = getPrisma()

/** Valida reglas de negocio para creación de pago (RN-ADM-001 a RN-ADM-004). */
function validarCrearPago(datos: CrearPagoData): void {
  // RN-ADM-001: monto > 0
  if (datos.monto <= 0) {
    throw new AppError('VALIDATION_ERROR', 'El monto debe ser mayor a 0.')
  }

  // RN-ADM-001: monto máximo
  if (datos.monto > 999999.99) {
    throw new AppError('VALIDATION_ERROR', 'El monto supera el máximo permitido (999,999.99).')
  }

  // RN-ADM-001: máximo 2 decimales
  if (Number(datos.monto.toFixed(2)) !== datos.monto) {
    throw new AppError('VALIDATION_ERROR', 'El monto debe tener máximo 2 decimales.')
  }

  // RN-ADM-002: fecha no futura
  const hoy = new Date()
  hoy.setHours(23, 59, 59, 999)
  if (datos.fechaPago > hoy) {
    throw new AppError('VALIDATION_ERROR', 'La fecha de pago no puede ser futura.')
  }

  // RN-ADM-003: concepto válido
  const conceptosValidos = ['CUOTA_MENSUAL', 'MATRICULA', 'CERTIFICADO', 'OTRO']
  if (!conceptosValidos.includes(datos.concepto)) {
    throw new AppError('VALIDATION_ERROR', 'Concepto de pago inválido.')
  }

  // RN-ADM-004: método válido
  const metodosValidos = ['EFECTIVO', 'TRANSFERENCIA', 'DEPOSITO', 'OTRO']
  if (!metodosValidos.includes(datos.metodo)) {
    throw new AppError('VALIDATION_ERROR', 'Método de pago inválido.')
  }

  // Moneda debe ser PEN
  if (datos.moneda !== 'PEN') {
    throw new AppError('VALIDATION_ERROR', 'La moneda debe ser PEN.')
  }
}

/** Crea un pago con validaciones y auditoría. */
export async function registrarPago(
  actor: ActorPagos,
  datos: CrearPagoData,
): Promise<Awaited<ReturnType<typeof createPago>>> {
  // Validar permisos
  if (!hasPermission(actor.roles, 'administrative.pagos.registrar')) {
    throw new AppError('FORBIDDEN')
  }

  // Validar reglas de negocio
  validarCrearPago(datos)

  // Verificar que el alumno existe
  const alumnoExiste = await prisma.alumno.findUnique({
    where: { id: datos.alumnoId, deletedAt: null },
    select: { id: true },
  })
  if (!alumnoExiste) {
    throw new AppError('VALIDATION_ERROR', 'El alumno no existe o está eliminado.')
  }

  // Crear pago en transacción con auditoría
  const resultado = await prisma.$transaction(async (tx) => {
    const pago = await createPago(tx, datos)

    await registrarAuditoria(tx, {
      usuarioId: actor.id,
      accion: 'CREAR_PAGO' as AccionAuditoria,
      entidad: 'Pago',
      entidadId: pago.id,
      datos: {
        alumnoId: datos.alumnoId,
        concepto: datos.concepto,
        monto: datos.monto,
      },
    })

    return pago
  })

  return resultado
}

/** Lista pagos con alcance según el actor. */
export async function listarPagos(
  actor: ActorPagos,
  filtros: FiltrosPagos,
  paginacion: { page: number; pageSize: number },
) {
  if (!hasPermission(actor.roles, 'administrative.pagos.leer')) {
    throw new AppError('FORBIDDEN')
  }

  const { where, auditarAcceso } = await construirAlcancePagos(actor, filtros, prisma)

  if (auditarAcceso) {
    await registrarAuditoria(prisma, {
      usuarioId: actor.id,
      accion: 'LEER_PAGOS' as AccionAuditoria,
      entidad: 'Pago',
      datos: JSON.parse(JSON.stringify(filtros)),
    })
  }

  return findPagos(prisma, where, paginacion)
}

/** Obtiene un pago por ID con validación de vínculo. */
export async function obtenerPago(
  actor: ActorPagos,
  id: string,
) {
  if (!hasPermission(actor.roles, 'administrative.pagos.leer')) {
    throw new AppError('FORBIDDEN')
  }

  await assertVinculoPago(actor, id, prisma)

  const fila = await findPagoPorId(prisma, id)
  if (!fila) {
    throw new AppError('NOT_FOUND', 'El pago no existe.')
  }

  return fila
}

/** Anula un pago con validaciones y auditoría (RN-ADM-002). */
export async function anularPagoServicio(
  actor: ActorPagos,
  id: string,
  motivo: string,
): Promise<Awaited<ReturnType<typeof anularPago>>> {
  if (!hasPermission(actor.roles, 'administrative.pagos.anular')) {
    throw new AppError('FORBIDDEN')
  }

  await assertVinculoPago(actor, id, prisma)

  const pagoExistente = await findPagoPorId(prisma, id)
  if (!pagoExistente) {
    throw new AppError('NOT_FOUND', 'El pago no existe.')
  }

  if (pagoExistente.estado === 'ANULADO') {
    throw new AppError('CONFLICT', 'El pago ya está anulado.')
  }

  if (motivo.trim().length === 0) {
    throw new AppError('VALIDATION_ERROR', 'El motivo de anulación es obligatorio.')
  }

  if (motivo.length > 500) {
    throw new AppError('VALIDATION_ERROR', 'El motivo es demasiado largo (máx. 500 caracteres).')
  }

  const resultado = await prisma.$transaction(async (tx) => {
    const pago = await anularPago(tx, { id, motivo, anuladoPorId: actor.id })

    await registrarAuditoria(tx, {
      usuarioId: actor.id,
      accion: 'ANULAR_PAGO' as AccionAuditoria,
      entidad: 'Pago',
      entidadId: pago.id,
      datos: {
        motivo,
        estadoAnterior: pagoExistente.estado,
      },
    })

    return pago
  })

  return resultado
}

/** Obtiene el estado de cuenta de un alumno. */
export async function obtenerEstadoCuenta(
  actor: ActorPagos,
  alumnoId: string,
) {
  if (!hasPermission(actor.roles, 'administrative.pagos.leer')) {
    throw new AppError('FORBIDDEN')
  }

  // Verificar vínculo con el alumno
  if (actor.roles.includes('APODERADO')) {
    const vinculado = await prisma.apoderadoAlumno.findFirst({
      where: {
        alumnoId,
        apoderado: {
          deletedAt: null,
          persona: {
            usuario: { id: actor.id, activo: true, deletedAt: null },
          },
        },
      },
      select: { apoderadoId: true, alumnoId: true },
    })
    if (!vinculado) {
      throw new AppError('FORBIDDEN', 'El apoderado no tiene vínculo con ese alumno.')
    }
  } else if (actor.roles.includes('ALUMNO')) {
    const alumno = await prisma.alumno.findFirst({
      where: {
        id: alumnoId,
        deletedAt: null,
        persona: {
          usuario: { id: actor.id, activo: true, deletedAt: null },
        },
      },
      select: { id: true },
    })
    if (!alumno) {
      throw new AppError('FORBIDDEN', 'El alumno no coincide con el usuario autenticado.')
    }
  }

  const estado = await estadoCuenta(prisma, { alumnoId })

  await registrarAuditoria(prisma, {
    usuarioId: actor.id,
    accion: 'LEER_ESTADO_CUENTA' as AccionAuditoria,
    entidad: 'Pago',
    datos: { alumnoId },
  })

  return estado
}