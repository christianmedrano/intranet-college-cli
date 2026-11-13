import { existsSync } from 'node:fs'
import { loadEnvFile } from 'node:process'

// Cargar .env ANTES de cualquier otra importación que use loadConfig()
if (existsSync('.env')) {
  loadEnvFile()
}

// Ahora importar el servidor (esto cargará la config con las vars de entorno ya disponibles)
import('./server.js')