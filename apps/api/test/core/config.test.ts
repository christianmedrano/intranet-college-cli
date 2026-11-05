import { describe, expect, it } from 'vitest'
import { loadConfig } from '../../src/core/config.js'

const validEnv: NodeJS.ProcessEnv = {
  DATABASE_URL: 'mysql://user:pass@localhost:3306/intranet_college',
  JWT_SECRET: 'clave-de-pruebas-con-mas-de-32-caracteres',
}

describe('loadConfig', () => {
  it('aplica los valores por defecto del entorno de desarrollo', () => {
    const config = loadConfig(validEnv)

    expect(config.NODE_ENV).toBe('development')
    expect(config.PORT).toBe(3000)
    expect(config.CORS_ORIGIN).toBe('http://localhost:5173')
    expect(config.JWT_EXPIRES_IN).toBe('15m')
    expect(config.MAX_UPLOAD_MB).toBe(10)
  })

  it('convierte los valores numéricos recibidos como texto', () => {
    const config = loadConfig({
      ...validEnv,
      PORT: '4000',
      MAX_UPLOAD_MB: '25',
    })

    expect(config.PORT).toBe(4000)
    expect(config.MAX_UPLOAD_MB).toBe(25)
  })

  it('falla si falta JWT_SECRET', () => {
    expect(() =>
      loadConfig({ DATABASE_URL: validEnv.DATABASE_URL }),
    ).toThrow(/Configuración inválida/)
  })

  it('falla si JWT_SECRET es demasiado corto', () => {
    expect(() =>
      loadConfig({ ...validEnv, JWT_SECRET: 'corto' }),
    ).toThrow(/JWT_SECRET/)
  })

  it('falla si falta DATABASE_URL', () => {
    expect(() =>
      loadConfig({ JWT_SECRET: validEnv.JWT_SECRET }),
    ).toThrow(/DATABASE_URL/)
  })
})
