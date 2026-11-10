import {
  actualizarNotaFinalSchema,
  crearNotaFinalSchema,
  listarNotasFinalesQuerySchema,
  periodoParamSchema,
  uuidParamSchema,
} from '@intranet/shared'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { contextoDePeticion } from '../../../core/audit.js'
import { AppError } from '../../../core/errors.js'
import { parseOrThrow } from '../../../core/validation.js'
import {
  actualizarNotaFinal,
  crearNotaFinal,
  listarNotasFinales,
} from './nota-final.service.js'

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

/** `POST /api/v1/notas-finales` — registra la nota final manual. */
export async function crearNotaFinalController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const actor = request.authUser

  if (!actor) {
    throw new AppError('UNAUTHORIZED')
  }

  const input = parseOrThrow(crearNotaFinalSchema, request.body)

  reply
    .code(201)
    .send(await crearNotaFinal(input, actor, contextoDePeticion(request)))
}

/**
 * `PATCH /api/v1/notas-finales/:id` — edita con el período abierto o corrige
 * con motivo después del cierre.
 */
export async function actualizarNotaFinalController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const actor = request.authUser

  if (!actor) {
    throw new AppError('UNAUTHORIZED')
  }

  const { id } = parseOrThrow(uuidParamSchema, request.params)
  const input = parseOrThrow(actualizarNotaFinalSchema, request.body)

  reply
    .code(200)
    .send(
      await actualizarNotaFinal(
        id,
        input,
        actor,
        contextoDePeticion(request),
      ),
    )
}
