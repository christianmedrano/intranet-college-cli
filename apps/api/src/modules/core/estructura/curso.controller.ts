import {
  actualizarCursoSchema,
  crearCursoSchema,
  listarCursosQuerySchema,
  uuidParamSchema,
} from '@intranet/shared'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { AppError } from '../../../core/errors.js'
import { parseOrThrow } from '../../../core/validation.js'
import {
  actualizarCurso,
  crearCurso,
  listarCursos,
} from './curso.service.js'

/** `GET /api/v1/cursos` — listado paginado, filtrable por nivel. */
export async function listarCursosController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { page, pageSize, nivelId } = parseOrThrow(
    listarCursosQuerySchema,
    request.query,
  )

  reply.code(200).send(await listarCursos(nivelId, { page, pageSize }))
}

/** `POST /api/v1/cursos` — crea un curso asociado a un nivel. */
export async function crearCursoController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const actor = request.authUser

  if (!actor) {
    throw new AppError('UNAUTHORIZED')
  }

  const input = parseOrThrow(crearCursoSchema, request.body)

  reply.code(201).send(await crearCurso(input, actor.id))
}

/** `PATCH /api/v1/cursos/:id` — edición parcial. */
export async function actualizarCursoController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const actor = request.authUser

  if (!actor) {
    throw new AppError('UNAUTHORIZED')
  }

  const { id } = parseOrThrow(uuidParamSchema, request.params)
  const input = parseOrThrow(actualizarCursoSchema, request.body)

  reply.code(200).send(await actualizarCurso(id, input, actor.id))
}
