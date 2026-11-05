import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL es obligatoria'),
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET debe tener al menos 32 caracteres'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  REFRESH_EXPIRES_IN: z.string().default('7d'),
  UPLOAD_DIR: z.string().default('./uploads'),
  MAX_UPLOAD_MB: z.coerce.number().int().positive().default(10),
})

export type AppConfig = z.infer<typeof envSchema>

/**
 * Valida las variables de entorno al arranque.
 *
 * Falla de inmediato si falta un secreto o una conexión obligatoria, en lugar
 * de arrastrar el error hasta la primera petición.
 *
 * @param env Entorno a validar. Por defecto `process.env`.
 * @throws Error con el detalle de las variables inválidas.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(env)

  if (!parsed.success) {
    throw new Error(`Configuración inválida: ${parsed.error.message}`)
  }

  return parsed.data
}
