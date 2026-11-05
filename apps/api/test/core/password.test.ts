import { describe, expect, it } from 'vitest'
import { hashPassword, verifyPassword } from '../../src/core/auth/password.js'

describe('servicio de contraseñas', () => {
  it('genera hashes Argon2id distintos para la misma contraseña', async () => {
    const primero = await hashPassword('ClaveSegura123')
    const segundo = await hashPassword('ClaveSegura123')

    expect(primero).not.toBe(segundo)
    expect(primero.startsWith('$argon2id$')).toBe(true)
    expect(segundo.startsWith('$argon2id$')).toBe(true)
  })

  it('verifica la contraseña correcta', async () => {
    const hash = await hashPassword('ClaveSegura123')

    await expect(verifyPassword(hash, 'ClaveSegura123')).resolves.toBe(true)
  })

  it('rechaza una contraseña incorrecta', async () => {
    const hash = await hashPassword('ClaveSegura123')

    await expect(verifyPassword(hash, 'OtraClave123')).resolves.toBe(false)
  })

  it('devuelve false ante un hash con formato inválido', async () => {
    await expect(verifyPassword('no-es-un-hash', 'ClaveSegura123')).resolves.toBe(
      false,
    )
  })
})
