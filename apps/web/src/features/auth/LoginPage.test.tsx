import type { MeResponse } from '@intranet/shared'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiClientError } from '../../shared/api/client'
import { LoginPage } from './LoginPage'

const { iniciarSesion } = vi.hoisted(() => ({ iniciarSesion: vi.fn() }))

vi.mock('./useAuth', () => ({
  useAuth: () => ({
    usuario: null,
    cargando: false,
    iniciarSesion,
    cambiarPassword: vi.fn(),
    cerrarSesion: vi.fn(),
  }),
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

function montar() {
  const router = createMemoryRouter(
    [
      { path: '/login', element: <LoginPage /> },
      { path: '/', element: <h1>Panel</h1> },
      { path: '/cambiar-password', element: <h1>Cambiar contraseña</h1> },
    ],
    { initialEntries: ['/login'] },
  )

  render(<RouterProvider router={router} />)
}

beforeEach(() => {
  iniciarSesion.mockReset()
})

afterEach(() => {
  cleanup()
})

describe('LoginPage', () => {
  it('enfoca el identificador y muestra errores accesibles si está vacío', async () => {
    const usuario = userEvent.setup()
    montar()

    expect(screen.getByLabelText('Identificador')).toHaveFocus()

    await usuario.click(screen.getByRole('button', { name: 'Ingresar' }))

    expect(
      screen.getByText('El identificador es obligatorio'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('La contraseña es obligatoria'),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Identificador')).toHaveAttribute(
      'aria-invalid',
      'true',
    )
    expect(iniciarSesion).not.toHaveBeenCalled()
  })

  it('muestra el mensaje de credenciales inválidas', async () => {
    iniciarSesion.mockRejectedValueOnce(
      new ApiClientError('UNAUTHORIZED', 'Credenciales inválidas.', 401),
    )
    const usuario = userEvent.setup()
    montar()

    await usuario.type(screen.getByLabelText('Identificador'), 'ana')
    await usuario.type(screen.getByLabelText('Contraseña'), 'secreto123')
    await usuario.click(screen.getByRole('button', { name: 'Ingresar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Credenciales inválidas.',
    )
  })

  it('navega al panel tras iniciar sesión', async () => {
    iniciarSesion.mockResolvedValueOnce(PERFIL)
    const usuario = userEvent.setup()
    montar()

    await usuario.type(screen.getByLabelText('Identificador'), 'ana')
    await usuario.type(screen.getByLabelText('Contraseña'), 'secreto123')
    await usuario.click(screen.getByRole('button', { name: 'Ingresar' }))

    expect(
      await screen.findByRole('heading', { name: 'Panel' }),
    ).toBeInTheDocument()
    expect(iniciarSesion).toHaveBeenCalledWith({
      identifier: 'ana',
      password: 'secreto123',
    })
  })

  it('lleva al cambio obligatorio si el usuario aún tiene PIN temporal', async () => {
    iniciarSesion.mockResolvedValueOnce({
      ...PERFIL,
      debeCambiarPassword: true,
    })
    const usuario = userEvent.setup()
    montar()

    await usuario.type(screen.getByLabelText('Identificador'), 'ana')
    await usuario.type(screen.getByLabelText('Contraseña'), '48291375')
    await usuario.click(screen.getByRole('button', { name: 'Ingresar' }))

    expect(
      await screen.findByRole('heading', { name: 'Cambiar contraseña' }),
    ).toBeInTheDocument()
  })
})
