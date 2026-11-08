import { describe, expect, it } from 'vitest'
import {
  generarPinTemporal,
  PIN_TEMPORAL_LENGTH,
} from '../../src/modules/core/auth/pin.js'

describe('generarPinTemporal', () => {
  it('genera un PIN numérico de la longitud esperada', () => {
    const pin = generarPinTemporal()

    expect(pin).toMatch(new RegExp(`^\\d{${PIN_TEMPORAL_LENGTH}}$`))
  })

  it('no repite los valores excluidos', () => {
    for (let intento = 0; intento < 50; intento += 1) {
      const pin = generarPinTemporal(['48291375'])

      expect(pin).not.toBe('48291375')
    }
  })
})
