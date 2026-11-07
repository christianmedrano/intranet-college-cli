import {
  actualizarSeccionSchema,
  crearSeccionSchema,
  listarSeccionesQuerySchema,
  uuidParamSchema,
} from '@intranet/shared'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { AppError } from '../../../core/errors.js'
import { parseOrThrow } from '../../../core/validation.js'
import {
  actualizarSeccion,
  crearSeccion,
  listarSecciones,
} from './seccion.service.js'

/** `GET /api/v1/secciones` — listado paginado por grado y/o año. */
export async function listarSeccionesController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { page, pageSize, gradoId, anioId } = parseOrThrow(
    listarSeccionesQuerySchema,
    request.query,
  )

  reply
    .code(200)
    .send(await listarSecciones({ gradoId, anioId }, { page, pageSize }))
}

/** `POST /api/v1/secciones` — crea una sección en un grado y año. */
export async function crearSeccionController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const actor = request.authUser

  if (!actor) {
    throw new AppError('UNAUTHORIZED')
  }

  const input = parseOrThrow(crearSeccionSchema, request.body)

  reply.code(201).send(await crearSeccion(input, actor.id))
}

/** `PATCH /api/v1/secciones/:id` — edición parcial. */
export async function actualizarSeccionController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const actor = request.authUser

  if (!actor) {
    throw new AppError('UNAUTHORIZED')
  }

  const { id } = parseOrThrow(uuidParamSchema, request.params)
  const input = parseOrThrow(actualizarSeccionSchema, request.body)

  reply.code(200).send(await actualizarSeccion(id, input, actor.id))
}
