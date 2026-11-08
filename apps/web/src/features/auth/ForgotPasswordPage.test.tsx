import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ForgotPasswordPage } from './ForgotPasswordPage'

const MENSAJE_NEUTRO =
  'Si el correo está registrado, la administración podrá entregarte el enlace de recuperación.'

function respuestaJson(cuerpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function montar() {
  const router = createMemoryRouter(
    [
      { path: '/recuperar-password', element: <ForgotPasswordPage /> },
      { path: '/login', element: <h1>Iniciar sesión</h1> },
    ],
    { initialEntries: ['/recuperar-password'] },
  )

  render(<RouterProvider router={router} />)
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('ForgotPasswordPage', () => {
  it('muestra un mensaje neutro tras enviar un correo válido', async () => {
    fetchMock.mockResolvedValueOnce(
      respuestaJson(
        { message: 'Solicitud registrada.' },
        202,
      ),
    )
    const usuario = userEvent.setup()
    montar()

    await usuario.type(
      screen.getByLabelText('Correo electrónico'),
      'ana@ejemplo.edu.pe',
    )
    await usuario.click(screen.getByRole('button', { name: 'Enviar solicitud' }))

    expect(await screen.findByRole('status')).toHaveTextContent(
      MENSAJE_NEUTRO,
    )
    expect(fetchMock.mock.calls[0]![0]).toBe('/api/v1/auth/forgot-password')

    const init = fetchMock.mock.calls[0]![1]
    expect(JSON.parse(String(init?.body))).toEqual({
      email: 'ana@ejemplo.edu.pe',
    })
  })

  it('valida el formato del correo sin llamar a la API', async () => {
    const usuario = userEvent.setup()
    montar()

    await usuario.type(
      screen.getByLabelText('Correo electrónico'),
      'no-es-correo',
    )
    await usuario.click(screen.getByRole('button', { name: 'Enviar solicitud' }))

    expect(screen.getByText('El correo no es válido')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('muestra el error de la API sin revelar información de la cuenta', async () => {
    fetchMock.mockResolvedValueOnce(
      respuestaJson(
        {
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Ocurrió un error inesperado.',
            details: [],
          },
        },
        500,
      ),
    )
    const usuario = userEvent.setup()
    montar()

    await usuario.type(
      screen.getByLabelText('Correo electrónico'),
      'ana@ejemplo.edu.pe',
    )
    await usuario.click(screen.getByRole('button', { name: 'Enviar solicitud' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Ocurrió un error inesperado.',
    )
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
