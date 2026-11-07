import {
  actualizarGradoSchema,
  crearGradoSchema,
  listarGradosQuerySchema,
  uuidParamSchema,
} from '@intranet/shared'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { AppError } from '../../../core/errors.js'
import { parseOrThrow } from '../../../core/validation.js'
import {
  actualizarGrado,
  crearGrado,
  listarGrados,
} from './grado.service.js'

/** `GET /api/v1/grados` — listado paginado, filtrable por nivel. */
export async function listarGradosController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { page, pageSize, nivelId } = parseOrThrow(
    listarGradosQuerySchema,
    request.query,
  )

  reply.code(200).send(await listarGrados(nivelId, { page, pageSize }))
}

/** `POST /api/v1/grados` — crea un grado asociado a un nivel. */
export async function crearGradoController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const actor = request.authUser

  if (!actor) {
    throw new AppError('UNAUTHORIZED')
  }

  const input = parseOrThrow(crearGradoSchema, request.body)

  reply.code(201).send(await crearGrado(input, actor.id))
}

/** `PATCH /api/v1/grados/:id` — edición parcial. */
export async function actualizarGradoController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const actor = request.authUser

  if (!actor) {
    throw new AppError('UNAUTHORIZED')
  }

  const { id } = parseOrThrow(uuidParamSchema, request.params)
  const input = parseOrThrow(actualizarGradoSchema, request.body)

  reply.code(200).send(await actualizarGrado(id, input, actor.id))
}
