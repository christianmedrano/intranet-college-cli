import { existsSync } from 'node:fs'
import { loadEnvFile } from 'node:process'
import { defineConfig } from 'prisma/config'

// Prisma 7 no carga .env automáticamente. Usamos la API nativa de Node
// en lugar de una dependencia adicional como dotenv.
if (existsSync('.env')) {
  loadEnvFile()
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL,
    // Base dedicada para que `migrate dev` detecte drift sin exigir permisos
    // globales de creación de bases al usuario de la aplicación. Prisma hace
    // un reinicio lógico de esta base, nunca la elimina.
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
})
