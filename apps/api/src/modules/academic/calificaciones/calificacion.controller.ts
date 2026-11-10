import {
  actualizarCalificacionSchema,
  crearCalificacionSchema,
  listarCalificacionesQuerySchema,
  periodoParamSchema,
  uuidParamSchema,
} from '@intranet/shared'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { contextoDePeticion } from '../../../core/audit.js'
import { AppError } from '../../../core/errors.js'
import { parseOrThrow } from '../../../core/validation.js'
import {
  actualizarCalificacion,
  crearCalificacion,
  listarCalificaciones,
  resumenCalificacionesPeriodo,
} from './calificacion.service.js'

/** `GET /api/v1/periodos/:periodoId/calificaciones` — listado con alcance. */
export async function listarCalificacionesController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const actor = request.authUser

  if (!actor) {
    throw new AppError('UNAUTHORIZED')
  }

  const { periodoId } = parseOrThrow(periodoParamSchema, request.params)
  const { page, pageSize, cursoId, seccionId } = parseOrThrow(
    listarCalificacionesQuerySchema,
    request.query,
  )

  reply.code(200).send(
    await listarCalificaciones(
      periodoId,
      {
        ...(cursoId ? { cursoId } : {}),
        ...(seccionId ? { seccionId } : {}),
      },
      { page, pageSize },
      actor,
      contextoDePeticion(request),
    ),
  )
}

/**
 * `GET /api/v1/periodos/:periodoId/calificaciones/resumen` — indica si el
 * período tiene calificaciones o notas finales (RF-ACAD-012).
 */
export async function resumenCalificacionesController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const actor = request.authUser

  if (!actor) {
    throw new AppError('UNAUTHORIZED')
  }

  const { periodoId } = parseOrThrow(periodoParamSchema, request.params)

  reply.code(200).send(await resumenCalificacionesPeriodo(periodoId, actor))
}

/** `POST /api/v1/calificaciones` — registra una calificación literal. */
export async function crearCalificacionController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const actor = request.authUser

  if (!actor) {
    throw new AppError('UNAUTHORIZED')
  }

  const input = parseOrThrow(crearCalificacionSchema, request.body)

  reply
    .code(201)
    .send(await crearCalificacion(input, actor, contextoDePeticion(request)))
}

/**
 * `PATCH /api/v1/calificaciones/:id` — edita con el período abierto o corrige
 * con motivo después del cierre.
 */
export async function actualizarCalificacionController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const actor = request.authUser

  if (!actor) {
    throw new AppError('UNAUTHORIZED')
  }

  const { id } = parseOrThrow(uuidParamSchema, request.params)
  const input = parseOrThrow(actualizarCalificacionSchema, request.body)

  reply
    .code(200)
    .send(
      await actualizarCalificacion(
        id,
        input,
        actor,
        contextoDePeticion(request),
      ),
    )
}
