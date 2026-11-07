import {
  actualizarPeriodoAcademicoSchema,
  crearPeriodoAcademicoSchema,
  paginationSchema,
  uuidParamSchema,
} from '@intranet/shared'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { AppError } from '../../../core/errors.js'
import { parseOrThrow } from '../../../core/validation.js'
import {
  actualizarPeriodoAcademico,
  cerrarPeriodoAcademico,
  crearPeriodoAcademico,
  listarPeriodosAcademicos,
} from './periodo-academico.service.js'

/** `GET /api/v1/anios-academicos/:id/periodos` — listado por año. */
export async function listarPeriodosController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { id } = parseOrThrow(uuidParamSchema, request.params)
  const paginacion = parseOrThrow(paginationSchema, request.query)

  reply.code(200).send(await listarPeriodosAcademicos(id, paginacion))
}

/** `POST /api/v1/anios-academicos/:id/periodos` — crea un período. */
export async function crearPeriodoController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const actor = request.authUser

  if (!actor) {
    throw new AppError('UNAUTHORIZED')
  }

  const { id } = parseOrThrow(uuidParamSchema, request.params)
  const input = parseOrThrow(crearPeriodoAcademicoSchema, request.body)

  reply.code(201).send(await crearPeriodoAcademico(id, input, actor.id))
}

/** `PATCH /api/v1/periodos/:id` — edición parcial. */
export async function actualizarPeriodoController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const actor = request.authUser

  if (!actor) {
    throw new AppError('UNAUTHORIZED')
  }

  const { id } = parseOrThrow(uuidParamSchema, request.params)
  const input = parseOrThrow(actualizarPeriodoAcademicoSchema, request.body)

  reply.code(200).send(await actualizarPeriodoAcademico(id, input, actor.id))
}

/** `POST /api/v1/periodos/:id/cerrar` — cierra el período. */
export async function cerrarPeriodoController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const actor = request.authUser

  if (!actor) {
    throw new AppError('UNAUTHORIZED')
  }

  const { id } = parseOrThrow(uuidParamSchema, request.params)

  reply.code(200).send(await cerrarPeriodoAcademico(id, actor.id))
}
