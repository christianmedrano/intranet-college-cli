import {
  listarNotasFinalesQuerySchema,
  periodoParamSchema,
} from '@intranet/shared'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { contextoDePeticion } from '../../../core/audit.js'
import { AppError } from '../../../core/errors.js'
import { parseOrThrow } from '../../../core/validation.js'
import { listarNotasFinales } from './nota-final.service.js'

/** `GET /api/v1/periodos/:periodoId/notas-finales` — listado con alcance. */
export async function listarNotasFinalesController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const actor = request.authUser

  if (!actor) {
    throw new AppError('UNAUTHORIZED')
  }

  const { periodoId } = parseOrThrow(periodoParamSchema, request.params)
  const { page, pageSize, cursoId, seccionId } = parseOrThrow(
    listarNotasFinalesQuerySchema,
    request.query,
  )

  reply.code(200).send(
    await listarNotasFinales(
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
