import {
  actualizarAnioAcademicoSchema,
  crearAnioAcademicoSchema,
  paginationSchema,
  uuidParamSchema,
} from '@intranet/shared'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { AppError } from '../../../core/errors.js'
import { parseOrThrow } from '../../../core/validation.js'
import {
  activarAnioAcademico,
  actualizarAnioAcademico,
  crearAnioAcademico,
  listarAniosAcademicos,
} from './anio-academico.service.js'

/** `GET /api/v1/anios-academicos` — listado paginado. */
export async function listarAniosController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const paginacion = parseOrThrow(paginationSchema, request.query)

  reply.code(200).send(await listarAniosAcademicos(paginacion))
}

/** `POST /api/v1/anios-academicos` — crea un año `PLANIFICADO`. */
export async function crearAnioController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const actor = request.authUser

  if (!actor) {
    throw new AppError('UNAUTHORIZED')
  }

  const input = parseOrThrow(crearAnioAcademicoSchema, request.body)

  reply.code(201).send(await crearAnioAcademico(input, actor.id))
}

/** `PATCH /api/v1/anios-academicos/:id` — edición parcial. */
export async function actualizarAnioController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const actor = request.authUser

  if (!actor) {
    throw new AppError('UNAUTHORIZED')
  }

  const { id } = parseOrThrow(uuidParamSchema, request.params)
  const input = parseOrThrow(actualizarAnioAcademicoSchema, request.body)

  reply.code(200).send(await actualizarAnioAcademico(id, input, actor.id))
}

/** `POST /api/v1/anios-academicos/:id/activar` — activación transaccional. */
export async function activarAnioController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const actor = request.authUser

  if (!actor) {
    throw new AppError('UNAUTHORIZED')
  }

  const { id } = parseOrThrow(uuidParamSchema, request.params)

  reply.code(200).send(await activarAnioAcademico(id, actor.id))
}
