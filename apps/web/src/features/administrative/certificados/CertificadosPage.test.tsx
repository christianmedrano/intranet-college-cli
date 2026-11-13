import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CertificadosPage } from './CertificadosPage'

const api = vi.hoisted(() => ({
  listarCertificados: vi.fn(),
  aprobarCertificado: vi.fn(),
  rechazarCertificado: vi.fn(),
  descargarCertificado: vi.fn(),
  listarPlantillas: vi.fn(),
}))

vi.mock('./api', () => api)

const catalogos = vi.hoisted(() => ({
  listarAlumnosCatalogo: vi.fn(),
  listarAniosCatalogo: vi.fn(),
}))

vi.mock('../matriculas/catalogos', () => catalogos)

const auth = vi.hoisted(() => ({
  useAuth: vi.fn(),
}))

vi.mock('../../auth/useAuth', () => auth)

const ALUMNO_ID = '11111111-1111-4111-8111-111111111111'
const ANIO_ID = '22222222-2222-4222-8222-222222222222'

const CERTIFICADO_SOLICITADO = {
  id: '44444444-4444-4444-8444-444444444444',
  tipo: 'ESTUDIOS',
  numero: 'CERT-ESTUDIOS-2026-0001',
  alumnoId: ALUMNO_ID,
  anioId: ANIO_ID,
  plantillaId: null,
  variables: null,
  estado: 'SOLICITADO',
  solicitadoPorId: ALUMNO_ID,
  solicitadoAt: '2026-03-01T10:00:00.000Z',
  aprobadoPorId: null,
  aprobadoAt: null,
  rechazadoMotivo: null,
  pdfRuta: null,
  createdAt: '2026-03-01T10:00:00.000Z',
  updatedAt: '2026-03-01T10:00:00.000Z',
}

const CERTIFICADO_EMITIDO = {
  ...CERTIFICADO_SOLICITADO,
  id: '55555555-5555-4555-8555-555555555555',
  numero: 'CERT-MATRICULA-2026-0002',
  tipo: 'MATRICULA',
  estado: 'EMITIDO',
  aprobadoPorId: ALUMNO_ID,
  aprobadoAt: '2026-03-02T10:00:00.000Z',
  pdfRuta: '/certificados/2.pdf',
}

const PERMISOS_GESTION = [
  'administrative.certificados.emitir',
  'administrative.certificados.descargar',
]

function configurarPermisos(permissions: string[]) {
  auth.useAuth.mockReturnValue({ usuario: { permissions } })
}

function montar() {
  render(<CertificadosPage />)
}

beforeEach(() => {
  vi.resetAllMocks()

  configurarPermisos(PERMISOS_GESTION)

  api.listarCertificados.mockResolvedValue({
    data: [CERTIFICADO_SOLICITADO, CERTIFICADO_EMITIDO],
    meta: { page: 1, pageSize: 20, total: 2 },
  })
  api.aprobarCertificado.mockResolvedValue({ ...CERTIFICADO_SOLICITADO, estado: 'EMITIDO' })
  api.rechazarCertificado.mockResolvedValue({ ...CERTIFICADO_SOLICITADO, estado: 'RECHAZADO' })
  api.descargarCertificado.mockResolvedValue({
    message: 'PDF generado correctamente',
    certificado: CERTIFICADO_EMITIDO,
    downloadUrl: '/api/v1/certificados/2/download',
  })
  api.listarPlantillas.mockResolvedValue({
    data: [
      {
        id: '66666666-6666-4666-8666-666666666666',
        tipo: 'ESTUDIOS',
        nombre: 'Plantilla de estudios',
        contenido: '<p>{{alumno.nombres}}</p>',
        activa: true,
        version: 1,
        createdAt: '2026-03-01T10:00:00.000Z',
        updatedAt: '2026-03-01T10:00:00.000Z',
      },
    ],
    meta: { page: 1, pageSize: 100, total: 1 },
  })

  catalogos.listarAlumnosCatalogo.mockResolvedValue([
    { id: ALUMNO_ID, codigoAlumno: '2026-001', nombres: 'Ana', apellidos: 'Torres' },
  ])
  catalogos.listarAniosCatalogo.mockResolvedValue([{ id: ANIO_ID, nombre: '2026' }])
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('CertificadosPage', () => {
  it('carga y muestra la lista de certificados', async () => {
    montar()

    expect(await screen.findByText('Certificados y Constancias')).toBeInTheDocument()
    expect(await screen.findByText('CERT-ESTUDIOS-2026-0001')).toBeInTheDocument()
    expect(screen.getByText('CERT-MATRICULA-2026-0002')).toBeInTheDocument()
    expect(screen.getAllByText('Solicitado')[0]).toBeInTheDocument()
    expect(screen.getAllByText('Emitido')[0]).toBeInTheDocument()
  })

  it('muestra el estado vacío sin certificados', async () => {
    api.listarCertificados.mockResolvedValue({
      data: [],
      meta: { page: 1, pageSize: 20, total: 0 },
    })

    montar()

    expect(await screen.findByText('No se encontraron certificados')).toBeInTheDocument()
  })

  it('filtra por tipo de certificado', async () => {
    montar()
    const usuario = userEvent.setup()

    await usuario.selectOptions(await screen.findByLabelText(/^Tipo/), 'MATRICULA')

    await waitFor(() =>
      expect(api.listarCertificados).toHaveBeenCalledWith(
        expect.objectContaining({ tipo: 'MATRICULA', page: 1 }),
      ),
    )
  })

  it('aprueba un certificado solicitado', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    montar()
    const usuario = userEvent.setup()

    await usuario.click(await screen.findByRole('button', { name: 'Aprobar' }))

    await waitFor(() =>
      expect(api.aprobarCertificado).toHaveBeenCalledWith(CERTIFICADO_SOLICITADO.id),
    )
    expect(await screen.findByText('Certificado aprobado correctamente')).toBeInTheDocument()
  })

  it('rechaza un certificado con motivo', async () => {
    vi.spyOn(window, 'prompt').mockReturnValue('Datos incompletos')

    montar()
    const usuario = userEvent.setup()

    await usuario.click(await screen.findByRole('button', { name: 'Rechazar' }))

    await waitFor(() =>
      expect(api.rechazarCertificado).toHaveBeenCalledWith(CERTIFICADO_SOLICITADO.id, {
        motivo: 'Datos incompletos',
      }),
    )
  })

  it('descarga un certificado emitido', async () => {
    const abrir = vi.spyOn(window, 'open').mockReturnValue(null)

    montar()
    const usuario = userEvent.setup()

    await usuario.click(await screen.findByRole('button', { name: 'Descargar' }))

    await waitFor(() =>
      expect(api.descargarCertificado).toHaveBeenCalledWith(CERTIFICADO_EMITIDO.id),
    )
    expect(abrir).toHaveBeenCalledWith('/api/v1/certificados/2/download', '_blank', 'noopener')
  })

  it('informa cuando el usuario no puede consultar certificados', async () => {
    configurarPermisos([])

    montar()

    expect(
      await screen.findByText('No tiene permiso para consultar certificados.'),
    ).toBeInTheDocument()
    expect(api.listarCertificados).not.toHaveBeenCalled()
  })
})
