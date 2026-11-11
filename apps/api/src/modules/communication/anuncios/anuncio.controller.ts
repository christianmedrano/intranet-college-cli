import {
  crearAnuncioSchema,
  actualizarAnuncioSchema,
  listarAnunciosQuerySchema,
  uuidParamSchema,
} from '@intranet/shared'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { AppError } from '../../../core/errors.js'
import { parseOrThrow } from '../../../core/validation.js'
import {
  archivarAnuncioService,
  actualizarAnuncioService,
  crearAnuncioService,
  listarAnunciosService,
  obtenerAnuncioService,
} from './anuncio.service.js'

/** `POST /api/v1/anuncios` — crear anuncio (RF-COM-001, RF-COM-002). */
export async function crearAnuncioController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const actor = request.authUser

  if (!actor) {
    throw new AppError('UNAUTHORIZED')
  }

  const input = parseOrThrow(crearAnuncioSchema, request.body)

  const anuncio = await crearAnuncioService(input, actor)

  reply.code(201).send(anuncio)
}

/** `GET /api/v1/anuncios/:id` — obtener anuncio por ID (RF-COM-003). */
export async function obtenerAnuncioController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const actor = request.authUser

  if (!actor) {
    throw new AppError('UNAUTHORIZED')
  }

  const { id } = parseOrThrow(uuidParamSchema, request.params)

  const anuncio = await obtenerAnuncioService(id, actor)

  if (!anuncio) {
    throw new AppError('NOT_FOUND', 'El anuncio no existe o no tienes permiso para verlo.')
  }

  reply.code(200).send(anuncio)
}

/** `PATCH /api/v1/anuncios/:id` — actualizar anuncio (RF-COM-001, RF-COM-002). */
export async function actualizarAnuncioController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const actor = request.authUser

  if (!actor) {
    throw new AppError('UNAUTHORIZED')
  }

  const { id } = parseOrThrow(uuidParamSchema, request.params)
  const input = parseOrThrow(actualizarAnuncioSchema, request.body)

  const anuncio = await actualizarAnuncioService(id, input, actor)

  reply.code(200).send(anuncio)
}

/** `DELETE /api/v1/anuncios/:id` — archivar anuncio (RF-COM-001, RF-COM-002). */
export async function archivarAnuncioController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const actor = request.authUser

  if (!actor) {
    throw new AppError('UNAUTHORIZED')
  }

  const { id } = parseOrThrow(uuidParamSchema, request.params)

  await archivarAnuncioService(id, actor)

  reply.code(204).send()
}

/** `GET /api/v1/anuncios` — listar anuncios con filtros y alcance (RF-COM-003). */
export async function listarAnunciosController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const actor = request.authUser

  if (!actor) {
    throw new AppError('UNAUTHORIZED')
  }

  const { page, pageSize, ...filtros } = parseOrThrow(listarAnunciosQuerySchema, request.query)

  const resultado = await listarAnunciosService(
    filtros,
    { page, pageSize },
    actor,
  )

  reply.code(200).send(resultado)
}