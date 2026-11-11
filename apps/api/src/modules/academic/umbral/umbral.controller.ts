import { umbralAsistenciaSchema, uuidParamSchema } from '@intranet/shared'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { contextoDePeticion } from '../../../core/audit.js'
import { AppError } from '../../../core/errors.js'
import { parseOrThrow } from '../../../core/validation.js'
import { guardarUmbral, obtenerUmbral } from './umbral.service.js'

/** `GET /api/v1/anios-academicos/:id/umbral-asistencia` (RF-ACAD-008). */
export async function obtenerUmbralController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const actor = request.authUser

  if (!actor) {
    throw new AppError('UNAUTHORIZED')
  }

  const { id } = parseOrThrow(uuidParamSchema, request.params)

  reply.code(200).send(await obtenerUmbral(id, actor))
}

/** `PUT /api/v1/anios-academicos/:id/umbral-asistencia` (RF-ACAD-008). */
export async function guardarUmbralController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const actor = request.authUser

  if (!actor) {
    throw new AppError('UNAUTHORIZED')
  }

  const { id } = parseOrThrow(uuidParamSchema, request.params)
  const input = parseOrThrow(umbralAsistenciaSchema, request.body)

  reply
    .code(200)
    .send(
      await guardarUmbral(id, input, actor, contextoDePeticion(request)),
    )
}
