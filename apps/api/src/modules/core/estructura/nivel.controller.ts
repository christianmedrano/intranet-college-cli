import {
  actualizarNivelSchema,
  crearNivelSchema,
  paginationSchema,
  uuidParamSchema,
} from '@intranet/shared'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { AppError } from '../../../core/errors.js'
import { parseOrThrow } from '../../../core/validation.js'
import {
  actualizarNivel,
  crearNivel,
  listarNiveles,
} from './nivel.service.js'

/** `GET /api/v1/niveles` — listado paginado. */
export async function listarNivelesController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const paginacion = parseOrThrow(paginationSchema, request.query)

  reply.code(200).send(await listarNiveles(paginacion))
}

/** `POST /api/v1/niveles` — crea un nivel en la institución. */
export async function crearNivelController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const actor = request.authUser

  if (!actor) {
    throw new AppError('UNAUTHORIZED')
  }

  const input = parseOrThrow(crearNivelSchema, request.body)

  reply.code(201).send(await crearNivel(input, actor.id))
}

/** `PATCH /api/v1/niveles/:id` — edición parcial. */
export async function actualizarNivelController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const actor = request.authUser

  if (!actor) {
    throw new AppError('UNAUTHORIZED')
  }

  const { id } = parseOrThrow(uuidParamSchema, request.params)
  const input = parseOrThrow(actualizarNivelSchema, request.body)

  reply.code(200).send(await actualizarNivel(id, input, actor.id))
}
