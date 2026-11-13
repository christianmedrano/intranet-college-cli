import type { FastifyRequest, FastifyReply } from 'fastify'
import {
  solicitarMatriculaSchema,
  aprobarMatriculaSchema,
  rechazarMatriculaSchema,
  retirarMatriculaSchema,
  listarMatriculasAdminQuerySchema,
  type SolicitarMatriculaInput,
  type AprobarMatriculaInput,
  type RechazarMatriculaInput,
  type RetirarMatriculaInput,
  type ListarMatriculasAdminQuery,
} from '@intranet/shared'
import {
  solicitarMatricula,
  listarMatriculasAdmin,
  obtenerMatriculaAdmin,
  aprobarMatriculaAdmin,
  rechazarMatriculaAdmin,
  retirarMatriculaAdmin,
  anularMatriculaAdmin,
} from './matricula.service.js'
import { assertPermiso, type ActorMatriculas, type FiltrosMatriculasAdmin } from './matricula.scope.js'

/** Construye el actor matrículas desde la request. */
function buildActor(req: FastifyRequest): ActorMatriculas {
  const auth = req.authUser!
  return {
    id: auth.id,
    roles: auth.roles,
    institucionId: auth.institucionId,
  }
}

export async function solicitarMatriculaHandler(req: FastifyRequest, reply: FastifyReply) {
  const actor = buildActor(req)
  assertPermiso(actor, 'administrative.matriculas.gestionar')

  const datos = solicitarMatriculaSchema.parse(req.body) as SolicitarMatriculaInput
  const matricula = await solicitarMatricula(actor, {
    alumnoId: datos.alumnoId,
    seccionId: datos.seccionId,
    anioId: datos.anioId,
    documentos: datos.documentos,
  })

  return reply.code(201).send(matricula)
}

export async function listarMatriculasHandler(req: FastifyRequest, reply: FastifyReply) {
  const actor = buildActor(req)
  assertPermiso(actor, 'administrative.matriculas.leer')

  const query = listarMatriculasAdminQuerySchema.parse(req.query) as ListarMatriculasAdminQuery

  const filtros = {
    anioId: query.anioId,
    nivelId: query.nivelId,
    gradoId: query.gradoId,
    seccionId: query.seccionId,
    estado: query.estado,
    alumnoId: query.alumnoId,
  } satisfies FiltrosMatriculasAdmin

  const paginacion = {
    page: query.page ?? 1,
    pageSize: query.pageSize ?? 20,
  }

  const resultado = await listarMatriculasAdmin(actor, filtros, paginacion)
  return reply.send(resultado)
}

export async function obtenerMatriculaHandler(req: FastifyRequest, reply: FastifyReply) {
  const actor = buildActor(req)
  assertPermiso(actor, 'administrative.matriculas.leer')

  const { id } = req.params as { id: string }
  const matricula = await obtenerMatriculaAdmin(actor, id)
  return reply.send(matricula)
}

export async function aprobarMatriculaHandler(req: FastifyRequest, reply: FastifyReply) {
  const actor = buildActor(req)
  assertPermiso(actor, 'administrative.matriculas.gestionar')

  const { id } = req.params as { id: string }
  const datos = aprobarMatriculaSchema.parse(req.body) as AprobarMatriculaInput

  const matricula = await aprobarMatriculaAdmin(actor, id, datos.observaciones)
  return reply.send(matricula)
}

export async function rechazarMatriculaHandler(req: FastifyRequest, reply: FastifyReply) {
  const actor = buildActor(req)
  assertPermiso(actor, 'administrative.matriculas.gestionar')

  const { id } = req.params as { id: string }
  const datos = rechazarMatriculaSchema.parse(req.body) as RechazarMatriculaInput

  const matricula = await rechazarMatriculaAdmin(actor, id, datos.motivo)
  return reply.send(matricula)
}

export async function retirarMatriculaHandler(req: FastifyRequest, reply: FastifyReply) {
  const actor = buildActor(req)
  assertPermiso(actor, 'administrative.matriculas.gestionar')

  const { id } = req.params as { id: string }
  const datos = retirarMatriculaSchema.parse(req.body) as RetirarMatriculaInput

  const matricula = await retirarMatriculaAdmin(actor, id, datos.motivo)
  return reply.send(matricula)
}

export async function anularMatriculaHandler(req: FastifyRequest, reply: FastifyReply) {
  const actor = buildActor(req)
  assertPermiso(actor, 'administrative.matriculas.gestionar')

  const { id } = req.params as { id: string }
  const body = req.body as { motivo: string }
  const matricula = await anularMatriculaAdmin(actor, id, body.motivo)
  return reply.send(matricula)
}