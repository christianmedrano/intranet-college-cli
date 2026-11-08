import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppProviders } from '../../app/providers'
import { routes } from '../../app/routes'

const SESION = {
  accessToken: 'token-1',
  tokenType: 'Bearer',
  expiresIn: 900,
}

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

const ERROR_CREDENCIALES = {
  error: {
    code: 'UNAUTHORIZED',
    message: 'Credenciales inválidas.',
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
  // Sin cookie de refresh el `AuthProvider` arranca como anónimo.
  fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 401 }))
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function renderEn(ruta: string) {
  const router = createMemoryRouter(routes, { initialEntries: [ruta] })

  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  )

  return router
}

async function completarCredenciales(usuario: ReturnType<typeof userEvent.setup>) {
  await usuario.type(screen.getByLabelText('Identificador'), 'ana')
  await usuario.type(screen.getByLabelText('Contraseña'), 'secreto123')
}

describe('flujo de autenticación', () => {
  it('navega del login a la recuperación de contraseña', async () => {
    const usuario = userEvent.setup()
    renderEn('/login')

    await screen.findByRole('heading', { name: /iniciar sesión/i })
    await usuario.click(
      screen.getByRole('link', { name: /olvidaste tu contraseña/i }),
    )

    expect(
      await screen.findByRole('heading', { name: /recuperar contraseña/i }),
    ).toBeInTheDocument()
  })

  it('vuelve de la recuperación al inicio de sesión', async () => {
    const usuario = userEvent.setup()
    renderEn('/recuperar-password')

    await usuario.click(
      screen.getByRole('link', { name: /volver al inicio de sesión/i }),
    )

    expect(
      await screen.findByRole('heading', { name: /iniciar sesión/i }),
    ).toBeInTheDocument()
  })

  it('inicia sesión y muestra el panel', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(respuestaJson(SESION))
      .mockResolvedValueOnce(respuestaJson(PERFIL))
    const usuario = userEvent.setup()
    renderEn('/login')

    await screen.findByRole('heading', { name: /iniciar sesión/i })
    await completarCredenciales(usuario)
    await usuario.click(screen.getByRole('button', { name: 'Ingresar' }))

    expect(
      await screen.findByRole('heading', { name: /^panel$/i }),
    ).toBeInTheDocument()
    expect(fetchMock.mock.calls[1]![0]).toBe('/api/v1/auth/login')
    expect(fetchMock.mock.calls[2]![0]).toBe('/api/v1/me')
  })

  it('muestra el error cuando las credenciales son inválidas', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(respuestaJson(ERROR_CREDENCIALES, 401))
    const usuario = userEvent.setup()
    renderEn('/login')

    await screen.findByRole('heading', { name: /iniciar sesión/i })
    await completarCredenciales(usuario)
    await usuario.click(screen.getByRole('button', { name: 'Ingresar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Credenciales inválidas.',
    )
    expect(
      screen.queryByRole('heading', { name: /^panel$/i }),
    ).not.toBeInTheDocument()
  })

  it('el guard redirige al login y conserva la ruta de origen', async () => {
    const router = renderEn('/')

    expect(
      await screen.findByRole('heading', { name: /iniciar sesión/i }),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
    expect(router.state.location.state).toEqual({ desde: '/' })
  })
})
