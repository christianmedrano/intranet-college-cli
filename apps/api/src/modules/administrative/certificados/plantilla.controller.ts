import type { FastifyRequest, FastifyReply } from 'fastify'
import {
  plantillaCertificadoSchema,
  actualizarPlantillaSchema,
  listarCertificadosQuerySchema,
  type PlantillaCertificadoInput,
  type ActualizarPlantillaInput,
  type ListarCertificadosQuery,
} from '@intranet/shared'
import {
  listarPlantillas,
  obtenerPlantilla,
  crearPlantilla,
  actualizarPlantilla,
  eliminarPlantilla,
  previewPlantilla,
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

export async function listarPlantillasHandler(req: FastifyRequest, reply: FastifyReply) {
  const actor = buildActor(req)
  assertPermiso(actor, 'administrative.certificados.emitir')

  const query = listarCertificadosQuerySchema.parse(req.query) as ListarCertificadosQuery

  const filtros = {
    tipo: query.tipo,
    activa: query.estado === 'APROBADO' ? true : query.estado === 'RECHAZADO' ? false : undefined,
  }

  const paginacion = {
    page: query.page ?? 1,
    pageSize: query.pageSize ?? 20,
  }

  const resultado = await listarPlantillas(actor, filtros, paginacion)
  return reply.send(resultado)
}

export async function obtenerPlantillaHandler(req: FastifyRequest, reply: FastifyReply) {
  const actor = buildActor(req)
  assertPermiso(actor, 'administrative.certificados.emitir')

  const { id } = req.params as { id: string }
  const plantilla = await obtenerPlantilla(actor, id)
  return reply.send(plantilla)
}

export async function crearPlantillaHandler(req: FastifyRequest, reply: FastifyReply) {
  const actor = buildActor(req)
  assertPermiso(actor, 'administrative.certificados.emitir')

  const datos = plantillaCertificadoSchema.parse(req.body) as PlantillaCertificadoInput
  const plantilla = await crearPlantilla(actor, {
    tipo: datos.tipo,
    nombre: datos.nombre,
    contenido: datos.contenido,
    activa: datos.activa,
  })

  return reply.code(201).send(plantilla)
}

export async function actualizarPlantillaHandler(req: FastifyRequest, reply: FastifyReply) {
  const actor = buildActor(req)
  assertPermiso(actor, 'administrative.certificados.emitir')

  const { id } = req.params as { id: string }
  const datos = actualizarPlantillaSchema.parse(req.body) as ActualizarPlantillaInput

  const plantilla = await actualizarPlantilla(actor, id, {
    nombre: datos.nombre,
    contenido: datos.contenido,
    activa: datos.activa,
  })

  return reply.send(plantilla)
}

export async function eliminarPlantillaHandler(req: FastifyRequest, reply: FastifyReply) {
  const actor = buildActor(req)
  assertPermiso(actor, 'administrative.certificados.emitir')

  const { id } = req.params as { id: string }
  await eliminarPlantilla(actor, id)
  return reply.code(204).send()
}

export async function previewPlantillaHandler(req: FastifyRequest, reply: FastifyReply) {
  const actor = buildActor(req)
  assertPermiso(actor, 'administrative.certificados.emitir')

  const { id } = req.params as { id: string }
  const body = req.body as { variables: Record<string, string> }
  const preview = await previewPlantilla(actor, id, body.variables ?? {})
  return reply.send(preview)
}