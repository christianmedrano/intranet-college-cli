import type { FastifyRequest, FastifyReply } from 'fastify'
import { paginationSchema } from '@intranet/shared'
import { AppError } from '../../../core/errors.js'
import { parseOrThrow } from '../../../core/validation.js'
import { contextoDePeticion } from '../../../core/audit.js'
import {
  subirAdjunto,
  eliminarAdjunto,
  prepararDescargaAdjunto,
  listarAdjuntos,
} from './adjunto.service.js'
import type { ActorVirtual } from '../materiales/material.scope.js'

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

/** Convierte ContextoAuditoria null a undefined para compatibilidad. */
function toAuditContext(ctx: { ip?: string | null; userAgent?: string | null }): { ip?: string; userAgent?: string } {
  return {
    ip: ctx.ip ?? undefined,
    userAgent: ctx.userAgent ?? undefined,
  }
}

/** Lee `materialId` de la query y falla con 400 si falta. */
function leerMaterialId(request: FastifyRequest<{ Querystring: { materialId?: string } }>): string {
  const { materialId } = request.query

  if (!materialId) {
    throw new AppError('VALIDATION_ERROR', 'Se requiere materialId en query.')
  }

  return materialId
}

/**
 * POST /api/v1/virtual/materiales/:id/adjuntos
 * Sube un adjunto a un material (RF-VIR-005).
 * Permiso: virtual.gestionar
 */
export async function subirAdjuntoController(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const actor = getActor(request)
  const { id: materialId } = request.params

  const data = await request.file()
  if (!data) {
    throw new AppError('VALIDATION_ERROR', 'No se envió ningún archivo.')
  }

  // Leer el buffer completo
  const chunks: Buffer[] = []
  for await (const chunk of data.file) {
    chunks.push(chunk)
  }
  const buffer = Buffer.concat(chunks)

  const archivo = {
    buffer,
    originalname: data.filename,
    mimetype: data.mimetype,
    size: buffer.length,
  }

  const adjunto = await subirAdjunto(actor, materialId, archivo, toAuditContext(contextoDePeticion(request)))

  return reply.code(201).send(adjunto)
}

/**
 * DELETE /api/v1/virtual/adjuntos/:id
 * Elimina un adjunto (RF-VIR-005).
 * Permiso: virtual.gestionar
 */
export async function eliminarAdjuntoController(
  request: FastifyRequest<{ Params: { id: string }; Querystring: { materialId?: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const actor = getActor(request)
  const { id: adjuntoId } = request.params
  const materialId = leerMaterialId(request)

  await eliminarAdjunto(actor, materialId, adjuntoId, toAuditContext(contextoDePeticion(request)))

  return reply.code(204).send()
}

/**
 * GET /api/v1/virtual/adjuntos/:id/download
 * Prepara la descarga de un adjunto (RF-VIR-005).
 * Permiso: virtual.leer
 */
export async function descargarAdjuntoController(
  request: FastifyRequest<{ Params: { id: string }; Querystring: { materialId?: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const actor = getActor(request)
  const { id: adjuntoId } = request.params
  const materialId = leerMaterialId(request)

  const { nombreOriginal, tipoMime, tamanoBytes } = await prepararDescargaAdjunto(
    actor,
    materialId,
    adjuntoId,
    toAuditContext(contextoDePeticion(request)),
  )

  // TODO: En producción, servir archivo desde disco/S3 con streaming
  // Por ahora devolvemos la información para que el frontend la use
  return reply.send({
    url: `/api/v1/virtual/materiales/${materialId}/adjuntos/${adjuntoId}/file`,
    nombreOriginal,
    archivoMime: tipoMime,
    tamanoBytes,
  })
}

/**
 * GET /api/v1/virtual/materiales/:id/adjuntos
 * Lista adjuntos de un material (RF-VIR-005).
 * Permiso: virtual.leer
 */
export async function listarAdjuntosController(
  request: FastifyRequest<{ Params: { id: string }; Querystring: { page?: string; pageSize?: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const actor = getActor(request)
  const { id: materialId } = request.params
  const { page, pageSize } = parseOrThrow(paginationSchema, request.query)

  const adjuntos = await listarAdjuntos(actor, materialId, page, pageSize)

  return reply.send(adjuntos)
}
