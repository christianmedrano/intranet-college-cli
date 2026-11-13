import type { MatriculaAdminResponsePayload } from '@intranet/shared'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MatriculasPage } from './MatriculasPage'

const api = vi.hoisted(() => ({
  listarMatriculas: vi.fn(),
  aprobarMatricula: vi.fn(),
  rechazarMatricula: vi.fn(),
  retirarMatricula: vi.fn(),
}))

vi.mock('./api', () => api)

const catalogos = vi.hoisted(() => ({
  listarAlumnosCatalogo: vi.fn(),
  listarAniosCatalogo: vi.fn(),
  listarNivelesCatalogo: vi.fn(),
  listarGradosCatalogo: vi.fn(),
  listarSeccionesCatalogo: vi.fn(),
}))

vi.mock('./catalogos', () => catalogos)

const auth = vi.hoisted(() => ({
  useAuth: vi.fn(),
}))

vi.mock('../../auth/useAuth', () => auth)

const ALUMNO_ID = '11111111-1111-4111-8111-111111111111'
const ANIO_ID = '22222222-2222-4222-8222-222222222222'
const NIVEL_ID = '33333333-3333-4333-8333-333333333333'
const GRADO_ID = '44444444-4444-4444-8444-444444444444'
const SECCION_ID = '55555555-5555-4555-8555-555555555555'

const MATRICULA_SOLICITADA: MatriculaAdminResponsePayload = {
  id: '66666666-6666-4666-8666-666666666666',
  alumnoId: ALUMNO_ID,
  seccionId: SECCION_ID,
  anioId: ANIO_ID,
  estado: 'SOLICITADA',
  fechaSolicitud: '2026-03-01',
  fechaAprobacion: null,
  fechaRetiro: null,
  motivoRetiro: null,
  observaciones: null,
  createdAt: '2026-03-01T10:00:00.000Z',
  updatedAt: '2026-03-01T10:00:00.000Z',
}

const MATRICULA_APROBADA: MatriculaAdminResponsePayload = {
  ...MATRICULA_SOLICITADA,
  id: '77777777-7777-4777-8777-777777777777',
  estado: 'APROBADA',
  fechaAprobacion: '2026-03-02',
}

const PERMISOS_GESTION = [
  'administrative.matriculas.leer',
  'administrative.matriculas.gestionar',
]

function configurarPermisos(permissions: string[]) {
  auth.useAuth.mockReturnValue({ usuario: { permissions } })
}

function montar() {
  render(<MatriculasPage />)
}

beforeEach(() => {
  vi.resetAllMocks()

  configurarPermisos(PERMISOS_GESTION)

  api.listarMatriculas.mockResolvedValue({
    data: [MATRICULA_SOLICITADA, MATRICULA_APROBADA],
    meta: { page: 1, pageSize: 20, total: 2 },
  })
  api.aprobarMatricula.mockResolvedValue({ ...MATRICULA_SOLICITADA, estado: 'APROBADA' })
  api.rechazarMatricula.mockResolvedValue({ ...MATRICULA_SOLICITADA, estado: 'RECHAZADA' })
  api.retirarMatricula.mockResolvedValue({ ...MATRICULA_APROBADA, estado: 'RETIRADA' })

  catalogos.listarAlumnosCatalogo.mockResolvedValue([
    { id: ALUMNO_ID, codigoAlumno: '2026-001', nombres: 'Ana', apellidos: 'Torres' },
  ])
  catalogos.listarAniosCatalogo.mockResolvedValue([{ id: ANIO_ID, nombre: '2026' }])
  catalogos.listarNivelesCatalogo.mockResolvedValue([{ id: NIVEL_ID, nombre: 'Primaria' }])
  catalogos.listarGradosCatalogo.mockResolvedValue([
    { id: GRADO_ID, nombre: '1° Primaria', nivelId: NIVEL_ID },
  ])
  catalogos.listarSeccionesCatalogo.mockResolvedValue([
    { id: SECCION_ID, nombre: 'A', gradoId: GRADO_ID },
  ])
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('MatriculasPage', () => {
  it('carga y muestra la lista de matrículas', async () => {
    montar()

    expect(await screen.findByText('Gestión de Matrículas')).toBeInTheDocument()
    expect((await screen.findAllByText('2026-001 - Ana Torres')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Solicitada')[0]).toBeInTheDocument()
    expect(screen.getAllByText('Aprobada')[0]).toBeInTheDocument()
    expect(api.listarMatriculas).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, pageSize: 20 }),
    )
  })

  it('muestra el estado vacío cuando no hay matrículas', async () => {
    api.listarMatriculas.mockResolvedValue({
      data: [],
      meta: { page: 1, pageSize: 20, total: 0 },
    })

    montar()

    expect(await screen.findByText('No se encontraron matrículas')).toBeInTheDocument()
  })

  it('filtra por estado y reinicia la página', async () => {
    montar()
    const usuario = userEvent.setup()

    await usuario.selectOptions(await screen.findByLabelText(/^Estado/), 'APROBADA')

    await waitFor(() =>
      expect(api.listarMatriculas).toHaveBeenCalledWith(
        expect.objectContaining({ estado: 'APROBADA', page: 1 }),
      ),
    )
  })

  it('aprueba una matrícula en estado SOLICITADA', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    montar()
    const usuario = userEvent.setup()

    await usuario.click(await screen.findByRole('button', { name: 'Aprobar' }))

    await waitFor(() =>
      expect(api.aprobarMatricula).toHaveBeenCalledWith(MATRICULA_SOLICITADA.id),
    )
    expect(await screen.findByText('Matrícula aprobada correctamente')).toBeInTheDocument()
  })

  it('rechaza una matrícula con motivo obligatorio', async () => {
    vi.spyOn(window, 'prompt').mockReturnValue('Documentos incompletos')

    montar()
    const usuario = userEvent.setup()

    await usuario.click(await screen.findByRole('button', { name: 'Rechazar' }))

    await waitFor(() =>
      expect(api.rechazarMatricula).toHaveBeenCalledWith(MATRICULA_SOLICITADA.id, {
        motivo: 'Documentos incompletos',
      }),
    )
  })

  it('no rechaza si el motivo está vacío', async () => {
    vi.spyOn(window, 'prompt').mockReturnValue('')

    montar()
    const usuario = userEvent.setup()

    await usuario.click(await screen.findByRole('button', { name: 'Rechazar' }))

    expect(api.rechazarMatricula).not.toHaveBeenCalled()
  })

  it('retira una matrícula aprobada', async () => {
    vi.spyOn(window, 'prompt').mockReturnValue('Traslado de institución')

    montar()
    const usuario = userEvent.setup()

    await usuario.click(await screen.findByRole('button', { name: 'Retirar' }))

    await waitFor(() =>
      expect(api.retirarMatricula).toHaveBeenCalledWith(MATRICULA_APROBADA.id, {
        motivo: 'Traslado de institución',
      }),
    )
  })

  it('oculta las acciones de gestión sin el permiso correspondiente', async () => {
    configurarPermisos(['administrative.matriculas.leer'])

    montar()

    await screen.findByText('Gestión de Matrículas')

    expect(screen.queryByRole('button', { name: 'Aprobar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Rechazar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Retirar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Nueva matrícula' })).not.toBeInTheDocument()
  })

  it('informa cuando el usuario no puede consultar matrículas', async () => {
    configurarPermisos([])

    montar()

    expect(
      await screen.findByText('No tiene permiso para consultar matrículas.'),
    ).toBeInTheDocument()
    expect(api.listarMatriculas).not.toHaveBeenCalled()
  })
})
