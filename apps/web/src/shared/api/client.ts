import {
  apiErrorSchema,
  loginResponseSchema,
  type ErrorCode,
} from '@intranet/shared'
import type { ZodType } from 'zod'

/** Prefijo versionado de la API (`docs/architecture.md` §5). */
const API_BASE = '/api/v1'

/**
 * Token de acceso en memoria.
 *
 * No se persiste en `localStorage` ni en `sessionStorage`: al recargar, la
 * sesión se restaura con el refresh token de la cookie `HttpOnly`.
 */
let accessToken: string | null = null

/** Promesa compartida para que varias peticiones no renueven a la vez. */
let refrescoEnCurso: Promise<boolean> | null = null

/** Opciones admitidas por {@link apiRequest}. */
export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  headers?: Record<string, string>
  /**
   * Evita el intento de renovación ante un `401`. Se usa en `login` y
   * `logout`, donde un `401` es una respuesta de negocio y no una sesión
   * expirada.
   */
  sinRefresh?: boolean
}

/** Error normalizado de la API con el sobre estándar. */
export class ApiClientError extends Error {
  readonly code: ErrorCode
  readonly status: number
  readonly details: string[]

  constructor(
    code: ErrorCode,
    message: string,
    status: number,
    details: string[] = [],
  ) {
    super(message)
    this.name = 'ApiClientError'
    this.code = code
    this.status = status
    this.details = details
  }
}

/** Devuelve el token de acceso actual, si existe. */
export function getAccessToken(): string | null {
  return accessToken
}

/** Reemplaza o limpia el token de acceso en memoria. */
export function setAccessToken(token: string | null): void {
  accessToken = token
}

/**
 * Renueva el access token usando la cookie de refresh.
 *
 * Las llamadas concurrentes comparten la misma petición: el refresh es de un
 * solo uso y dos renovaciones simultáneas invalidarían la sesión.
 *
 * @returns `true` si se obtuvo un token nuevo; `false` si no hay sesión.
 */
export function refreshAccessToken(): Promise<boolean> {
  if (!refrescoEnCurso) {
    refrescoEnCurso = ejecutarRefresh().finally(() => {
      refrescoEnCurso = null
    })
  }

  return refrescoEnCurso
}

async function ejecutarRefresh(): Promise<boolean> {
  try {
    const respuesta = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    })

    if (!respuesta.ok) {
      setAccessToken(null)
      return false
    }

    const cuerpo: unknown = await respuesta.json()
    const sesion = loginResponseSchema.parse(cuerpo)

    setAccessToken(sesion.accessToken)

    return true
  } catch {
    setAccessToken(null)

    return false
  }
}

/**
 * Ejecuta una petición y valida la respuesta con el schema indicado.
 *
 * Ante un `401` renueva la sesión y reintenta una sola vez. El token nunca se
 * envía en la URL ni en el almacenamiento del navegador.
 *
 * @param ruta Ruta relativa a `/api/v1`, por ejemplo `/me`.
 * @param schema Schema Zod que valida y tipa el cuerpo de la respuesta.
 * @param opciones Método, cuerpo y cabeceras adicionales.
 * @throws {ApiClientError} Si la API responde con un error del sobre estándar.
 */
export async function apiRequest<T>(
  ruta: string,
  schema: ZodType<T>,
  opciones: RequestOptions = {},
): Promise<T> {
  const cuerpo = await ejecutarConRefresh(ruta, opciones, async (respuesta) => {
    const datos: unknown = await respuesta.json()

    return datos
  })

  return schema.parse(cuerpo)
}

/**
 * Ejecuta una petición cuya respuesta exitosa no tiene cuerpo (`204`).
 *
 * @param ruta Ruta relativa a `/api/v1`.
 * @param opciones Método, cuerpo y cabeceras adicionales.
 * @throws {ApiClientError} Si la API responde con un error del sobre estándar.
 */
export async function apiRequestSinContenido(
  ruta: string,
  opciones: RequestOptions = {},
): Promise<void> {
  await ejecutarConRefresh(ruta, opciones, async () => undefined)
}

async function ejecutarConRefresh(
  ruta: string,
  opciones: RequestOptions,
  leer: (respuesta: Response) => Promise<unknown>,
): Promise<unknown> {
  let respuesta = await enviar(ruta, opciones)

  if (respuesta.status === 401 && !opciones.sinRefresh) {
    const renovado = await refreshAccessToken()

    if (renovado) {
      respuesta = await enviar(ruta, opciones)
    } else {
      setAccessToken(null)
    }
  }

  if (!respuesta.ok) {
    throw await parsearError(respuesta)
  }

  return leer(respuesta)
}

function enviar(
  ruta: string,
  opciones: RequestOptions,
): Promise<Response> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...opciones.headers,
  }

  let body: string | undefined

  if (opciones.body !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(opciones.body)
  }

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`
  }

  return fetch(`${API_BASE}${ruta}`, {
    method: opciones.method ?? 'GET',
    headers,
    credentials: 'include',
    ...(body !== undefined ? { body } : {}),
  })
}

async function parsearError(respuesta: Response): Promise<ApiClientError> {
  try {
    const cuerpo: unknown = await respuesta.json()
    const resultado = apiErrorSchema.safeParse(cuerpo)

    if (resultado.success) {
      return new ApiClientError(
        resultado.data.error.code,
        resultado.data.error.message,
        respuesta.status,
        resultado.data.error.details,
      )
    }
  } catch {
    // La respuesta de error no era JSON; se usa el mensaje genérico.
  }

  return new ApiClientError(
    'INTERNAL_ERROR',
    'No se pudo completar la solicitud.',
    respuesta.status,
  )
}
