import {
  listarCalificacionesQuerySchema,
  periodoParamSchema,
} from '@intranet/shared'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { contextoDePeticion } from '../../../core/audit.js'
import { AppError } from '../../../core/errors.js'
import { parseOrThrow } from '../../../core/validation.js'
import { listarCalificaciones } from './calificacion.service.js'

/** `GET /api/v1/periodos/:periodoId/calificaciones` — listado con alcance. */
export async function listarCalificacionesController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const actor = request.authUser

  if (!actor) {
    throw new AppError('UNAUTHORIZED')
  }

  const { periodoId } = parseOrThrow(periodoParamSchema, request.params)
  const { page, pageSize, cursoId, seccionId } = parseOrThrow(
    listarCalificacionesQuerySchema,
    request.query,
  )

  reply.code(200).send(
    await listarCalificaciones(
      periodoId,
      {
        ...(cursoId ? { cursoId } : {}),
        ...(seccionId ? { seccionId } : {}),
      },
      { page, pageSize },
      actor,
      contextoDePeticion(request),
    ),
  )
}
