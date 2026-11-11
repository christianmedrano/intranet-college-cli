import {
  actualizarHorarioSchema,
  crearHorarioSchema,
  listarHorariosQuerySchema,
  uuidParamSchema,
} from '@intranet/shared'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { contextoDePeticion } from '../../../core/audit.js'
import { AppError } from '../../../core/errors.js'
import { parseOrThrow } from '../../../core/validation.js'
import {
  actualizarHorario,
  crearHorario,
  eliminarHorario,
  listarHorarios,
} from './horario.service.js'

/** `GET /api/v1/horarios` — listado por año con alcance por vínculo. */
export async function listarHorariosController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const actor = request.authUser

  if (!actor) {
    throw new AppError('UNAUTHORIZED')
  }

  const { page, pageSize, anioId, seccionId, docenteId } = parseOrThrow(
    listarHorariosQuerySchema,
    request.query,
  )

  reply.code(200).send(
    await listarHorarios(
      {
        anioId,
        ...(seccionId ? { seccionId } : {}),
        ...(docenteId ? { docenteId } : {}),
      },
      { page, pageSize },
      actor,
      contextoDePeticion(request),
    ),
  )
}

/** `POST /api/v1/horarios` — alta de un bloque (RF-ACAD-010). */
export async function crearHorarioController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const actor = request.authUser

  if (!actor) {
    throw new AppError('UNAUTHORIZED')
  }

  const input = parseOrThrow(crearHorarioSchema, request.body)

  reply
    .code(201)
    .send(await crearHorario(input, actor, contextoDePeticion(request)))
}

/** `PATCH /api/v1/horarios/:id` — actualización parcial (RF-ACAD-010). */
export async function actualizarHorarioController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const actor = request.authUser

  if (!actor) {
    throw new AppError('UNAUTHORIZED')
  }

  const { id } = parseOrThrow(uuidParamSchema, request.params)
  const input = parseOrThrow(actualizarHorarioSchema, request.body)

  reply
    .code(200)
    .send(
      await actualizarHorario(
        id,
        input,
        actor,
        contextoDePeticion(request),
      ),
    )
}

/** `DELETE /api/v1/horarios/:id` — baja lógica (RF-ACAD-010). */
export async function eliminarHorarioController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const actor = request.authUser

  if (!actor) {
    throw new AppError('UNAUTHORIZED')
  }

  const { id } = parseOrThrow(uuidParamSchema, request.params)

  await eliminarHorario(id, actor, contextoDePeticion(request))

  reply.code(204).send()
}
