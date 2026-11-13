import type { CertificadoResponsePayload, PlantillaCertificadoResponsePayload } from '@intranet/shared'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CertificadoForm } from './CertificadoForm'

const api = vi.hoisted(() => ({
  crearCertificado: vi.fn(),
  solicitarCertificado: vi.fn(),
}))

vi.mock('./api', () => api)

const ALUMNO_ID = '11111111-1111-4111-8111-111111111111'
const ANIO_ID = '22222222-2222-4222-8222-222222222222'
const PLANTILLA_ID = '33333333-3333-4333-8333-333333333333'

const ALUMNOS = [
  { id: ALUMNO_ID, codigoAlumno: '2026-001', nombres: 'Ana', apellidos: 'Torres' },
]

const ANIOS = [{ id: ANIO_ID, nombre: '2026' }]

const PLANTILLAS: PlantillaCertificadoResponsePayload[] = [
  {
    id: PLANTILLA_ID,
    tipo: 'ESTUDIOS',
    nombre: 'Plantilla de estudios',
    contenido: '<p>{{alumno.nombres}} {{alumno.apellidos}}</p>',
    activa: true,
    version: 1,
    createdAt: '2026-03-01T10:00:00.000Z',
    updatedAt: '2026-03-01T10:00:00.000Z',
  },
]

const CERTIFICADO: CertificadoResponsePayload = {
  id: '44444444-4444-4444-8444-444444444444',
  tipo: 'ESTUDIOS',
  numero: 'CERT-ESTUDIOS-2026-0001',
  alumnoId: ALUMNO_ID,
  anioId: ANIO_ID,
  plantillaId: null,
  variables: null,
  estado: 'EMITIDO',
  solicitadoPorId: null,
  solicitadoAt: null,
  aprobadoPorId: null,
  aprobadoAt: null,
  rechazadoMotivo: null,
  pdfRuta: null,
  createdAt: '2026-03-01T10:00:00.000Z',
  updatedAt: '2026-03-01T10:00:00.000Z',
}

function montar(modo: 'emitir' | 'solicitar' = 'emitir') {
  const onGuardado = vi.fn()
  const onCancelar = vi.fn()

  render(
    <CertificadoForm
      modo={modo}
      alumnos={ALUMNOS}
      anios={ANIOS}
      plantillas={PLANTILLAS}
      onGuardado={onGuardado}
      onCancelar={onCancelar}
    />,
  )

  return { onGuardado, onCancelar }
}

beforeEach(() => {
  vi.resetAllMocks()
  api.crearCertificado.mockResolvedValue(CERTIFICADO)
  api.solicitarCertificado.mockResolvedValue({ ...CERTIFICADO, estado: 'SOLICITADO' })
})

afterEach(() => {
  cleanup()
})

describe('CertificadoForm', () => {
  it('muestra error al enviar sin alumno', async () => {
    const usuario = userEvent.setup()

    montar()

    await usuario.click(screen.getByRole('button', { name: 'Emitir certificado' }))

    expect(await screen.findByText('Debe seleccionar un alumno')).toBeInTheDocument()
    expect(api.crearCertificado).not.toHaveBeenCalled()
  })

  it('emite un certificado con alumno y año', async () => {
    const { onGuardado } = montar()
    const usuario = userEvent.setup()

    await usuario.selectOptions(screen.getByLabelText(/^Alumno/), ALUMNO_ID)
    await usuario.selectOptions(screen.getByLabelText(/Año académico/), ANIO_ID)
    await usuario.click(screen.getByRole('button', { name: 'Emitir certificado' }))

    await waitFor(() =>
      expect(api.crearCertificado).toHaveBeenCalledWith({
        tipo: 'ESTUDIOS',
        alumnoId: ALUMNO_ID,
        anioId: ANIO_ID,
      }),
    )
    expect(onGuardado).toHaveBeenCalledWith('Certificado emitido correctamente')
  })

  it('solicita un certificado en modo solicitud', async () => {
    const { onGuardado } = montar('solicitar')
    const usuario = userEvent.setup()

    await usuario.selectOptions(screen.getByLabelText(/^Alumno/), ALUMNO_ID)
    await usuario.selectOptions(screen.getByLabelText(/Año académico/), ANIO_ID)
    await usuario.click(screen.getByRole('button', { name: 'Solicitar certificado' }))

    await waitFor(() =>
      expect(api.solicitarCertificado).toHaveBeenCalledWith({
        tipo: 'ESTUDIOS',
        alumnoId: ALUMNO_ID,
        anioId: ANIO_ID,
      }),
    )
    expect(onGuardado).toHaveBeenCalledWith('Certificado solicitado correctamente')
  })

  it('muestra variables de la plantilla y su vista previa', async () => {
    montar()
    const usuario = userEvent.setup()

    await usuario.selectOptions(screen.getByLabelText(/^Alumno/), ALUMNO_ID)
    await usuario.selectOptions(screen.getByLabelText(/Plantilla/), PLANTILLA_ID)

    expect(await screen.findByLabelText('Valor de alumno.nombres')).toBeInTheDocument()
    expect(screen.getByLabelText('Valor de alumno.apellidos')).toBeInTheDocument()

    await usuario.type(screen.getByLabelText('Valor de alumno.nombres'), 'Ana')
    await usuario.type(screen.getByLabelText('Valor de alumno.apellidos'), 'Torres')
    await usuario.click(screen.getByRole('button', { name: 'Ver vista previa' }))

    expect(screen.getByTestId('certificado-preview')).toHaveTextContent('Ana Torres')
  })

  it('muestra el error de la API al emitir', async () => {
    api.crearCertificado.mockRejectedValueOnce(new Error('La plantilla no está activa'))
    montar()
    const usuario = userEvent.setup()

    await usuario.selectOptions(screen.getByLabelText(/^Alumno/), ALUMNO_ID)
    await usuario.selectOptions(screen.getByLabelText(/Año académico/), ANIO_ID)
    await usuario.click(screen.getByRole('button', { name: 'Emitir certificado' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('La plantilla no está activa')
  })
})
