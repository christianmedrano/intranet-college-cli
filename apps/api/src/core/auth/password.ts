import argon2 from 'argon2'

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
