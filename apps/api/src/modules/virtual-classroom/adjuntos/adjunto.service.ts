import {
  TIPOS_MIME_PERMITIDOS,
  TAMANO_MAXIMO_BYTES,
  esTipoMimePermitido,
  esTamanoValido,
  type AdjuntoVirtualResponsePayload,
  type AdjuntoVirtualMetadatosInput,
} from '@intranet/shared'
import { getPrisma } from '../../../core/db.js'
import { AppError } from '../../../core/errors.js'
import { registrarAuditoria } from '../../../core/audit.js'
import {
  assertVinculoMaterial,
  type ActorVirtual,
} from '../materiales/material.scope.js'
import {
  createAdjunto,
  deleteAdjunto,
  findAdjuntoPorId,
  findAdjuntosPorMaterial,
} from './adjunto.repository.js'
import type { PrismaClient } from '../../../generated/prisma/client.js'

/** Genera una ruta de almacenamiento no predecible (RN-VIR-006). */
function generarRutaAlmacenamiento(
  materialId: string,
  extension: string,
): string {
  const uuid = crypto.randomUUID()
  return `uploads/virtual/adjuntos/${materialId}/${uuid}.${extension}`
}

/** Extrae la extensión del nombre original. */
function extraerExtension(nombreOriginal: string): string {
  const partes = nombreOriginal.split('.')
  return partes.length > 1 ? partes.pop()?.toLowerCase() || 'bin' : 'bin'
}

/** Valida metadatos del adjunto (RN-VIR-005). */
function validarMetadatos(metadatos: AdjuntoVirtualMetadatosInput): void {
  if (!esTipoMimePermitido(metadatos.tipoMime)) {
    throw new AppError(
      'VALIDATION_ERROR',
      `Tipo de archivo no permitido: ${metadatos.tipoMime}. Tipos permitidos: ${TIPOS_MIME_PERMITIDOS.join(', ')}`,
    )
  }

  if (!esTamanoValido(metadatos.tamanoBytes)) {
    throw new AppError(
      'VALIDATION_ERROR',
      `Archivo demasiado grande. Máximo ${TAMANO_MAXIMO_BYTES / 1024 / 1024} MB`,
    )
  }
}

/**
 * Sube un adjunto a un material (RF-VIR-005).
 *
 * Reglas:
 * - Usuario debe tener virtual.gestionar + vínculo con el material.
 * - Valida MIME y tamaño (reutiliza communication/adjuntos).
 * - Almacena con nombre seguro (UUID + extensión).
 * - Audita la subida.
 */
export async function subirAdjunto(
  actor: ActorVirtual,
  materialId: string,
  archivo: { buffer: Buffer; originalname: string; mimetype: string; size: number },
  contextoAuditoria: { ip?: string; userAgent?: string },
  prisma: PrismaClient = getPrisma(),
): Promise<AdjuntoVirtualResponsePayload> {
  // Validar permiso de gestión
  const { hasPermission } = await import('../../../core/rbac.js')
  if (!hasPermission(actor.roles, 'virtual.gestionar')) {
    throw new AppError('FORBIDDEN')
  }

  // Verificar vínculo con el material
  await assertVinculoMaterial(actor, materialId, undefined, prisma)

  // Validar archivo
  validarMetadatos({
    nombreOriginal: archivo.originalname,
    tipoMime: archivo.mimetype,
    tamanoBytes: archivo.size,
  })

  // Generar ruta de almacenamiento
  const extension = extraerExtension(archivo.originalname)
  const nombreAlmacenado = generarRutaAlmacenamiento(materialId, extension)

  // TODO: En producción, guardar archivo en disco/S3
  // await fs.promises.writeFile(nombreAlmacenado, archivo.buffer)

  // Crear en transacción con auditoría
  return prisma.$transaction(async (tx) => {
    const adjunto = await createAdjunto(tx, {
      materialId,
      nombreOriginal: archivo.originalname,
      nombreAlmacenado,
      tipoMime: archivo.mimetype,
      tamanoBytes: archivo.size,
    })

    await registrarAuditoria(tx, {
      usuarioId: actor.id,
      accion: 'CREAR',
      entidad: 'AdjuntoVirtual',
      entidadId: adjunto.id,
      datos: {
        materialId,
        nombreOriginal: archivo.originalname,
        tipoMime: archivo.mimetype,
        tamanoBytes: archivo.size,
      },
      ip: contextoAuditoria.ip,
      userAgent: contextoAuditoria.userAgent,
    })

    return adjunto
  })
}

/**
 * Elimina un adjunto (RF-VIR-005).
 *
 * Reglas:
 * - Usuario debe tener virtual.gestionar + vínculo con el material.
 * - Solo dueño del material o Director/SuperAdmin.
 * - Audita la eliminación.
 * - Elimina archivo físico (TODO: implementar en producción).
 */
export async function eliminarAdjunto(
  actor: ActorVirtual,
  materialId: string,
  adjuntoId: string,
  contextoAuditoria: { ip?: string; userAgent?: string },
  prisma: PrismaClient = getPrisma(),
): Promise<void> {
  // Validar permiso de gestión
  const { hasPermission } = await import('../../../core/rbac.js')
  if (!hasPermission(actor.roles, 'virtual.gestionar')) {
    throw new AppError('FORBIDDEN')
  }

  // Verificar que el adjunto existe y pertenece al material
  const adjunto = await findAdjuntoPorId(prisma, adjuntoId)
  if (!adjunto) {
    throw new AppError('NOT_FOUND', 'El adjunto no existe.')
  }

  if (adjunto.materialId !== materialId) {
    throw new AppError('FORBIDDEN', 'El adjunto no pertenece a este material.')
  }

  // Verificar vínculo con el material (permiso de lectura sobre el material padre)
  await assertVinculoMaterial(actor, materialId, undefined, prisma)

  // Eliminar en transacción con auditoría
  await prisma.$transaction(async (tx) => {
    await deleteAdjunto(tx, adjuntoId)

    await registrarAuditoria(tx, {
      usuarioId: actor.id,
      accion: 'ELIMINAR',
      entidad: 'AdjuntoVirtual',
      entidadId: adjuntoId,
      datos: {
        materialId,
        nombreOriginal: adjunto.nombreOriginal,
        tipoMime: adjunto.tipoMime,
        tamanoBytes: adjunto.tamanoBytes,
      },
      ip: contextoAuditoria.ip,
      userAgent: contextoAuditoria.userAgent,
    })

    // TODO: Eliminar archivo físico del disco/S3
  })
}

/**
 * Prepara la descarga de un adjunto (RF-VIR-005).
 *
 * Reglas:
 * - Requiere virtual.leer + vínculo con el material padre.
 * - Audita el acceso.
 * - Devuelve ruta y metadatos para streaming.
 */
export async function prepararDescargaAdjunto(
  actor: ActorVirtual,
  materialId: string,
  adjuntoId: string,
  contextoAuditoria: { ip?: string; userAgent?: string },
  prisma: PrismaClient = getPrisma(),
): Promise<{ nombreAlmacenado: string; nombreOriginal: string; tipoMime: string; tamanoBytes: number }> {
  // Validar permiso de lectura
  const { hasPermission } = await import('../../../core/rbac.js')
  if (!hasPermission(actor.roles, 'virtual.leer')) {
    throw new AppError('FORBIDDEN')
  }

  // Verificar que el adjunto existe y pertenece al material
  const adjunto = await findAdjuntoPorId(prisma, adjuntoId)
  if (!adjunto) {
    throw new AppError('NOT_FOUND', 'El adjunto no existe.')
  }

  if (adjunto.materialId !== materialId) {
    throw new AppError('FORBIDDEN', 'El adjunto no pertenece a este material.')
  }

  // Verificar vínculo con el material padre
  await assertVinculoMaterial(actor, materialId, undefined, prisma)

  // Auditar acceso
  await registrarAuditoria(prisma, {
    usuarioId: actor.id,
    accion: 'ACCEDER',
    entidad: 'AdjuntoVirtual',
    entidadId: adjuntoId,
    datos: { tipo: 'descarga' },
    ip: contextoAuditoria.ip,
    userAgent: contextoAuditoria.userAgent,
  })

  return {
    nombreAlmacenado: adjunto.nombreAlmacenado,
    nombreOriginal: adjunto.nombreOriginal,
    tipoMime: adjunto.tipoMime,
    tamanoBytes: adjunto.tamanoBytes,
  }
}

/**
 * Lista adjuntos de un material (RF-VIR-005).
 */
export async function listarAdjuntos(
  actor: ActorVirtual,
  materialId: string,
  pagina: number = 1,
  pageSize: number = 20,
  prisma: PrismaClient = getPrisma(),
): Promise<AdjuntoVirtualResponsePayload[]> {
  // Validar permiso de lectura
  const { hasPermission } = await import('../../../core/rbac.js')
  if (!hasPermission(actor.roles, 'virtual.leer')) {
    throw new AppError('FORBIDDEN')
  }

  // Verificar vínculo con el material padre (el año se toma del período del material)
  await assertVinculoMaterial(actor, materialId, undefined, prisma)

  return findAdjuntosPorMaterial(prisma, materialId, { page: pagina, pageSize })
}