import {
  crearJustificacionSchema,
  listarJustificacionesQuerySchema,
  rechazarJustificacionSchema,
  resolverJustificacionSchema,
  uuidParamSchema,
} from '@intranet/shared'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { contextoDePeticion } from '../../../core/audit.js'
import { AppError } from '../../../core/errors.js'
import { parseOrThrow } from '../../../core/validation.js'
import {
  aprobarJustificacion,
  listarJustificaciones,
  rechazarJustificacion,
  solicitarJustificacion,
} from './justificacion.service.js'

/**
 * `POST /api/v1/asistencias/:id/justificaciones` — el apoderado solicita la
 * justificación de una falta (RF-ACAD-006).
 */
export async function solicitarJustificacionController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const actor = request.authUser

  if (!actor) {
    throw new AppError('UNAUTHORIZED')
  }

  const { id } = parseOrThrow(uuidParamSchema, request.params)
  const input = parseOrThrow(crearJustificacionSchema, request.body)

  reply
    .code(201)
    .send(
      await solicitarJustificacion(
        id,
        input,
        actor,
        contextoDePeticion(request),
      ),
    )
}

/** `GET /api/v1/justificaciones` — listado con alcance por vínculo. */
export async function listarJustificacionesController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const actor = request.authUser

  if (!actor) {
    throw new AppError('UNAUTHORIZED')
  }

  const { page, pageSize, estado, alumnoId, seccionId } = parseOrThrow(
    listarJustificacionesQuerySchema,
    request.query,
  )

  reply.code(200).send(
    await listarJustificaciones(
      {
        ...(estado ? { estado } : {}),
        ...(alumnoId ? { alumnoId } : {}),
        ...(seccionId ? { seccionId } : {}),
      },
      { page, pageSize },
      actor,
      contextoDePeticion(request),
    ),
  )
}

/**
 * `POST /api/v1/justificaciones/:id/aprobar` — el tutor o el Director aprueba
 * la solicitud (RF-ACAD-006).
 */
export async function aprobarJustificacionController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const actor = request.authUser

  if (!actor) {
    throw new AppError('UNAUTHORIZED')
  }

  const { id } = parseOrThrow(uuidParamSchema, request.params)
  const input = parseOrThrow(resolverJustificacionSchema, request.body)

  reply
    .code(200)
    .send(
      await aprobarJustificacion(id, input, actor, contextoDePeticion(request)),
    )
}

/**
 * `POST /api/v1/justificaciones/:id/rechazar` — el tutor o el Director rechaza
 * la solicitud con motivo obligatorio (RF-ACAD-006).
 */
export async function rechazarJustificacionController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const actor = request.authUser

  if (!actor) {
    throw new AppError('UNAUTHORIZED')
  }

  const { id } = parseOrThrow(uuidParamSchema, request.params)
  const input = parseOrThrow(rechazarJustificacionSchema, request.body)

  reply
    .code(200)
    .send(
      await rechazarJustificacion(
        id,
        input,
        actor,
        contextoDePeticion(request),
      ),
    )
}
