import { listarAuditoriaQuerySchema } from '@intranet/shared'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { parseOrThrow } from '../../../core/validation.js'
import { listarAuditoria } from './auditoria.service.js'

/** `GET /api/v1/auditoria` — listado de solo lectura, paginado y filtrable. */
export async function listarAuditoriaController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { page, pageSize, usuarioId, entidad, entidadId, accion, desde, hasta } =
    parseOrThrow(listarAuditoriaQuerySchema, request.query)

  reply
    .code(200)
    .send(
      await listarAuditoria(
        { usuarioId, entidad, entidadId, accion, desde, hasta },
        { page, pageSize },
      ),
    )
}
