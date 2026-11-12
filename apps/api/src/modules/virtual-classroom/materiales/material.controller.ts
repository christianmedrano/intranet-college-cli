import type { FastifyRequest, FastifyReply } from 'fastify'
import {
  crearMaterialSchema,
  actualizarMaterialSchema,
  listarMaterialesQuerySchema,
  type CrearMaterialInput,
  type ActualizarMaterialInput,
  type ListarMaterialesQuery,
} from '@intranet/shared'
import { AppError } from '../../../core/errors.js'
import { parseOrThrow } from '../../../core/validation.js'
import { contextoDePeticion } from '../../../core/audit.js'
import {
  crearMaterial,
  actualizarMaterial,
  eliminarMaterial,
  listarMateriales,
  obtenerMaterial,
  prepararDescargaMaterial,
} from './material.service.js'
import type { ActorVirtual } from './material.scope.js'

/** Extrae el actor desde la petición autenticada. */
function getActor(request: FastifyRequest): ActorVirtual {
  const authUser = request.authUser

  if (!authUser) {
    throw new AppError('UNAUTHORIZED')
  }

  return {
    id: authUser.id,
    roles: authUser.roles,
    institucionId: authUser.institucionId,
  }
}

/** Lee el año académico del header `x-anio-academico`. */
function leerAnioId(request: FastifyRequest): string {
  const anioId = request.headers['x-anio-academico']

  if (typeof anioId !== 'string' || anioId.length === 0) {
    throw new AppError(
      'VALIDATION_ERROR',
      'Se requiere el parámetro anioId (header x-anio-academico).',
    )
  }

  return anioId
}

/** Convierte ContextoAuditoria null a undefined para compatibilidad. */
function toAuditContext(ctx: { ip?: string | null; userAgent?: string | null }): { ip?: string; userAgent?: string } {
  return {
    ip: ctx.ip ?? undefined,
    userAgent: ctx.userAgent ?? undefined,
  }
}

/**
 * POST /api/v1/virtual/materiales
 * Crea un material virtual (RF-VIR-001).
 * Permiso: virtual.gestionar
 */
export async function crearMaterialController(
  request: FastifyRequest<{ Body: CrearMaterialInput }>,
  reply: FastifyReply,
): Promise<void> {
  const actor = getActor(request)
  const input = parseOrThrow(crearMaterialSchema, request.body)

  const material = await crearMaterial(actor, input, toAuditContext(contextoDePeticion(request)))

  return reply.code(201).send(material)
}

/**
 * PATCH /api/v1/virtual/materiales/:id
 * Actualiza un material virtual (RF-VIR-002).
 * Permiso: virtual.gestionar
 */
export async function actualizarMaterialController(
  request: FastifyRequest<{ Params: { id: string }; Body: ActualizarMaterialInput }>,
  reply: FastifyReply,
): Promise<void> {
  const actor = getActor(request)
  const { id } = request.params
  const input = parseOrThrow(actualizarMaterialSchema, request.body)

  const material = await actualizarMaterial(actor, id, input, toAuditContext(contextoDePeticion(request)))

  return reply.send(material)
}

/**
 * DELETE /api/v1/virtual/materiales/:id
 * Elimina lógicamente un material (RF-VIR-003).
 * Permiso: virtual.gestionar (dueño) o virtual.eliminar (DI/SA)
 */
export async function eliminarMaterialController(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const actor = getActor(request)
  const { id } = request.params

  await eliminarMaterial(actor, id, toAuditContext(contextoDePeticion(request)))

  return reply.code(204).send()
}

/**
 * GET /api/v1/virtual/materiales
 * Lista materiales con alcance por vínculo (RF-VIR-004).
 * Permiso: virtual.leer
 */
export async function listarMaterialesController(
  request: FastifyRequest<{ Querystring: ListarMaterialesQuery }>,
  reply: FastifyReply,
): Promise<void> {
  const actor = getActor(request)
  const query = parseOrThrow(listarMaterialesQuerySchema, request.query)
  const anioId = leerAnioId(request)

  const resultado = await listarMateriales(actor, anioId, query)

  return reply.send(resultado)
}

/**
 * GET /api/v1/virtual/materiales/:id
 * Obtiene el detalle de un material (RF-VIR-003).
 * Permiso: virtual.leer + vínculo
 */
export async function obtenerMaterialController(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const actor = getActor(request)
  const { id } = request.params
  const anioId = leerAnioId(request)

  const material = await obtenerMaterial(actor, id, anioId)

  return reply.send(material)
}

/**
 * GET /api/v1/virtual/materiales/:id/download
 * Prepara la descarga de un material (RF-VIR-005).
 * Permiso: virtual.leer + vínculo
 */
export async function descargarMaterialController(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const actor = getActor(request)
  const { id } = request.params
  const anioId = leerAnioId(request)

  const { archivoNombre, archivoMime, tamanoBytes } = await prepararDescargaMaterial(
    actor,
    id,
    anioId,
    toAuditContext(contextoDePeticion(request)),
  )

  // TODO: En producción, servir archivo desde disco/S3 con streaming
  // Por ahora devolvemos la información para que el frontend la use
  return reply.send({
    url: `/api/v1/virtual/materiales/${id}/file`, // Endpoint real de descarga
    archivoNombre,
    archivoMime,
    tamanoBytes,
  })
}
