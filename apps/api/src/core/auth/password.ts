import argon2 from 'argon2'
import { AppError } from '../errors.js'

/** Longitud mínima exigida por RN-CORE-017. */
export const PASSWORD_MIN_LENGTH = 10

/**
 * Genera un hash Argon2id con salt aleatorio.
 *
 * La constitución (§5.3) exige Argon2id; los parámetros por defecto de la
 * librería usan memoria y tiempo de cómputo seguros.
 *
 * @param plainPassword Contraseña en claro. Nunca debe registrarse en logs.
 * @returns Hash codificado en formato PHC (`$argon2id$...`).
 */
export async function hashPassword(plainPassword: string): Promise<string> {
  return argon2.hash(plainPassword, { type: argon2.argon2id })
}

/**
 * Verifica una contraseña contra un hash almacenado.
 *
 * Devuelve `false` ante un hash corrupto o con formato inválido en lugar de
 * propagar el error, para no filtrar detalles internos al cliente.
 *
 * @param hash Hash PHC almacenado en la base de datos.
 * @param plainPassword Contraseña en claro recibida en el borde de la API.
 */
export async function verifyPassword(
  hash: string,
  plainPassword: string,
): Promise<boolean> {
  try {
    return await argon2.verify(hash, plainPassword)
  } catch {
    return false
  }
}

/**
 * Aplica la política de contraseña de RN-CORE-017.
 *
 * Exige al menos 10 caracteres y prohíbe que la contraseña coincida con
 * cualquiera de los identificadores del usuario (usuario, correo o documento).
 * La comparación ignora espacios y mayúsculas para evitar variantes triviales.
 *
 * @param password Contraseña en claro recibida en el borde de la API.
 * @param identificadores Valores que no pueden usarse como contraseña.
 * @throws AppError `VALIDATION_ERROR` con un detalle por cada regla incumplida.
 */
export function assertPasswordPolicy(
  password: string,
  identificadores: readonly (string | null | undefined)[],
): void {
  const problemas: string[] = []

  if (password.length < PASSWORD_MIN_LENGTH) {
    problemas.push(
      `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`,
    )
  }

  const normalizada = password.trim().toLowerCase()
  const coincide = identificadores.some(
    (valor) =>
      typeof valor === 'string' &&
      valor.trim() !== '' &&
      valor.trim().toLowerCase() === normalizada,
  )

  if (coincide) {
    problemas.push(
      'La contraseña no puede ser igual a tu usuario, correo o documento.',
    )
  }

  if (problemas.length > 0) {
    throw new AppError('VALIDATION_ERROR', undefined, problemas)
  }
}
