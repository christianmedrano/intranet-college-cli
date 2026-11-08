import type { MeResponse } from '@intranet/shared'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiClientError } from '../../shared/api/client'
import { ChangePasswordPage } from './ChangePasswordPage'

const { cambiarPassword, usuario } = vi.hoisted(() => ({
  cambiarPassword: vi.fn(),
  usuario: {
    debeCambiarPassword: true,
  } as Pick<MeResponse, 'debeCambiarPassword'>,
}))

vi.mock('./useAuth', () => ({
  useAuth: () => ({
    usuario,
    cargando: false,
    iniciarSesion: vi.fn(),
    cambiarPassword,
    cerrarSesion: vi.fn(),
  }),
}))

function montar() {
  const router = createMemoryRouter(
    [
      { path: '/cambiar-password', element: <ChangePasswordPage /> },
      { path: '/login', element: <h1>Iniciar sesión</h1> },
    ],
    { initialEntries: ['/cambiar-password'] },
  )

  render(<RouterProvider router={router} />)

  return router
}

beforeEach(() => {
  usuario.debeCambiarPassword = true
  cambiarPassword.mockReset()
})

afterEach(() => {
  cleanup()
})

describe('ChangePasswordPage', () => {
  it('avisa del PIN temporal y enfoca la contraseña actual', () => {
    montar()

    expect(
      screen.getByText(/estás usando una contraseña temporal/i),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Contraseña actual')).toHaveFocus()
  })

  it('valida los campos antes de llamar a la API', async () => {
    const usuarioEvento = userEvent.setup()
    montar()

    await usuarioEvento.click(
      screen.getByRole('button', { name: 'Cambiar contraseña' }),
    )

    expect(
      screen.getByText('La contraseña actual es obligatoria'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('La contraseña debe tener al menos 10 caracteres'),
    ).toBeInTheDocument()
    expect(cambiarPassword).not.toHaveBeenCalled()
  })

  it('cambia la contraseña y vuelve al inicio de sesión', async () => {
    cambiarPassword.mockResolvedValueOnce(undefined)
    const usuarioEvento = userEvent.setup()
    montar()

    await usuarioEvento.type(
      screen.getByLabelText('Contraseña actual'),
      '48291375',
    )
    await usuarioEvento.type(
      screen.getByLabelText('Nueva contraseña'),
      'ClaveDefinitiva456',
    )
    await usuarioEvento.click(
      screen.getByRole('button', { name: 'Cambiar contraseña' }),
    )

    expect(
      await screen.findByRole('heading', { name: 'Iniciar sesión' }),
    ).toBeInTheDocument()
    expect(cambiarPassword).toHaveBeenCalledWith({
      currentPassword: '48291375',
      newPassword: 'ClaveDefinitiva456',
    })
  })

  it('muestra el error cuando la contraseña actual no es correcta', async () => {
    cambiarPassword.mockRejectedValueOnce(
      new ApiClientError(
        'UNAUTHORIZED',
        'La contraseña actual no es correcta.',
        401,
      ),
    )
    const usuarioEvento = userEvent.setup()
    montar()

    await usuarioEvento.type(
      screen.getByLabelText('Contraseña actual'),
      'PinEquivocado000',
    )
    await usuarioEvento.type(
      screen.getByLabelText('Nueva contraseña'),
      'ClaveDefinitiva456',
    )
    await usuarioEvento.click(
      screen.getByRole('button', { name: 'Cambiar contraseña' }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'La contraseña actual no es correcta.',
    )
    expect(
      screen.queryByRole('heading', { name: 'Iniciar sesión' }),
    ).not.toBeInTheDocument()
  })

  it('muestra los detalles de la política de contraseña', async () => {
    cambiarPassword.mockRejectedValueOnce(
      new ApiClientError('VALIDATION_ERROR', 'Los datos enviados no son válidos.', 400, [
        'La contraseña no puede ser igual a tu usuario, correo o documento.',
      ]),
    )
    const usuarioEvento = userEvent.setup()
    montar()

    await usuarioEvento.type(
      screen.getByLabelText('Contraseña actual'),
      '48291375',
    )
    await usuarioEvento.type(
      screen.getByLabelText('Nueva contraseña'),
      'ana.perez.123',
    )
    await usuarioEvento.click(
      screen.getByRole('button', { name: 'Cambiar contraseña' }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'La contraseña no puede ser igual a tu usuario, correo o documento.',
    )
  })
})
