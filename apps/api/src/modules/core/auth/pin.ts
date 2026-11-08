import { randomInt } from 'node:crypto'

/** Longitud del PIN temporal generado por el sistema (RN-CORE-016). */
export const PIN_TEMPORAL_LENGTH = 8

const MINIMO = 10 ** (PIN_TEMPORAL_LENGTH - 1)
const MAXIMO = 10 ** PIN_TEMPORAL_LENGTH
const INTENTOS_MAXIMOS = 20

/**
 * Genera un PIN numérico temporal para un usuario recién creado.
 *
 * RN-CORE-016 prohíbe usar el documento o la fecha de nacimiento como
 * contraseña inicial. El PIN es aleatorio y se entrega una sola vez; el primer
 * acceso obliga al usuario a definir una contraseña definitiva.
 *
 * @param excluir Valores que el PIN no puede repetir (por ejemplo, el número
 * de documento), comparados como texto exacto.
 * @throws Error si tras varios intentos no logra evitar los valores excluidos.
 */
export function generarPinTemporal(
  excluir: readonly string[] = [],
): string {
  const prohibidos = new Set(
    excluir.map((valor) => valor.trim()).filter((valor) => valor !== ''),
  )

  for (let intento = 0; intento < INTENTOS_MAXIMOS; intento += 1) {
    const pin = String(randomInt(MINIMO, MAXIMO))

    if (!prohibidos.has(pin)) {
      return pin
    }
  }

  throw new Error('No se pudo generar un PIN temporal distinto de los valores excluidos.')
}
