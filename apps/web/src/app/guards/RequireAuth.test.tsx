import type { MeResponse, RoleCode } from '@intranet/shared'
import { cleanup, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RequireAuth } from './RequireAuth'

interface EstadoMock {
  usuario: MeResponse | null
  cargando: boolean
}

const { estado } = vi.hoisted(() => {
  const inicial: EstadoMock = { usuario: null, cargando: false }

  return { estado: inicial }
})

vi.mock('../../features/auth/useAuth', () => ({
  useAuth: () => estado,
}))

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

function montar(ruta: string, roles?: readonly RoleCode[]) {
  const router = createMemoryRouter(
    [
      {
        element: <RequireAuth />,
        children: [{ path: '/', element: <h1>Panel</h1> }],
      },
      {
        element: <RequireAuth roles={roles} />,
        children: [{ path: '/admin', element: <h1>Administración</h1> }],
      },
      { path: '/login', element: <h1>Iniciar sesión</h1> },
    ],
    { initialEntries: [ruta] },
  )

  render(<RouterProvider router={router} />)

  return router
}

beforeEach(() => {
  estado.usuario = null
  estado.cargando = false
})

afterEach(() => {
  cleanup()
})

describe('RequireAuth', () => {
  it('muestra el estado de carga mientras restaura la sesión', () => {
    estado.cargando = true

    montar('/')

    expect(screen.getByRole('status')).toHaveTextContent('Cargando sesión…')
  })

  it('redirige a /login cuando no hay sesión', async () => {
    const router = montar('/')

    expect(
      await screen.findByRole('heading', { name: 'Iniciar sesión' }),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
  })

  it('deja pasar al usuario autenticado', async () => {
    estado.usuario = PERFIL

    montar('/')

    expect(
      await screen.findByRole('heading', { name: 'Panel' }),
    ).toBeInTheDocument()
  })

  it('redirige al panel si el rol no está admitido', async () => {
    estado.usuario = PERFIL

    montar('/admin', ['SUPER_ADMIN'])

    expect(
      await screen.findByRole('heading', { name: 'Panel' }),
    ).toBeInTheDocument()
  })

  it('permite el acceso cuando el rol está admitido', async () => {
    estado.usuario = PERFIL

    montar('/admin', ['DIRECTOR'])

    expect(
      await screen.findByRole('heading', { name: 'Administración' }),
    ).toBeInTheDocument()
  })
})
