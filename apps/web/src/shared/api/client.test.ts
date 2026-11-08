import { meResponseSchema } from '@intranet/shared'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ApiClientError,
  apiRequest,
  apiRequestSinContenido,
  getAccessToken,
  refreshAccessToken,
  setAccessToken,
} from './client'

const PERFIL = {
  id: '00000000-0000-4000-8000-000000000001',
  username: 'ana',
  email: 'ana@ejemplo.edu.pe',
  debeCambiarPassword: false,
  persona: {
    nombres: 'Ana',
    apellidos: 'Quispe',
    tipoDocumento: 'DNI',
    numeroDocumento: '12345678',
  },
  roles: ['DIRECTOR'],
  permissions: ['core.perfil.leer'],
}

const ERROR_401 = {
  error: {
    code: 'UNAUTHORIZED',
    message: 'Debes iniciar sesión para continuar.',
    details: [],
  },
}

function respuestaJson(cuerpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  setAccessToken(null)
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  setAccessToken(null)
})

describe('apiRequest', () => {
  it('envía el token en memoria y las cookies', async () => {
    setAccessToken('token-1')
    fetchMock.mockResolvedValueOnce(respuestaJson(PERFIL))

    const resultado = await apiRequest('/me', meResponseSchema)

    expect(resultado.persona.nombres).toBe('Ana')
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('/api/v1/me')
    expect(new Headers(init?.headers).get('Authorization')).toBe(
      'Bearer token-1',
    )
    expect(init?.credentials).toBe('include')
  })

  it('renueva la sesión ante un 401 y reintenta una sola vez', async () => {
    setAccessToken('viejo')
    fetchMock
      .mockResolvedValueOnce(respuestaJson(ERROR_401, 401))
      .mockResolvedValueOnce(
        respuestaJson({
          accessToken: 'nuevo',
          tokenType: 'Bearer',
          expiresIn: 900,
        }),
      )
      .mockResolvedValueOnce(respuestaJson(PERFIL))

    const resultado = await apiRequest('/me', meResponseSchema)

    expect(resultado.id).toBe(PERFIL.id)
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock.mock.calls[1]![0]).toBe('/api/v1/auth/refresh')
    expect(
      new Headers(fetchMock.mock.calls[2]![1]?.headers).get('Authorization'),
    ).toBe('Bearer nuevo')
  })

  it('propaga el 401 y limpia el token cuando no hay sesión que renovar', async () => {
    setAccessToken('vencido')
    fetchMock
      .mockResolvedValueOnce(respuestaJson(ERROR_401, 401))
      .mockResolvedValueOnce(respuestaJson(ERROR_401, 401))

    await expect(apiRequest('/me', meResponseSchema)).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      status: 401,
    })

    expect(getAccessToken()).toBeNull()
  })

  it('traduce el sobre de error a ApiClientError', async () => {
    fetchMock.mockResolvedValueOnce(
      respuestaJson(
        {
          error: {
            code: 'FORBIDDEN',
            message: 'No tienes permiso para realizar esta acción.',
            details: ['detalle'],
          },
        },
        403,
      ),
    )

    const peticion = apiRequest('/auditoria', meResponseSchema)

    await expect(peticion).rejects.toBeInstanceOf(ApiClientError)
    await expect(peticion).rejects.toMatchObject({
      code: 'FORBIDDEN',
      status: 403,
      details: ['detalle'],
    })
  })

  it('no lanza dos renovaciones simultáneas', async () => {
    fetchMock.mockResolvedValueOnce(
      respuestaJson({
        accessToken: 'nuevo',
        tokenType: 'Bearer',
        expiresIn: 900,
      }),
    )

    const [primera, segunda] = await Promise.all([
      refreshAccessToken(),
      refreshAccessToken(),
    ])

    expect(primera).toBe(true)
    expect(segunda).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(getAccessToken()).toBe('nuevo')
  })

  it('acepta respuestas 204 sin cuerpo', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))

    await expect(
      apiRequestSinContenido('/auth/logout', {
        method: 'POST',
        sinRefresh: true,
      }),
    ).resolves.toBeUndefined()
  })
})
