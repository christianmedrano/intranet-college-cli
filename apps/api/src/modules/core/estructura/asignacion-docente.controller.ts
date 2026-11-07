import {
  crearAsignacionDocenteSchema,
  listarAsignacionesDocenteQuerySchema,
} from '@intranet/shared'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { AppError } from '../../../core/errors.js'
import { parseOrThrow } from '../../../core/validation.js'
import {
  crearAsignacion,
  listarAsignacionesDocente,
} from './asignacion-docente.service.js'

/** `GET /api/v1/asignaciones-docente` — listado paginado y filtrable. */
export async function listarAsignacionesDocenteController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { page, pageSize, docenteId, cursoId, seccionId, anioId } = parseOrThrow(
    listarAsignacionesDocenteQuerySchema,
    request.query,
  )

  reply
    .code(200)
    .send(
      await listarAsignacionesDocente(
        { docenteId, cursoId, seccionId, anioId },
        { page, pageSize },
      ),
    )
}

/** `POST /api/v1/asignaciones-docente` — asigna un docente a un curso. */
export async function crearAsignacionDocenteController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const actor = request.authUser

  if (!actor) {
    throw new AppError('UNAUTHORIZED')
  }

  const input = parseOrThrow(crearAsignacionDocenteSchema, request.body)

  reply.code(201).send(await crearAsignacion(input, actor.id))
}
