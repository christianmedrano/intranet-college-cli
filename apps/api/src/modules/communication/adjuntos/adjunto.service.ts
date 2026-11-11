import type { PrismaClient } from '../../../generated/prisma/client.js'
import type { Prisma } from '../../../generated/prisma/client.js'
import { getPrisma } from '../../../core/db.js'
import { AppError } from '../../../core/errors.js'
import { TIPOS_MIME_PERMITIDOS, TAMANO_MAXIMO_BYTES, esTipoMimePermitido, esTamanoValido } from '@intranet/shared'
import { aFechaISO } from '../../core/estructura/fechas.js'

/** Cliente Prisma o transaccional. */
type PrismaClientOrTx = PrismaClient | Prisma.TransactionClient

/**
 * Sube un adjunto a un anuncio.
 */
export async function subirAdjuntoAnuncio(
  anuncioId: string,
  archivo: { buffer: Buffer; originalname: string; mimetype: string; size: number },
  _actorId: string,
  prisma: PrismaClientOrTx = getPrisma(),
) {
  // Validar tipo MIME
  if (!esTipoMimePermitido(archivo.mimetype)) {
    throw new AppError('VALIDATION_ERROR', `Tipo de archivo no permitido: ${archivo.mimetype}. Tipos permitidos: ${TIPOS_MIME_PERMITIDOS.join(', ')}`)
  }

  // Validar tamaño
  if (!esTamanoValido(archivo.size)) {
    throw new AppError('VALIDATION_ERROR', `Archivo demasiado grande. Máximo ${TAMANO_MAXIMO_BYTES / 1024 / 1024} MB`)
  }

  // Verificar que el anuncio existe
  const anuncio = await prisma.anuncio.findUnique({
    where: { id: anuncioId, deletedAt: null },
    select: { id: true },
  })

  if (!anuncio) {
    throw new AppError('NOT_FOUND', 'El anuncio no existe.')
  }

  // Generar nombre almacenado único
  const extension = archivo.originalname.split('.').pop()?.toLowerCase() || ''
  const nombreAlmacenado = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.${extension}`
  const rutaAlmacenamiento = `uploads/anuncios/${anuncioId}/${nombreAlmacenado}`

  // TODO: En producción, guardar archivo en disco/S3
  // await fs.promises.writeFile(rutaAlmacenamiento, archivo.buffer)

  const creado = await prisma.adjuntoAnuncio.create({
    data: {
      anuncioId,
      nombreOriginal: archivo.originalname,
      nombreAlmacenado: rutaAlmacenamiento,
      tipoMime: archivo.mimetype,
      tamanoBytes: archivo.size,
    },
  })

  return {
    id: creado.id,
    nombreOriginal: creado.nombreOriginal,
    url: `/api/v1/anuncios/adjuntos/${creado.id}/download`,
    tipoMime: creado.tipoMime,
    tamanoBytes: creado.tamanoBytes,
    createdAt: aFechaISO(creado.createdAt),
  }
}

/**
 * Sube un adjunto a un mensaje.
 */
export async function subirAdjuntoMensaje(
  mensajeId: string,
  archivo: { buffer: Buffer; originalname: string; mimetype: string; size: number },
  _actorId: string,
  prisma: PrismaClientOrTx = getPrisma(),
) {
  if (!esTipoMimePermitido(archivo.mimetype)) {
    throw new AppError('VALIDATION_ERROR', `Tipo de archivo no permitido: ${archivo.mimetype}`)
  }

  if (!esTamanoValido(archivo.size)) {
    throw new AppError('VALIDATION_ERROR', `Archivo demasiado grande. Máximo ${TAMANO_MAXIMO_BYTES / 1024 / 1024} MB`)
  }

  const mensaje = await prisma.mensajeSeccion.findUnique({
    where: { id: mensajeId, deletedAt: null },
    select: { id: true },
  })

  if (!mensaje) {
    throw new AppError('NOT_FOUND', 'El mensaje no existe.')
  }

  const extension = archivo.originalname.split('.').pop()?.toLowerCase() || ''
  const nombreAlmacenado = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.${extension}`
  const rutaAlmacenamiento = `uploads/mensajes/${mensajeId}/${nombreAlmacenado}`

  // TODO: En producción, guardar archivo en disco/S3

  const creado = await prisma.adjuntoMensaje.create({
    data: {
      mensajeId,
      nombreOriginal: archivo.originalname,
      nombreAlmacenado: rutaAlmacenamiento,
      tipoMime: archivo.mimetype,
      tamanoBytes: archivo.size,
    },
  })

  return {
    id: creado.id,
    nombreOriginal: creado.nombreOriginal,
    url: `/api/v1/mensajes/adjuntos/${creado.id}/download`,
    tipoMime: creado.tipoMime,
    tamanoBytes: creado.tamanoBytes,
    createdAt: aFechaISO(creado.createdAt),
  }
}

/**
 * Elimina un adjunto de anuncio.
 */
export async function eliminarAdjuntoAnuncio(
  adjuntoId: string,
  actorId: string,
  prisma: PrismaClientOrTx = getPrisma(),
) {
  const adjunto = await prisma.adjuntoAnuncio.findUnique({
    where: { id: adjuntoId },
    include: { anuncio: { select: { autorId: true } } },
  })

  if (!adjunto) {
    throw new AppError('NOT_FOUND', 'El adjunto no existe.')
  }

  // Solo el autor del anuncio o un Director pueden eliminar
  // TODO: Verificar rol Director
  if (adjunto.anuncio.autorId !== actorId) {
    // TODO: Verificar si es Director
    throw new AppError('FORBIDDEN', 'Solo el autor del anuncio puede eliminar sus adjuntos.')
  }

  await prisma.adjuntoAnuncio.delete({ where: { id: adjuntoId } })

  // TODO: Eliminar archivo físico
}

/**
 * Elimina un adjunto de mensaje.
 */
export async function eliminarAdjuntoMensaje(
  adjuntoId: string,
  actorId: string,
  prisma: PrismaClientOrTx = getPrisma(),
) {
  const adjunto = await prisma.adjuntoMensaje.findUnique({
    where: { id: adjuntoId },
    include: { mensaje: { select: { autorId: true } } },
  })

  if (!adjunto) {
    throw new AppError('NOT_FOUND', 'El adjunto no existe.')
  }

  if (adjunto.mensaje.autorId !== actorId) {
    throw new AppError('FORBIDDEN', 'Solo el autor del mensaje puede eliminar sus adjuntos.')
  }

  await prisma.adjuntoMensaje.delete({ where: { id: adjuntoId } })

  // TODO: Eliminar archivo físico
}