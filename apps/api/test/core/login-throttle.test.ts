import { describe, expect, it } from 'vitest'
import {
  createLoginThrottle,
  LOGIN_ATTEMPT_WINDOW_MS,
  LOGIN_MAX_FAILED_ATTEMPTS,
  loginAttemptKey,
} from '../../src/core/auth/login-throttle.js'

describe('login throttle', () => {
  it('no bloquea antes de alcanzar el máximo de fallos', () => {
    const throttle = createLoginThrottle({ ahora: () => 1_000 })

    for (let intento = 0; intento < LOGIN_MAX_FAILED_ATTEMPTS - 1; intento += 1) {
      throttle.registrarFallo('clave')
    }

    expect(throttle.estaBloqueado('clave')).toBe(false)

    throttle.registrarFallo('clave')

    expect(throttle.estaBloqueado('clave')).toBe(true)
  })

  it('desbloquea al vencer la ventana de 15 minutos', () => {
    let instante = 0
    const throttle = createLoginThrottle({ ahora: () => instante })

    for (let intento = 0; intento < LOGIN_MAX_FAILED_ATTEMPTS; intento += 1) {
      throttle.registrarFallo('clave')
    }

    expect(throttle.estaBloqueado('clave')).toBe(true)

    instante = LOGIN_ATTEMPT_WINDOW_MS - 1
    expect(throttle.estaBloqueado('clave')).toBe(true)

    instante = LOGIN_ATTEMPT_WINDOW_MS
    expect(throttle.estaBloqueado('clave')).toBe(false)
  })

  it('limpia el historial tras un acceso correcto', () => {
    const throttle = createLoginThrottle({ ahora: () => 1_000 })

    for (let intento = 0; intento < LOGIN_MAX_FAILED_ATTEMPTS; intento += 1) {
      throttle.registrarFallo('clave')
    }

    throttle.limpiar('clave')

    expect(throttle.estaBloqueado('clave')).toBe(false)
  })

  it('mantiene independientes las claves', () => {
    const throttle = createLoginThrottle({ ahora: () => 1_000 })

    for (let intento = 0; intento < LOGIN_MAX_FAILED_ATTEMPTS; intento += 1) {
      throttle.registrarFallo('una')
    }

    expect(throttle.estaBloqueado('una')).toBe(true)
    expect(throttle.estaBloqueado('otra')).toBe(false)
  })

  it('normaliza IP e identificador en la clave', () => {
    expect(loginAttemptKey('127.0.0.1', '  Ana.Perez ')).toBe(
      '127.0.0.1|ana.perez',
    )
  })

  it('usa los límites normativos por defecto', () => {
    expect(LOGIN_MAX_FAILED_ATTEMPTS).toBe(5)
    expect(LOGIN_ATTEMPT_WINDOW_MS).toBe(15 * 60 * 1_000)
  })
})
