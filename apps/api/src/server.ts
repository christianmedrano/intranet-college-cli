import { existsSync } from 'node:fs'
import { loadEnvFile } from 'node:process'
import { buildApp } from './app.js'
import { loadConfig } from './core/config.js'

// Cargar .env en desarrollo (en producción las vars vienen del entorno)
if (existsSync('.env')) {
  loadEnvFile()
}

const config = loadConfig()
const app = await buildApp()

try {
  await app.listen({ port: config.PORT, host: '0.0.0.0' })
} catch (error) {
  app.log.error(error)
  process.exit(1)
}
