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
    cerrarSesion: vi.fn(),
  }),
}))

function montar() {
  const router = createMemoryRouter(
    [
      { path: '/login', element: <LoginPage /> },
      { path: '/', element: <h1>Panel</h1> },
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
    iniciarSesion.mockResolvedValueOnce(undefined)
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
})
