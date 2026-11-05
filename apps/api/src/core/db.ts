import { PrismaMariaDb } from '@prisma/adapter-mariadb'
import { PrismaClient } from '../generated/prisma/client.js'
import { loadConfig } from './config.js'

let client: PrismaClient | undefined

/**
 * Devuelve el cliente de Prisma como singleton perezoso.
 *
 * La instancia se crea en la primera consulta, no al importar el módulo, para
 * que las pruebas y los comandos que no tocan la base de datos no exijan
 * `DATABASE_URL`.
 *
 * Prisma 7 usa el *query compiler* y requiere un driver adapter.
 */
export function getPrisma(): PrismaClient {
  if (!client) {
    const config = loadConfig()
    client = new PrismaClient({
      adapter: new PrismaMariaDb(config.DATABASE_URL),
    })
  }

  return client
}

/** Cierra la conexión. Pensado para el apagado ordenado y las pruebas. */
export async function disconnectPrisma(): Promise<void> {
  if (client) {
    await client.$disconnect()
    client = undefined
  }
}
