import type { InstitucionResponse } from '@intranet/shared'
import type { PrismaClient } from '../../../generated/prisma/client.js'

/** Campos expuestos por el contrato; nunca se devuelven marcas de auditoría. */
const CAMPOS_PUBLICOS = {
  id: true,
  nombre: true,
  direccion: true,
  telefono: true,
  email: true,
  logoUrl: true,
} as const

/**
 * Devuelve la única institución vigente del despliegue (RN-CORE-001).
 *
 * `findFirst` con `deletedAt: null` tolera una base con datos históricos sin
 * asumir cuál es el registro activo. El orden es estable para que el resultado
 * sea determinista si hubiera más de una fila.
 *
 * @param prisma Cliente inyectable para las pruebas.
 * @returns La institución o `null` si no está configurada.
 */
export async function findInstitucionVigente(
  prisma: PrismaClient,
): Promise<InstitucionResponse | null> {
  return prisma.institucion.findFirst({
    where: { deletedAt: null },
    orderBy: { createdAt: 'asc' },
    select: CAMPOS_PUBLICOS,
  })
}

/**
 * Persiste los cambios parciales de la institución.
 *
 * `updatedBy` se escribe con el usuario autenticado para conservar la
 * trazabilidad del modelo, aunque la auditoría formal llegue en T029.
 *
 * @param prisma Cliente inyectable para las pruebas.
 * @param id Identificador de la institución vigente.
 * @param datos Campos ya validados y el usuario que edita.
 */
export async function updateInstitucionRecord(
  prisma: PrismaClient,
  id: string,
  datos: {
    nombre?: string
    direccion?: string | null
    telefono?: string | null
    email?: string | null
    logoUrl?: string | null
    updatedBy: string
  },
): Promise<InstitucionResponse> {
  return prisma.institucion.update({
    where: { id },
    data: datos,
    select: CAMPOS_PUBLICOS,
  })
}
