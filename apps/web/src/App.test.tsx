import { cleanup, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppProviders } from './app/providers'
import { routes } from './app/routes'

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

function respuestaJson(cuerpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
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

describe('router', () => {
  it('monta la ruta /login', async () => {
    renderEn('/login')

    expect(
      await screen.findByRole('heading', { name: /iniciar sesión/i }),
    ).toBeInTheDocument()
  })

  it('redirige a /login cuando no hay sesión', async () => {
    const router = renderEn('/')

    expect(
      await screen.findByRole('heading', { name: /iniciar sesión/i }),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
  })

  it('muestra el panel con sesión activa', async () => {
    fetchMock
      .mockResolvedValueOnce(respuestaJson(SESION))
      .mockResolvedValueOnce(respuestaJson(PERFIL))

    renderEn('/')

    expect(
      await screen.findByRole('heading', { name: /^panel$/i }),
    ).toBeInTheDocument()
  })
})
