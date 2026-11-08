import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getAccessToken, setAccessToken } from '../../shared/api/client'
import { AuthProvider } from './AuthProvider'
import { useAuth } from './useAuth'

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

const SESION = {
  accessToken: 'token-1',
  tokenType: 'Bearer',
  expiresIn: 900,
}

function Consumidor() {
  const { usuario, cargando, iniciarSesion, cerrarSesion } = useAuth()

  return (
    <div>
      <p>
        {cargando
          ? 'Cargando'
          : usuario
            ? `Hola ${usuario.persona.nombres}`
            : 'Sin sesión'}
      </p>
      <button
        onClick={() =>
          void iniciarSesion({ identifier: 'ana', password: 'secreto123' })
        }
      >
        Entrar
      </button>
      <button onClick={() => void cerrarSesion()}>Salir</button>
    </div>
  )
}

function montar() {
  return render(
    <AuthProvider>
      <Consumidor />
    </AuthProvider>,
  )
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  setAccessToken(null)
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  setAccessToken(null)
})

describe('AuthProvider', () => {
  it('restaura la sesión al recargar', async () => {
    fetchMock
      .mockResolvedValueOnce(respuestaJson(SESION))
      .mockResolvedValueOnce(respuestaJson(PERFIL))

    montar()

    expect(await screen.findByText('Hola Ana')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[1]![0]).toBe('/api/v1/me')
    expect(getAccessToken()).toBe('token-1')
  })

  it('queda como anónimo si no hay cookie de refresh', async () => {
    fetchMock.mockResolvedValueOnce(respuestaJson(ERROR_401, 401))

    montar()

    expect(await screen.findByText('Sin sesión')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(getAccessToken()).toBeNull()
  })

  it('inicia sesión y carga el perfil', async () => {
    fetchMock
      .mockResolvedValueOnce(respuestaJson(ERROR_401, 401))
      .mockResolvedValueOnce(respuestaJson(SESION))
      .mockResolvedValueOnce(respuestaJson(PERFIL))

    const usuario = userEvent.setup()
    montar()

    await screen.findByText('Sin sesión')
    await usuario.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByText('Hola Ana')).toBeInTheDocument()
    expect(fetchMock.mock.calls[1]![0]).toBe('/api/v1/auth/login')
    expect(getAccessToken()).toBe('token-1')
  })

  it('cierra la sesión y limpia el token', async () => {
    fetchMock
      .mockResolvedValueOnce(respuestaJson(SESION))
      .mockResolvedValueOnce(respuestaJson(PERFIL))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))

    const usuario = userEvent.setup()
    montar()

    await screen.findByText('Hola Ana')
    await usuario.click(screen.getByRole('button', { name: 'Salir' }))

    expect(await screen.findByText('Sin sesión')).toBeInTheDocument()
    expect(fetchMock.mock.calls[2]![0]).toBe('/api/v1/auth/logout')
    expect(getAccessToken()).toBeNull()
  })
})
