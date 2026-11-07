import type {
  ActualizarInstitucionInput,
  InstitucionResponse,
} from '@intranet/shared'
import { getPrisma } from '../../../core/db.js'
import { AppError } from '../../../core/errors.js'
import type { PrismaClient } from '../../../generated/prisma/client.js'
import {
  findInstitucionVigente,
  updateInstitucionRecord,
} from './institucion.repository.js'

/**
 * Devuelve la configuración de la institución (RF-CORE-001).
 *
 * @param prisma Cliente inyectable para las pruebas.
 * @throws AppError `NOT_FOUND` si el despliegue aún no tiene institución.
 */
export async function getInstitucion(
  prisma: PrismaClient = getPrisma(),
): Promise<InstitucionResponse> {
  const institucion = await findInstitucionVigente(prisma)

  if (!institucion) {
    throw new AppError(
      'NOT_FOUND',
      'La institución no está configurada en este despliegue.',
    )
  }

  return institucion
}

/**
 * Actualiza parcialmente la institución (RF-CORE-001).
 *
 * El permiso `core.institucion.editar` lo valida el `preHandler`; aquí solo se
 * resuelve la institución vigente y se persisten los cambios.
 *
 * @param input Campos validados por Zod.
 * @param usuarioId Usuario autenticado que realiza la edición.
 * @param prisma Cliente inyectable para las pruebas.
 * @throws AppError `NOT_FOUND` si el despliegue aún no tiene institución.
 */
export async function updateInstitucion(
  input: ActualizarInstitucionInput,
  usuarioId: string,
  prisma: PrismaClient = getPrisma(),
): Promise<InstitucionResponse> {
  const institucion = await findInstitucionVigente(prisma)

  if (!institucion) {
    throw new AppError(
      'NOT_FOUND',
      'La institución no está configurada en este despliegue.',
    )
  }

  return updateInstitucionRecord(prisma, institucion.id, {
    ...input,
    updatedBy: usuarioId,
  })
}
