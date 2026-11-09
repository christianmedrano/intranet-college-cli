import {
  actualizarUsuarioSchema,
  crearUsuarioSchema,
  paginationSchema,
  uuidParamSchema,
} from '@intranet/shared'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { contextoDePeticion } from '../../../core/audit.js'
import { AppError } from '../../../core/errors.js'
import { parseOrThrow } from '../../../core/validation.js'
import {
  actualizarUsuario,
  crearUsuario,
  listarUsuarios,
} from './usuario.service.js'

/** `GET /api/v1/usuarios` — listado paginado con persona y roles. */
export async function listarUsuariosController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const actor = request.authUser

  if (!actor) {
    throw new AppError('UNAUTHORIZED')
  }

  const paginacion = parseOrThrow(paginationSchema, request.query)

  reply.code(200).send(await listarUsuarios(paginacion, actor))
}

/**
 * `POST /api/v1/usuarios` — crea la cuenta con PIN temporal.
 *
 * El PIN en claro solo aparece en esta respuesta (RF-CORE-002, RN-CORE-016).
 */
export async function crearUsuarioController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const actor = request.authUser

  if (!actor) {
    throw new AppError('UNAUTHORIZED')
  }

  const input = parseOrThrow(crearUsuarioSchema, request.body)

  reply
    .code(201)
    .send(await crearUsuario(input, actor, contextoDePeticion(request)))
}

/** `PATCH /api/v1/usuarios/:id` — edita identificadores, estado o roles. */
export async function actualizarUsuarioController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const actor = request.authUser

  if (!actor) {
    throw new AppError('UNAUTHORIZED')
  }

  const { id } = parseOrThrow(uuidParamSchema, request.params)
  const input = parseOrThrow(actualizarUsuarioSchema, request.body)

  reply
    .code(200)
    .send(
      await actualizarUsuario(id, input, actor, contextoDePeticion(request)),
    )
}
