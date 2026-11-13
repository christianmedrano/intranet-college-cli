import type { FastifyRequest, FastifyReply } from 'fastify'
import {
  crearPagoSchema,
  anularPagoSchema,
  listarPagosQuerySchema,
  type CrearPagoInput,
  type AnularPagoInput,
  type ListarPagosQuery,
} from '@intranet/shared'
import { registrarPago, listarPagos, obtenerPago, anularPagoServicio, obtenerEstadoCuenta } from './pago.service.js'
import { assertPermiso, type ActorPagos } from './pago.scope.js'

/** Construye el actor pagos desde la request. */
function buildActor(req: FastifyRequest): ActorPagos {
  const auth = req.authUser!
  return {
    id: auth.id,
    roles: auth.roles,
    institucionId: auth.institucionId,
  }
}

export async function crearPagoHandler(req: FastifyRequest, reply: FastifyReply) {
  const actor = buildActor(req)
  assertPermiso(actor, 'administrative.pagos.registrar')

  const datos = crearPagoSchema.parse(req.body) as CrearPagoInput
  const pago = await registrarPago(actor, {
    alumnoId: datos.alumnoId,
    concepto: datos.concepto,
    monto: datos.monto,
    moneda: datos.moneda,
    fechaPago: new Date(datos.fechaPago),
    metodo: datos.metodo,
    comprobante: datos.comprobante,
    observaciones: datos.observaciones,
    createdBy: actor.id,
  })

  return reply.code(201).send(pago)
}

export async function listarPagosHandler(req: FastifyRequest, reply: FastifyReply) {
  const actor = buildActor(req)
  assertPermiso(actor, 'administrative.pagos.leer')

  const query = listarPagosQuerySchema.parse(req.query) as ListarPagosQuery

  const filtros = {
    alumnoId: query.alumnoId,
    concepto: query.concepto,
    fechaDesde: query.fechaDesde ? new Date(query.fechaDesde) : undefined,
    fechaHasta: query.fechaHasta ? new Date(query.fechaHasta) : undefined,
    estado: query.estado,
    metodo: query.metodo,
  }

  const paginacion = {
    page: query.page ?? 1,
    pageSize: query.pageSize ?? 20,
  }

  const resultado = await listarPagos(actor, filtros, paginacion)
  return reply.send(resultado)
}

export async function obtenerPagoHandler(req: FastifyRequest, reply: FastifyReply) {
  const actor = buildActor(req)
  assertPermiso(actor, 'administrative.pagos.leer')

  const { id } = req.params as { id: string }
  const pago = await obtenerPago(actor, id)
  return reply.send(pago)
}

export async function anularPagoHandler(req: FastifyRequest, reply: FastifyReply) {
  const actor = buildActor(req)
  assertPermiso(actor, 'administrative.pagos.anular')

  const { id } = req.params as { id: string }
  const datos = anularPagoSchema.parse(req.body) as AnularPagoInput

  const pago = await anularPagoServicio(actor, id, datos.motivo)
  return reply.send(pago)
}

export async function estadoCuentaHandler(req: FastifyRequest, reply: FastifyReply) {
  const actor = buildActor(req)
  assertPermiso(actor, 'administrative.pagos.leer')

  const { alumnoId } = req.params as { alumnoId: string }
  const estado = await obtenerEstadoCuenta(actor, alumnoId)
  return reply.send(estado)
}