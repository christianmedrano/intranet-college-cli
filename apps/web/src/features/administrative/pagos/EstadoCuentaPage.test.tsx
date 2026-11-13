import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EstadoCuentaPage } from './EstadoCuentaPage'

const api = vi.hoisted(() => ({
  obtenerEstadoCuenta: vi.fn(),
}))

vi.mock('./api', () => api)

// Mock react-router at top level
const mockNavigate = vi.fn()
const mockUseParams = vi.fn()

vi.mock('react-router', () => ({
  useParams: () => mockUseParams(),
  useNavigate: () => mockNavigate,
}))

const ALUMNO_ID = '11111111-1111-4111-8111-111111111111'

function montar(props: { isOpen?: boolean; onClose?: () => void } = {}) {
  mockUseParams.mockReturnValue({ alumnoId: ALUMNO_ID })
  mockNavigate.mockClear()

  const onClose = props.onClose ?? vi.fn()

  render(
    <EstadoCuentaPage
      isOpen={props.isOpen}
      onClose={props.onClose}
    />,
  )

  return { onClose: onClose as ReturnType<typeof vi.fn>, navigate: mockNavigate }
}

beforeEach(() => {
  vi.resetAllMocks()
  api.obtenerEstadoCuenta.mockResolvedValue({
    alumnoId: ALUMNO_ID,
    totalesPorConcepto: [
      { concepto: 'CUOTA_MENSUAL', totalPagado: 150.00, totalPendiente: 0, cantidad: 1 },
      { concepto: 'MATRICULA', totalPagado: 500.00, totalPendiente: 0, cantidad: 1 },
      { concepto: 'CERTIFICADO', totalPagado: 100.00, totalPendiente: 50.00, cantidad: 2 },
    ],
    totalGeneralPagado: 750.00,
    totalGeneralPendiente: 50.00,
  })
})

afterEach(() => {
  cleanup()
})

describe('EstadoCuentaPage', () => {
  it('carga y muestra el estado de cuenta', async () => {
    montar({})

    await waitFor(() => expect(screen.getByText('Estado de Cuenta')).toBeInTheDocument())
    await waitFor(() => expect(screen.getByText('S/ 750.00')).toBeInTheDocument()) // Total pagado
    
    // Total pendiente appears in summary card - use more specific selector
    const totalPendienteCards = screen.getAllByText('S/ 50.00')
    expect(totalPendienteCards.length).toBeGreaterThanOrEqual(1)

    expect(screen.getByText('Cuota Mensual')).toBeInTheDocument()
    expect(screen.getByText('Matrícula')).toBeInTheDocument()
    expect(screen.getByText('Certificado')).toBeInTheDocument()
    expect(screen.getByText('S/ 150.00')).toBeInTheDocument() // Cuota mensual pagado
    expect(screen.getByText('S/ 500.00')).toBeInTheDocument() // Matrícula pagado
    expect(screen.getByText('S/ 100.00')).toBeInTheDocument() // Certificado pagado
  })

  it('muestra estado de carga mientras carga', async () => {
    api.obtenerEstadoCuenta.mockImplementationOnce(() => new Promise(() => {}))

    montar({})

    expect(screen.getByText('Cargando estado de cuenta...')).toBeInTheDocument()
  })

  it('muestra error si falla la carga', async () => {
    api.obtenerEstadoCuenta.mockRejectedValueOnce(new Error('Error de servidor'))

    montar({})

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Error de servidor'),
    )
  })

  it('cierra el modal al hacer clic en cerrar', async () => {
    const onClose = vi.fn()
    montar({ isOpen: true, onClose })

    await waitFor(() => {
      // In modal mode, there's a close button with × (aria-label="Cerrar")
      const closeButtons = screen.getAllByRole('button', { name: /Cerrar/ })
      expect(closeButtons.length).toBeGreaterThan(0)
    })

    const usuario = userEvent.setup()
    // Click the first close button (the × button in modal header)
    const closeButtons = screen.getAllByRole('button', { name: /Cerrar/ })
    expect(closeButtons.length).toBeGreaterThan(0)
    await usuario.click(closeButtons[0]!)

    expect(onClose).toHaveBeenCalled()
  })

  it('navega a /pagos al hacer clic en Volver a Pagos en modo página', async () => {
    montar({ isOpen: false })

    await waitFor(() => expect(screen.getByText('Estado de Cuenta')).toBeInTheDocument())

    const usuario = userEvent.setup()
    await usuario.click(screen.getByRole('button', { name: /Volver a Pagos/ }))

    expect(mockNavigate).toHaveBeenCalledWith('/pagos')
  })
})