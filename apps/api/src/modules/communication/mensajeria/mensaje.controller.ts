import {
  crearMensajeSchema,
  listarMensajesQuerySchema,
  uuidParamSchema,
} from '@intranet/shared'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { AppError } from '../../../core/errors.js'
import { parseOrThrow } from '../../../core/validation.js'
import {
  archivarMensajeService,
  enviarMensajeService,
  listarMensajesService,
} from './mensaje.service.js'

/** `POST /api/v1/secciones/:id/mensajes` — enviar mensaje a hilo de sección (RF-COM-004). */
export async function enviarMensajeController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const actor = request.authUser

  if (!actor) {
    throw new AppError('UNAUTHORIZED')
  }

  const { id } = parseOrThrow(uuidParamSchema, request.params)
  const input = parseOrThrow(crearMensajeSchema, request.body)

  const mensaje = await enviarMensajeService(id, input, actor)

  reply.code(201).send(mensaje)
}

/** `GET /api/v1/secciones/:id/mensajes` — listar mensajes de hilo de sección (RF-COM-005). */
export async function listarMensajesController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const actor = request.authUser

  if (!actor) {
    throw new AppError('UNAUTHORIZED')
  }

  const { id } = parseOrThrow(uuidParamSchema, request.params)
  const { page, pageSize } = parseOrThrow(listarMensajesQuerySchema, request.query)

  const resultado = await listarMensajesService(
    { seccionId: id },
    { page, pageSize },
    actor,
  )

  reply.code(200).send(resultado)
}

/** `DELETE /api/v1/mensajes/:id` — borrado lógico de mensaje (RF-COM-005). */
export async function archivarMensajeController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const actor = request.authUser

  if (!actor) {
    throw new AppError('UNAUTHORIZED')
  }

  const { id } = parseOrThrow(uuidParamSchema, request.params)

  await archivarMensajeService(id, actor)

  reply.code(204).send()
}