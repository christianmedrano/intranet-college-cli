import { AppError } from '../errors.js'

/** Máximo de intentos fallidos por ventana (RF-CORE-004). */
export const LOGIN_MAX_FAILED_ATTEMPTS = 5

/** Ventana de observación: 15 minutos. */
export const LOGIN_ATTEMPT_WINDOW_MS = 15 * 60 * 1_000

/** Tope de claves antes de podar entradas vencidas. */
const MAX_ENTRADAS = 10_000

export interface LoginThrottleOptions {
  maxIntentos?: number
  ventanaMs?: number
  /** Reloj inyectable para probar la expiración sin esperar. */
  ahora?: () => number
}

export interface LoginThrottle {
  /** Indica si el sexto intento debe rechazarse con `429`. */
  estaBloqueado(clave: string): boolean
  /** Suma un intento fallido y abre la ventana si es el primero. */
  registrarFallo(clave: string): void
  /** Descarta el historial de una clave tras un inicio de sesión exitoso. */
  limpiar(clave: string): void
}

interface Entrada {
  fallos: number
  reiniciaEn: number
}

/**
 * Crea un contador de intentos fallidos de login.
 *
 * La ventana es fija y empieza en el primer fallo: durante 15 minutos se
 * acumulan los fallos y, al alcanzar el máximo, cualquier intento posterior
 * se rechaza hasta que la ventana expire. Un inicio de sesión exitoso borra el
 * historial de esa clave.
 *
 * El estado vive en memoria. Es suficiente para el MVP de una instancia; un
 * despliegue con varias réplicas necesitaría un almacén compartido.
 *
 * @param opciones Límites y reloj; por defecto, los de RF-CORE-004.
 */
export function createLoginThrottle(
  opciones: LoginThrottleOptions = {},
): LoginThrottle {
  const maxIntentos = opciones.maxIntentos ?? LOGIN_MAX_FAILED_ATTEMPTS
  const ventanaMs = opciones.ventanaMs ?? LOGIN_ATTEMPT_WINDOW_MS
  const ahora = opciones.ahora ?? Date.now
  const entradas = new Map<string, Entrada>()

  /** Devuelve la entrada vigente y elimina la vencida. */
  function vigente(clave: string): Entrada | undefined {
    const entrada = entradas.get(clave)

    if (!entrada) {
      return undefined
    }

    if (entrada.reiniciaEn <= ahora()) {
      entradas.delete(clave)
      return undefined
    }

    return entrada
  }

  /** Elimina entradas vencidas cuando el mapa crece demasiado. */
  function podarVencidas(): void {
    const instante = ahora()

    for (const [clave, entrada] of entradas) {
      if (entrada.reiniciaEn <= instante) {
        entradas.delete(clave)
      }
    }
  }

  return {
    estaBloqueado(clave) {
      const entrada = vigente(clave)
      return entrada !== undefined && entrada.fallos >= maxIntentos
    },

    registrarFallo(clave) {
      const entrada = vigente(clave)

      if (!entrada) {
        if (entradas.size >= MAX_ENTRADAS) {
          podarVencidas()
        }

        entradas.set(clave, {
          fallos: 1,
          reiniciaEn: ahora() + ventanaMs,
        })
        return
      }

      entrada.fallos += 1
    },

    limpiar(clave) {
      entradas.delete(clave)
    },
  }
}

/**
 * Construye la clave de conteo.
 *
 * Combina IP e identificador normalizado: así un atacante no puede bloquear a
 * un usuario desde otras IP, y una red compartida (NAT) no bloquea a todos sus
 * usuarios por los fallos de uno.
 */
export function loginAttemptKey(ip: string, identificador: string): string {
  return `${ip}|${identificador.trim().toLowerCase()}`
}

/** Instancia usada por la ruta de login. */
export const loginThrottle = createLoginThrottle()

/**
 * Rechaza el intento cuando la clave ya acumuló el máximo de fallos.
 *
 * @throws AppError `RATE_LIMITED` si la ventana sigue abierta.
 */
export function assertLoginAllowed(clave: string): void {
  if (loginThrottle.estaBloqueado(clave)) {
    throw new AppError('RATE_LIMITED')
  }
}

/** Registra un fallo de autenticación. */
export function recordLoginFailure(clave: string): void {
  loginThrottle.registrarFallo(clave)
}

/** Limpia el historial tras un inicio de sesión exitoso. */
export function clearLoginFailures(clave: string): void {
  loginThrottle.limpiar(clave)
}
