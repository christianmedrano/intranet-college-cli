import {
  actualizarApoderadoSchema,
  crearApoderadoSchema,
  paginationSchema,
  uuidParamSchema,
  vincularAlumnoSchema,
} from '@intranet/shared'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { AppError } from '../../../core/errors.js'
import { parseOrThrow } from '../../../core/validation.js'
import {
  actualizarApoderado,
  crearApoderado,
  listarApoderados,
  vincularAlumno,
} from './apoderado.service.js'

/** `GET /api/v1/apoderados` — listado paginado con persona y alumnos. */
export async function listarApoderadosController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const paginacion = parseOrThrow(paginationSchema, request.query)

  reply.code(200).send(await listarApoderados(paginacion))
}

/** `POST /api/v1/apoderados` — crea persona y apoderado en una transacción. */
export async function crearApoderadoController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const actor = request.authUser

  if (!actor) {
    throw new AppError('UNAUTHORIZED')
  }

  const input = parseOrThrow(crearApoderadoSchema, request.body)

  reply.code(201).send(await crearApoderado(input, actor.id))
}

/** `PATCH /api/v1/apoderados/:id` — edición parcial y su persona. */
export async function actualizarApoderadoController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const actor = request.authUser

  if (!actor) {
    throw new AppError('UNAUTHORIZED')
  }

  const { id } = parseOrThrow(uuidParamSchema, request.params)
  const input = parseOrThrow(actualizarApoderadoSchema, request.body)

  reply.code(200).send(await actualizarApoderado(id, input, actor.id))
}

/**
 * `POST /api/v1/apoderados/:id/alumnos` — vincula un alumno.
 *
 * Responde `201` cuando crea el vínculo y `200` cuando actualiza uno existente.
 */
export async function vincularAlumnoController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const actor = request.authUser

  if (!actor) {
    throw new AppError('UNAUTHORIZED')
  }

  const { id } = parseOrThrow(uuidParamSchema, request.params)
  const input = parseOrThrow(vincularAlumnoSchema, request.body)

  const resultado = await vincularAlumno(id, input, actor.id)

  reply
    .code(resultado.creado ? 201 : 200)
    .send(resultado.vinculo)
}
