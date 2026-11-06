import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { loadEnvFile } from 'node:process'

/**
 * Aplica las migraciones a la base de pruebas (`TEST_DATABASE_URL`).
 *
 * `prisma migrate deploy` lee la URL del config, así que este script la
 * sustituye por la de pruebas, sin exigir `cross-env` ni comandos por sistema
 * operativo. No usa shadow database.
 */
if (existsSync('.env')) {
  loadEnvFile()
}

const url = process.env.TEST_DATABASE_URL

if (!url) {
  console.error(
    'TEST_DATABASE_URL no está definida. Copia apps/api/.env.example y apunta la variable a una base terminada en "_test".',
  )
  process.exit(1)
}

if (!new URL(url).pathname.endsWith('_test')) {
  console.error(
    'TEST_DATABASE_URL debe apuntar a una base terminada en "_test".',
  )
  process.exit(1)
}

const resultado = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, DATABASE_URL: url },
})

process.exit(resultado.status ?? 1)
