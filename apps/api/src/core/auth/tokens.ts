import { createHash, randomBytes } from 'node:crypto'
import { SignJWT } from 'jose'
import { loadConfig } from '../config.js'

/** Emisor y audiencia del token de acceso; el guard de T012 los exige. */
export const JWT_ISSUER = 'intranet-college'
export const JWT_AUDIENCE = 'intranet-web'

const ALGORITMO = 'HS256'

const FACTORES_MS: Readonly<Record<string, number>> = {
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
}

/**
 * Convierte una duración (`15m`, `7d`, `30s`) a milisegundos.
 *
 * @param valor Duración con formato `<número><s|m|h|d>`.
 * @throws Error si el formato no es válido.
 */
export function parseDurationToMs(valor: string): number {
  const coincidencia = /^(\d+)([smhd])$/.exec(valor.trim())

  if (!coincidencia) {
    throw new Error(
      `Duración inválida "${valor}": usa el formato <número><s|m|h|d>.`,
    )
  }

  const factor = FACTORES_MS[coincidencia[2] ?? '']

  if (!factor) {
    throw new Error(`Unidad de duración inválida en "${valor}".`)
  }

  return Number(coincidencia[1]) * factor
}

function claveSecreta(): Uint8Array {
  return new TextEncoder().encode(loadConfig().JWT_SECRET)
}

export interface AccessToken {
  token: string
  /** Vigencia en segundos, como espera el cliente. */
  expiresIn: number
}

/**
 * Firma un token de acceso de corta duración.
 *
 * El payload solo lleva el identificador del usuario: los roles y permisos se
 * resuelven en cada petición para que una revocación surta efecto de inmediato.
 *
 * @param usuarioId Identificador del usuario autenticado.
 */
export async function signAccessToken(usuarioId: string): Promise<AccessToken> {
  const config = loadConfig()
  const expiresIn = Math.floor(parseDurationToMs(config.JWT_EXPIRES_IN) / 1_000)

  const token = await new SignJWT({})
    .setProtectedHeader({ alg: ALGORITMO })
    .setSubject(usuarioId)
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1_000) + expiresIn)
    .sign(claveSecreta())

  return { token, expiresIn }
}

export interface RefreshToken {
  /** Valor en claro; solo se envía al cliente y nunca se almacena. */
  token: string
  /** SHA-256 del valor; es lo único que se guarda en la base. */
  tokenHash: string
  expiraEn: Date
}

/**
 * Genera un refresh token opaco y de alta entropía.
 *
 * No es un JWT a propósito: así la revocación es una simple consulta por hash.
 */
export function createRefreshToken(): RefreshToken {
  const token = randomBytes(32).toString('base64url')

  return {
    token,
    tokenHash: hashToken(token),
    expiraEn: new Date(
      Date.now() + parseDurationToMs(loadConfig().REFRESH_EXPIRES_IN),
    ),
  }
}

/** Hash determinista de un token opaco (RN-CORE-013: nunca en claro). */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}
