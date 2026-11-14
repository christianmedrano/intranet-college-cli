import type { MeResponse } from '@intranet/shared'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthContext, type AuthContextValue } from '../../features/auth/auth-context'
import { AppLayout } from './AppLayout'

const PERFIL: MeResponse = {
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

afterEach(() => {
  cleanup()
})

function renderLayout(usuario: MeResponse | null, cerrarSesion = vi.fn(async () => {})) {
  const valor: AuthContextValue = {
    usuario,
    cargando: false,
    iniciarSesion: vi.fn(),
    cambiarPassword: vi.fn(),
    cerrarSesion,
  }

  const router = createMemoryRouter(
    [
      {
        element: (
          <AuthContext.Provider value={valor}>
            <AppLayout />
          </AuthContext.Provider>
        ),
        children: [{ path: '/', element: <p>Contenido</p> }],
      },
      { path: '/login', element: <p>Iniciar sesión</p> },
    ],
    { initialEntries: ['/'] },
  )

  render(<RouterProvider router={router} />)

  return { router, cerrarSesion }
}

describe('AppLayout', () => {
  it('muestra el nombre del usuario autenticado sin exponer el documento', () => {
    renderLayout(PERFIL)

    expect(screen.getByText('Ana Quispe')).toBeInTheDocument()
    expect(screen.queryByText(/12345678/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument()
  })

  it('cierra la sesión y navega al login', async () => {
    const { router, cerrarSesion } = renderLayout(PERFIL)

    await userEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }))

    expect(cerrarSesion).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
  })

  it('ofrece iniciar sesión cuando no hay usuario', () => {
    renderLayout(null)

    expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cerrar sesión' })).not.toBeInTheDocument()
  })
})
