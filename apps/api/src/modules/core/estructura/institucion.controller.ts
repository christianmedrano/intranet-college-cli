import { actualizarInstitucionSchema } from '@intranet/shared'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { AppError } from '../../../core/errors.js'
import { parseOrThrow } from '../../../core/validation.js'
import { getInstitucion, updateInstitucion } from './institucion.service.js'

/**
 * `GET /api/v1/institucion`
 *
 * Devuelve la única institución del despliegue. Requiere `requireAuth` y el
 * permiso `core.institucion.editar` (RF-CORE-001).
 */
export async function getInstitucionController(
  _request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  reply.code(200).send(await getInstitucion())
}

/**
 * `PATCH /api/v1/institucion`
 *
 * Actualiza parcialmente los datos de la institución. El permiso ya fue
 * validado por el `preHandler`; aquí se valida el cuerpo y se resuelve el
 * usuario que edita.
 */
export async function updateInstitucionController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const actor = request.authUser

  if (!actor) {
    throw new AppError('UNAUTHORIZED')
  }

  const input = parseOrThrow(actualizarInstitucionSchema, request.body)

  reply.code(200).send(await updateInstitucion(input, actor.id))
}
