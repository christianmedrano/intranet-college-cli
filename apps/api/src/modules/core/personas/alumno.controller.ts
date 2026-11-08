import {
  actualizarAlumnoSchema,
  crearAlumnoSchema,
  paginationSchema,
  uuidParamSchema,
} from '@intranet/shared'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { contextoDePeticion } from '../../../core/audit.js'
import { AppError } from '../../../core/errors.js'
import { parseOrThrow } from '../../../core/validation.js'
import {
  actualizarAlumno,
  crearAlumno,
  listarAlumnos,
} from './alumno.service.js'

/** `GET /api/v1/alumnos` — listado paginado con persona y apoderados. */
export async function listarAlumnosController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const paginacion = parseOrThrow(paginationSchema, request.query)

  reply.code(200).send(await listarAlumnos(paginacion))
}

/** `POST /api/v1/alumnos` — crea persona y alumno en una transacción. */
export async function crearAlumnoController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const actor = request.authUser

  if (!actor) {
    throw new AppError('UNAUTHORIZED')
  }

  const input = parseOrThrow(crearAlumnoSchema, request.body)

  reply.code(201).send(await crearAlumno(input, actor.id, contextoDePeticion(request)))
}

/** `PATCH /api/v1/alumnos/:id` — edición parcial del alumno y su persona. */
export async function actualizarAlumnoController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const actor = request.authUser

  if (!actor) {
    throw new AppError('UNAUTHORIZED')
  }

  const { id } = parseOrThrow(uuidParamSchema, request.params)
  const input = parseOrThrow(actualizarAlumnoSchema, request.body)

  reply
    .code(200)
    .send(await actualizarAlumno(id, input, actor.id, contextoDePeticion(request)))
}
