import { cleanup, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppProviders } from './app/providers'
import { routes } from './app/routes'

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(new Response(null, { status: 401 })),
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function renderEn(ruta: string) {
  const router = createMemoryRouter(routes, { initialEntries: [ruta] })

  return render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  )
}

describe('router', () => {
  it('monta la ruta /login', async () => {
    renderEn('/login')

    expect(
      await screen.findByRole('heading', { name: /iniciar sesión/i }),
    ).toBeInTheDocument()
  })

  it('monta la ruta /', async () => {
    renderEn('/')

    expect(
      await screen.findByRole('heading', { name: /^panel$/i }),
    ).toBeInTheDocument()
  })
})
