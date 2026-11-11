import type {
  AsistenciaResponse,
  JustificacionResponse,
  MeResponse,
  Permission,
  RoleCode,
} from '@intranet/shared'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiClientError } from '../../../shared/api/client'
import { AsistenciasPage } from './AsistenciasPage'

const api = vi.hoisted(() => ({
  listarAsistencias: vi.fn(),
  listarJustificaciones: vi.fn(),
  registrarAsistenciaLote: vi.fn(),
  corregirAsistencia: vi.fn(),
  solicitarJustificacion: vi.fn(),
  aprobarJustificacion: vi.fn(),
  rechazarJustificacion: vi.fn(),
}))

vi.mock('./api', () => api)

const { useAuthMock } = vi.hoisted(() => ({ useAuthMock: vi.fn() }))

vi.mock('../../auth/useAuth', () => ({ useAuth: useAuthMock }))

const ALUMNO_ID = '22222222-2222-4222-8222-222222222222'
const SECCION_ID = '66666666-6666-4666-8666-666666666666'
const ANIO_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const OTRO_ALUMNO_ID = '77777777-7777-4777-8777-777777777777'

const FALTA: AsistenciaResponse = {
  id: '88888888-8888-4888-8888-888888888888',
  alumnoId: ALUMNO_ID,
  fecha: '2024-05-02',
  estado: 'FALTA_INJUSTIFICADA',
  observacion: null,
  createdAt: '2024-05-02T10:00:00.000Z',
  updatedAt: '2024-05-02T10:00:00.000Z',
}

const PRESENTE: AsistenciaResponse = {
  id: '99999999-9999-4999-8999-999999999999',
  alumnoId: OTRO_ALUMNO_ID,
  fecha: '2024-05-03',
  estado: 'PRESENTE',
  observacion: null,
  createdAt: '2024-05-03T10:00:00.000Z',
  updatedAt: '2024-05-03T10:00:00.000Z',
}

const JUSTIFICACION: JustificacionResponse = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  asistenciaId: FALTA.id,
  solicitanteUsuarioId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  motivo: 'Cita médica',
  estado: 'SOLICITADA',
  resueltoPor: null,
  resueltoEn: null,
  motivoResolucion: null,
  createdAt: '2024-05-02T11:00:00.000Z',
  updatedAt: '2024-05-02T11:00:00.000Z',
}

const PERMISOS_DOCENTE: Permission[] = [
  'core.perfil.leer',
  'academic.asistencias.gestionar',
  'academic.asistencias.leer',
  'academic.asistencias.justificar',
]

const PERMISOS_APODERADO: Permission[] = [
  'core.perfil.leer',
  'academic.asistencias.leer',
  'academic.asistencias.solicitar',
]

const PERMISOS_ALUMNO: Permission[] = [
  'core.perfil.leer',
  'academic.asistencias.leer',
]

function crearPerfil(
  permissions: Permission[],
  roles: RoleCode[],
): MeResponse {
  return {
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
    roles,
    permissions,
  }
}

function sesion(permissions: Permission[], roles: RoleCode[]) {
  useAuthMock.mockReturnValue({
    usuario: crearPerfil(permissions, roles),
    cargando: false,
    iniciarSesion: vi.fn(),
    cambiarPassword: vi.fn(),
    cerrarSesion: vi.fn(),
  })
}

function paginaVacia() {
  return { data: [], meta: { page: 1, pageSize: 100, total: 0 } }
}

function paginaCon<T>(data: T[]) {
  return { data, meta: { page: 1, pageSize: 100, total: data.length } }
}

function montar(ruta = '/asistencias') {
  const router = createMemoryRouter(
    [{ path: '/asistencias', element: <AsistenciasPage /> }],
    { initialEntries: [ruta] },
  )

  render(<RouterProvider router={router} />)

  return router
}

beforeEach(() => {
  vi.resetAllMocks()
  api.listarAsistencias.mockResolvedValue(paginaVacia())
  api.listarJustificaciones.mockResolvedValue(paginaVacia())
  api.registrarAsistenciaLote.mockResolvedValue({ registros: [PRESENTE] })
  api.corregirAsistencia.mockResolvedValue(PRESENTE)
  api.solicitarJustificacion.mockResolvedValue(JUSTIFICACION)
  api.aprobarJustificacion.mockResolvedValue({
    ...JUSTIFICACION,
    estado: 'APROBADA',
  })
  api.rechazarJustificacion.mockResolvedValue({
    ...JUSTIFICACION,
    estado: 'RECHAZADA',
  })
  sesion(PERMISOS_DOCENTE, ['DOCENTE'])
})

afterEach(() => {
  cleanup()
})

describe('AsistenciasPage', () => {
  it('muestra un estado de carga accesible mientras consulta', () => {
    api.listarAsistencias.mockReturnValue(new Promise(() => {}))
    api.listarJustificaciones.mockReturnValue(new Promise(() => {}))

    montar()

    expect(screen.getByRole('status')).toHaveTextContent(
      'Cargando asistencias…',
    )
  })

  it('muestra los estados vacíos de asistencias y justificaciones', async () => {
    montar()

    expect(
      await screen.findByText(
        'No hay asistencias registradas con estos filtros.',
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByText('No hay justificaciones registradas.'),
    ).toBeInTheDocument()
    expect(api.listarAsistencias).toHaveBeenCalledWith({})
    expect(api.listarJustificaciones).toHaveBeenCalledWith({})
  })

  it('anuncia el error de carga con role alert', async () => {
    api.listarAsistencias.mockRejectedValueOnce(
      new ApiClientError('INTERNAL_ERROR', 'No se pudo consultar.', 500),
    )

    montar()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se pudo consultar.',
    )
  })

  it('muestra los cuatro estados de asistencia al alumno sin acciones', async () => {
    sesion(PERMISOS_ALUMNO, ['ALUMNO'])
    api.listarAsistencias.mockResolvedValue(
      paginaCon([
        { ...FALTA, id: '11111111-1111-4111-8111-111111111111', estado: 'PRESENTE' },
        { ...FALTA, id: '11111111-1111-4111-8111-111111111112', estado: 'TARDE' },
        {
          ...FALTA,
          id: '11111111-1111-4111-8111-111111111113',
          estado: 'FALTA_JUSTIFICADA',
        },
        FALTA,
      ]),
    )

    montar()

    expect(await screen.findByText('Presente')).toBeInTheDocument()
    expect(screen.getByText('Tarde')).toBeInTheDocument()
    expect(screen.getByText('Falta justificada')).toBeInTheDocument()
    expect(screen.getByText('Falta injustificada')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Registrar asistencia' }),
    ).toBeNull()
    expect(
      screen.queryByRole('button', { name: /corregir la asistencia/i }),
    ).toBeNull()
    expect(
      screen.queryByRole('button', { name: /solicitar justificación/i }),
    ).toBeNull()
    expect(screen.getAllByText('Solo consulta')).toHaveLength(4)
  })

  it('permite al apoderado solicitar la justificación de una falta', async () => {
    sesion(PERMISOS_APODERADO, ['APODERADO'])
    api.listarAsistencias.mockResolvedValue(paginaCon([FALTA, PRESENTE]))
    const usuario = userEvent.setup()

    montar()

    const solicitar = await screen.findByRole('button', {
      name: /solicitar justificación de la falta/i,
    })
    expect(
      screen.getAllByRole('button', {
        name: /solicitar justificación de la falta/i,
      }),
    ).toHaveLength(1)

    await usuario.click(solicitar)
    expect(
      screen.getByRole('heading', { name: 'Solicitar justificación' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Motivo de la solicitud')).toHaveFocus()

    await usuario.type(
      screen.getByLabelText('Motivo de la solicitud'),
      'Cita médica',
    )
    await usuario.click(screen.getByRole('button', { name: 'Enviar solicitud' }))

    expect(api.solicitarJustificacion).toHaveBeenCalledWith(FALTA.id, {
      motivo: 'Cita médica',
    })
    expect(
      await screen.findByText('Solicitud de justificación enviada.'),
    ).toHaveFocus()
  })

  it('registra el lote de asistencia como docente', async () => {
    const usuario = userEvent.setup()

    montar()

    await usuario.click(
      await screen.findByRole('button', { name: 'Registrar asistencia' }),
    )
    expect(screen.getByLabelText('Sección de la asistencia')).toHaveFocus()

    await usuario.type(
      screen.getByLabelText('Sección de la asistencia'),
      SECCION_ID,
    )
    await usuario.type(
      screen.getByLabelText('Fecha de la asistencia'),
      '2024-05-02',
    )
    await usuario.type(screen.getByLabelText('Alumno 1'), ALUMNO_ID)
    await usuario.selectOptions(screen.getByLabelText('Estado 1'), 'TARDE')
    await usuario.click(
      screen.getByRole('button', { name: 'Registrar asistencia' }),
    )

    expect(api.registrarAsistenciaLote).toHaveBeenCalledWith({
      seccionId: SECCION_ID,
      fecha: '2024-05-02',
      registros: [{ alumnoId: ALUMNO_ID, estado: 'TARDE' }],
    })
    expect(
      await screen.findByText('Asistencia registrada para 1 alumno.'),
    ).toHaveFocus()
  })

  it('valida el lote antes de llamar a la API', async () => {
    const usuario = userEvent.setup()

    montar()

    await usuario.click(
      await screen.findByRole('button', { name: 'Registrar asistencia' }),
    )
    await usuario.click(
      screen.getByRole('button', { name: 'Registrar asistencia' }),
    )

    expect(screen.getByText('La sección es obligatoria.')).toBeInTheDocument()
    expect(screen.getByText('El alumno es obligatorio.')).toBeInTheDocument()
    expect(
      screen.getByText('La fecha debe tener el formato AAAA-MM-DD'),
    ).toBeInTheDocument()
    expect(api.registrarAsistenciaLote).not.toHaveBeenCalled()
  })

  it('exige motivo al corregir una asistencia', async () => {
    api.listarAsistencias.mockResolvedValue(paginaCon([FALTA]))
    const usuario = userEvent.setup()

    montar()

    await usuario.click(
      await screen.findByRole('button', {
        name: /corregir la asistencia del alumno/i,
      }),
    )
    expect(
      screen.getByRole('heading', { name: 'Corregir asistencia' }),
    ).toBeInTheDocument()

    await usuario.click(
      screen.getByRole('button', { name: 'Guardar corrección' }),
    )

    expect(screen.getByText('El motivo es obligatorio.')).toBeInTheDocument()
    expect(api.corregirAsistencia).not.toHaveBeenCalled()

    await usuario.type(
      screen.getByLabelText('Motivo de la corrección'),
      'Error de registro',
    )
    await usuario.click(
      screen.getByRole('button', { name: 'Guardar corrección' }),
    )

    expect(api.corregirAsistencia).toHaveBeenCalledWith(FALTA.id, {
      estado: 'FALTA_INJUSTIFICADA',
      motivo: 'Error de registro',
    })
    expect(await screen.findByText('Asistencia corregida.')).toBeInTheDocument()
  })

  it('aprueba una justificación solicitada', async () => {
    api.listarJustificaciones.mockResolvedValue(paginaCon([JUSTIFICACION]))
    const usuario = userEvent.setup()

    montar()

    await usuario.click(
      await screen.findByRole('button', {
        name: `Aprobar la justificación ${JUSTIFICACION.id}`,
      }),
    )

    expect(api.aprobarJustificacion).toHaveBeenCalledWith(JUSTIFICACION.id)
    expect(
      await screen.findByText('Justificación aprobada.'),
    ).toBeInTheDocument()
  })

  it('exige motivo para rechazar una justificación', async () => {
    api.listarJustificaciones.mockResolvedValue(paginaCon([JUSTIFICACION]))
    const usuario = userEvent.setup()

    montar()

    await usuario.click(
      await screen.findByRole('button', {
        name: `Rechazar la justificación ${JUSTIFICACION.id}`,
      }),
    )
    expect(
      screen.getByRole('heading', { name: 'Rechazar justificación' }),
    ).toBeInTheDocument()

    await usuario.click(
      screen.getByRole('button', { name: 'Rechazar justificación' }),
    )
    expect(screen.getByText('El motivo es obligatorio')).toBeInTheDocument()
    expect(api.rechazarJustificacion).not.toHaveBeenCalled()

    await usuario.type(
      screen.getByLabelText('Motivo del rechazo'),
      'Sin documentos',
    )
    await usuario.click(
      screen.getByRole('button', { name: 'Rechazar justificación' }),
    )

    expect(api.rechazarJustificacion).toHaveBeenCalledWith(JUSTIFICACION.id, {
      motivo: 'Sin documentos',
    })
    expect(
      await screen.findByText('Justificación rechazada.'),
    ).toBeInTheDocument()
  })

  it('consulta con los filtros indicados en la ruta', async () => {
    montar(
      `/asistencias?anioId=${ANIO_ID}&seccionId=${SECCION_ID}&desde=2024-05-01&hasta=2024-05-31`,
    )

    await waitFor(() =>
      expect(api.listarAsistencias).toHaveBeenCalledWith({
        anioId: ANIO_ID,
        seccionId: SECCION_ID,
        desde: '2024-05-01',
        hasta: '2024-05-31',
      }),
    )
    expect(api.listarJustificaciones).toHaveBeenCalledWith({
      seccionId: SECCION_ID,
    })
  })
})
