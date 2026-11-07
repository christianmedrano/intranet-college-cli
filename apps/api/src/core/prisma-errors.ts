import { Prisma } from '../generated/prisma/client.js'

/**
 * Indica si el error es una violación de unicidad de MySQL (Prisma `P2002`).
 *
 * Los servicios lo usan para traducir el error de base a `CONFLICT` sin
 * exponer detalles del motor al cliente.
 */
export function esConflictoDeUnicidad(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  )
}
