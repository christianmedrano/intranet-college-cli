import {
  actualizarMatriculaSchema,
  crearMatriculaSchema,
  listarMatriculasQuerySchema,
  uuidParamSchema,
} from '@intranet/shared'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { AppError } from '../../../core/errors.js'
import { parseOrThrow } from '../../../core/validation.js'
import {
  actualizarEstadoMatricula,
  crearMatricula,
  listarMatriculas,
} from './matricula.service.js'

/** `GET /api/v1/matriculas` — historial paginado y filtrable. */
export async function listarMatriculasController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { page, pageSize, alumnoId, anioId, estado } = parseOrThrow(
    listarMatriculasQuerySchema,
    request.query,
  )

  reply
    .code(200)
    .send(
      await listarMatriculas(
        { alumnoId, anioId, estado },
        { page, pageSize },
      ),
    )
}

/** `POST /api/v1/matriculas` — registra una matrícula `SOLICITADA`. */
export async function crearMatriculaController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const actor = request.authUser

  if (!actor) {
    throw new AppError('UNAUTHORIZED')
  }

  const input = parseOrThrow(crearMatriculaSchema, request.body)

  reply.code(201).send(await crearMatricula(input, actor.id))
}

/** `PATCH /api/v1/matriculas/:id` — cambia el estado de la matrícula. */
export async function actualizarMatriculaController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const actor = request.authUser

  if (!actor) {
    throw new AppError('UNAUTHORIZED')
  }

  const { id } = parseOrThrow(uuidParamSchema, request.params)
  const input = parseOrThrow(actualizarMatriculaSchema, request.body)

  reply.code(200).send(await actualizarEstadoMatricula(id, input, actor.id))
}
