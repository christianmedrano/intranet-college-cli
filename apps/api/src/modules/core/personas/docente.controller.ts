import {
  actualizarDocenteSchema,
  crearDocenteSchema,
  paginationSchema,
  uuidParamSchema,
} from '@intranet/shared'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { AppError } from '../../../core/errors.js'
import { parseOrThrow } from '../../../core/validation.js'
import {
  actualizarDocente,
  crearDocente,
  listarDocentes,
} from './docente.service.js'

/** `GET /api/v1/docentes` — listado paginado con persona. */
export async function listarDocentesController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const paginacion = parseOrThrow(paginationSchema, request.query)

  reply.code(200).send(await listarDocentes(paginacion))
}

/** `POST /api/v1/docentes` — crea persona y docente en una transacción. */
export async function crearDocenteController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const actor = request.authUser

  if (!actor) {
    throw new AppError('UNAUTHORIZED')
  }

  const input = parseOrThrow(crearDocenteSchema, request.body)

  reply.code(201).send(await crearDocente(input, actor.id))
}

/** `PATCH /api/v1/docentes/:id` — edición parcial del docente y su persona. */
export async function actualizarDocenteController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const actor = request.authUser

  if (!actor) {
    throw new AppError('UNAUTHORIZED')
  }

  const { id } = parseOrThrow(uuidParamSchema, request.params)
  const input = parseOrThrow(actualizarDocenteSchema, request.body)

  reply.code(200).send(await actualizarDocente(id, input, actor.id))
}
