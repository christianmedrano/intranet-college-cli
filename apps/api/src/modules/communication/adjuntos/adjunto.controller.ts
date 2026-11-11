import type { FastifyReply, FastifyRequest } from 'fastify'
import { uuidParamSchema } from '@intranet/shared'
import { AppError } from '../../../core/errors.js'
import { parseOrThrow } from '../../../core/validation.js'
import {
  eliminarAdjuntoAnuncio,
  eliminarAdjuntoMensaje,
  subirAdjuntoAnuncio,
  subirAdjuntoMensaje,
} from './adjunto.service.js'

/** `POST /api/v1/anuncios/:id/adjuntos` — subir adjunto a anuncio. */
export async function subirAdjuntoAnuncioController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const actor = request.authUser

  if (!actor) {
    throw new AppError('UNAUTHORIZED')
  }

  const { id } = parseOrThrow(uuidParamSchema, request.params)

  const data = await request.file()

  if (!data) {
    throw new AppError('VALIDATION_ERROR', 'No se envió ningún archivo.')
  }

  const chunks: Buffer[] = []
  for await (const chunk of data.file) {
    chunks.push(chunk)
  }
  const buffer = Buffer.concat(chunks)

  const archivo = {
    buffer,
    originalname: data.filename,
    mimetype: data.mimetype,
    size: buffer.length,
  }

  const adjunto = await subirAdjuntoAnuncio(id, archivo, actor.id)

  reply.code(201).send(adjunto)
}

/** `POST /api/v1/mensajes/:id/adjuntos` — subir adjunto a mensaje. */
export async function subirAdjuntoMensajeController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const actor = request.authUser

  if (!actor) {
    throw new AppError('UNAUTHORIZED')
  }

  const { id } = parseOrThrow(uuidParamSchema, request.params)

  const data = await request.file()

  if (!data) {
    throw new AppError('VALIDATION_ERROR', 'No se envió ningún archivo.')
  }

  const chunks: Buffer[] = []
  for await (const chunk of data.file) {
    chunks.push(chunk)
  }
  const buffer = Buffer.concat(chunks)

  const archivo = {
    buffer,
    originalname: data.filename,
    mimetype: data.mimetype,
    size: buffer.length,
  }

  const adjunto = await subirAdjuntoMensaje(id, archivo, actor.id)

  reply.code(201).send(adjunto)
}

/** `DELETE /api/v1/anuncios/adjuntos/:id` — eliminar adjunto de anuncio. */
export async function eliminarAdjuntoAnuncioController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const actor = request.authUser

  if (!actor) {
    throw new AppError('UNAUTHORIZED')
  }

  const { id } = parseOrThrow(uuidParamSchema, request.params)

  await eliminarAdjuntoAnuncio(id, actor.id)

  reply.code(204).send()
}

/** `DELETE /api/v1/mensajes/adjuntos/:id` — eliminar adjunto de mensaje. */
export async function eliminarAdjuntoMensajeController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const actor = request.authUser

  if (!actor) {
    throw new AppError('UNAUTHORIZED')
  }

  const { id } = parseOrThrow(uuidParamSchema, request.params)

  await eliminarAdjuntoMensaje(id, actor.id)

  reply.code(204).send()
}

/** `GET /api/v1/anuncios/adjuntos/:id/download` — descargar adjunto de anuncio. */
export async function descargarAdjuntoAnuncioController(): Promise<void> {
  // TODO: Implementar descarga real desde almacenamiento
  throw new AppError('NOT_FOUND', 'Descarga de adjuntos no implementada en MVP.')

}

/** `GET /api/v1/mensajes/adjuntos/:id/download` — descargar adjunto de mensaje. */
export async function descargarAdjuntoMensajeController(): Promise<void> {
  // TODO: Implementar descarga real desde almacenamiento
  throw new AppError('NOT_FOUND', 'Descarga de adjuntos no implementada en MVP.')

}