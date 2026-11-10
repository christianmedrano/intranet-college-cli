import {
  corregirAsistenciaSchema,
  listarAsistenciasQuerySchema,
  registrarAsistenciaLoteSchema,
  uuidParamSchema,
} from '@intranet/shared'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { contextoDePeticion } from '../../../core/audit.js'
import { AppError } from '../../../core/errors.js'
import { parseOrThrow } from '../../../core/validation.js'
import {
  corregirAsistencia,
  listarAsistencias,
  registrarAsistenciaLote,
} from './asistencia.service.js'

/** `GET /api/v1/asistencias` — listado paginado y filtrable con alcance. */
export async function listarAsistenciasController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const actor = request.authUser

  if (!actor) {
    throw new AppError('UNAUTHORIZED')
  }

  const { page, pageSize, alumnoId, seccionId, anioId, desde, hasta } =
    parseOrThrow(listarAsistenciasQuerySchema, request.query)

  reply.code(200).send(
    await listarAsistencias(
      {
        ...(alumnoId ? { alumnoId } : {}),
        ...(seccionId ? { seccionId } : {}),
        ...(anioId ? { anioId } : {}),
        ...(desde ? { desde } : {}),
        ...(hasta ? { hasta } : {}),
      },
      { page, pageSize },
      actor,
      contextoDePeticion(request),
    ),
  )
}

/**
 * `POST /api/v1/asistencias/lote` — registra la asistencia diaria de una
 * sección de forma atómica (RF-ACAD-004).
 */
export async function registrarAsistenciaLoteController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const actor = request.authUser

  if (!actor) {
    throw new AppError('UNAUTHORIZED')
  }

  const input = parseOrThrow(registrarAsistenciaLoteSchema, request.body)

  const registros = await registrarAsistenciaLote(
    input,
    actor,
    contextoDePeticion(request),
  )

  reply.code(201).send({ registros })
}

/**
 * `PATCH /api/v1/asistencias/:id` — corrige estado u observación con motivo
 * obligatorio (RF-ACAD-005).
 */
export async function corregirAsistenciaController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const actor = request.authUser

  if (!actor) {
    throw new AppError('UNAUTHORIZED')
  }

  const { id } = parseOrThrow(uuidParamSchema, request.params)
  const input = parseOrThrow(corregirAsistenciaSchema, request.body)

  reply
    .code(200)
    .send(await corregirAsistencia(id, input, actor, contextoDePeticion(request)))
}
