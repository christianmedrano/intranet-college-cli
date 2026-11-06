import { existsSync } from 'node:fs'
import { loadEnvFile } from 'node:process'
import { disconnectPrisma } from '../src/core/db.js'
import { runSeed } from '../src/core/seed.js'

// `tsx` no carga `.env`; usamos la API nativa de Node (igual que
// `prisma7.config.ts`) para no depender de dotenv.
if (existsSync('.env')) {
  loadEnvFile()
}

try {
  const resultado = await runSeed()

  console.log(
    `Seed aplicado: ${resultado.roles} roles, institución ${resultado.institucionId}, SuperAdmin ${resultado.superAdminCreado ? 'creado' : 'ya existente'}.`,
  )
} catch (error) {
  console.error(
    `Seed falló: ${error instanceof Error ? error.message : 'error desconocido'}`,
  )
  process.exitCode = 1
} finally {
  await disconnectPrisma()
}
