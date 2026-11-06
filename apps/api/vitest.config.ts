import { existsSync } from 'node:fs'
import { loadEnvFile } from 'node:process'
import { defineConfig } from 'vitest/config'

// `.env` aporta TEST_DATABASE_URL a las pruebas de integración. `loadEnvFile`
// no sobrescribe variables ya definidas en el shell.
if (existsSync('.env')) {
  loadEnvFile()
}

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    // Las pruebas de integración comparten `intranet_college_test` y limpian la
    // base entre casos: en paralelo se pisan entre sí.
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ??
        'mysql://test:test@localhost:3306/intranet_college_test',
      JWT_SECRET: 'clave-de-pruebas-con-mas-de-32-caracteres',
    },
  },
})
