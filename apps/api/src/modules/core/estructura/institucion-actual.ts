import type { InstitucionResponse } from '@intranet/shared'
import { AppError } from '../../../core/errors.js'
import type { PrismaClient } from '../../../generated/prisma/client.js'
import { findInstitucionVigente } from './institucion.repository.js'

/**
 * Resuelve la única institución vigente del despliegue (RN-CORE-001).
 *
 * Todas las entidades de estructura cuelgan de esa institución; si no existe,
 * la operación no tiene destino válido y se responde `404`.
 *
 * @throws AppError `NOT_FOUND` si la institución no está configurada.
 */
export async function institucionActual(
  prisma: PrismaClient,
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
