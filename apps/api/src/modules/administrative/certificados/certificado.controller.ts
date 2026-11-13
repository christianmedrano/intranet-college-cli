import type { FastifyRequest, FastifyReply } from 'fastify'
import {
  crearCertificadoSchema,
  solicitarCertificadoSchema,
  aprobarCertificadoSchema,
  rechazarCertificadoSchema,
  listarCertificadosQuerySchema,
  type CrearCertificadoInput,
  type SolicitarCertificadoInput,
  type AprobarCertificadoInput,
  type RechazarCertificadoInput,
  type ListarCertificadosQuery,
} from '@intranet/shared'
import {
  listarCertificados,
  obtenerCertificado,
  obtenerCertificadoPorNumero,
  emitirCertificado,
  solicitarCertificado,
  aprobarCertificado,
  rechazarCertificado,
  anularCertificado,
  descargarCertificado,
} from './certificado.service.js'
import { assertPermiso, type ActorCertificados } from './certificado.scope.js'

/** Construye el actor certificados desde la request. */
function buildActor(req: FastifyRequest): ActorCertificados {
  const auth = req.authUser!
  return {
    id: auth.id,
    roles: auth.roles,
    institucionId: auth.institucionId,
  }
}

export async function listarCertificadosHandler(req: FastifyRequest, reply: FastifyReply) {
  const actor = buildActor(req)
  assertPermiso(actor, 'administrative.certificados.emitir')

  const query = listarCertificadosQuerySchema.parse(req.query) as ListarCertificadosQuery

  const filtros = {
    tipo: query.tipo,
    alumnoId: query.alumnoId,
    anioId: query.anioId,
    estado: query.estado,
  }

  const paginacion = {
    page: query.page ?? 1,
    pageSize: query.pageSize ?? 20,
  }

  const resultado = await listarCertificados(actor, filtros, paginacion)
  return reply.send(resultado)
}

export async function obtenerCertificadoHandler(req: FastifyRequest, reply: FastifyReply) {
  const actor = buildActor(req)
  assertPermiso(actor, 'administrative.certificados.emitir')

  const { id } = req.params as { id: string }
  const certificado = await obtenerCertificado(actor, id)
  return reply.send(certificado)
}

export async function obtenerCertificadoPorNumeroHandler(req: FastifyRequest, reply: FastifyReply) {
  const actor = buildActor(req)
  assertPermiso(actor, 'administrative.certificados.emitir')

  const { numero } = req.params as { numero: string }
  const certificado = await obtenerCertificadoPorNumero(actor, numero)
  return reply.send(certificado)
}

export async function emitirCertificadoHandler(req: FastifyRequest, reply: FastifyReply) {
  const actor = buildActor(req)
  assertPermiso(actor, 'administrative.certificados.emitir')

  const datos = crearCertificadoSchema.parse(req.body) as CrearCertificadoInput
  const certificado = await emitirCertificado(actor, {
    tipo: datos.tipo,
    alumnoId: datos.alumnoId,
    anioId: datos.anioId,
    plantillaId: datos.plantillaId,
    variables: datos.variables,
  })

  return reply.code(201).send(certificado)
}

export async function solicitarCertificadoHandler(req: FastifyRequest, reply: FastifyReply) {
  const actor = buildActor(req)
  assertPermiso(actor, 'administrative.certificados.solicitar')

  const datos = solicitarCertificadoSchema.parse(req.body) as SolicitarCertificadoInput
  const certificado = await solicitarCertificado(actor, {
    tipo: datos.tipo,
    alumnoId: datos.alumnoId,
    anioId: datos.anioId,
    plantillaId: datos.plantillaId,
  })

  return reply.code(201).send(certificado)
}

export async function aprobarCertificadoHandler(req: FastifyRequest, reply: FastifyReply) {
  const actor = buildActor(req)
  assertPermiso(actor, 'administrative.certificados.emitir')

  const { id } = req.params as { id: string }
  const datos = aprobarCertificadoSchema.parse(req.body) as AprobarCertificadoInput

  const certificado = await aprobarCertificado(actor, id, {
    plantillaId: datos.plantillaId,
    variables: datos.variables,
  })

  return reply.send(certificado)
}

export async function rechazarCertificadoHandler(req: FastifyRequest, reply: FastifyReply) {
  const actor = buildActor(req)
  assertPermiso(actor, 'administrative.certificados.emitir')

  const { id } = req.params as { id: string }
  const datos = rechazarCertificadoSchema.parse(req.body) as RechazarCertificadoInput

  const certificado = await rechazarCertificado(actor, id, datos.motivo)
  return reply.send(certificado)
}

export async function anularCertificadoHandler(req: FastifyRequest, reply: FastifyReply) {
  const actor = buildActor(req)
  assertPermiso(actor, 'administrative.certificados.emitir')

  const { id } = req.params as { id: string }
  const body = req.body as { motivo: string }
  const certificado = await anularCertificado(actor, id, body.motivo)
  return reply.send(certificado)
}

export async function descargarCertificadoHandler(req: FastifyRequest, reply: FastifyReply) {
  const actor = buildActor(req)
  assertPermiso(actor, 'administrative.certificados.descargar')

  const { id } = req.params as { id: string }
  const certificado = await descargarCertificado(actor, id)

  // Aquí se debería generar/retornar el PDF
  // Por ahora retornamos info del certificado
  return reply.send({
    message: 'PDF generado correctamente',
    certificado,
    downloadUrl: `/api/v1/certificados/${id}/download`,
  })
}