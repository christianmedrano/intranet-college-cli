import { listarAlertasAsistenciaQuerySchema } from '@intranet/shared'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { contextoDePeticion } from '../../../core/audit.js'
import { AppError } from '../../../core/errors.js'
import { parseOrThrow } from '../../../core/validation.js'
import { listarAlertas } from './alerta.service.js'

/** `GET /api/v1/alertas-asistencia` — listado con alcance por vínculo. */
export async function listarAlertasController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const actor = request.authUser

  if (!actor) {
    throw new AppError('UNAUTHORIZED')
  }

  const { page, pageSize, anioId, alumnoId } = parseOrThrow(
    listarAlertasAsistenciaQuerySchema,
    request.query,
  )

  reply.code(200).send(
    await listarAlertas(
      {
        ...(anioId ? { anioId } : {}),
        ...(alumnoId ? { alumnoId } : {}),
      },
      { page, pageSize },
      actor,
      contextoDePeticion(request),
    ),
  )
}
