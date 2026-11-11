import type {
  CalificacionResponse,
  MeResponse,
  NotaFinalResponse,
  Permission,
  RoleCode,
} from '@intranet/shared'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiClientError } from '../../../shared/api/client'
import { CalificacionesPage } from './CalificacionesPage'

const api = vi.hoisted(() => ({
  listarCalificaciones: vi.fn(),
  listarNotasFinales: vi.fn(),
  crearCalificacion: vi.fn(),
  actualizarCalificacion: vi.fn(),
  crearNotaFinal: vi.fn(),
  actualizarNotaFinal: vi.fn(),
}))

vi.mock('./api', () => api)

const { useAuthMock } = vi.hoisted(() => ({ useAuthMock: vi.fn() }))

vi.mock('../../auth/useAuth', () => ({ useAuth: useAuthMock }))

const PERIODO_ID = '11111111-1111-4111-8111-111111111111'
const ALUMNO_ID = '22222222-2222-4222-8222-222222222222'
const CURSO_ID = '33333333-3333-4333-8333-333333333333'

const CALIFICACION: CalificacionResponse = {
  id: '44444444-4444-4444-8444-444444444444',
  alumnoId: ALUMNO_ID,
  cursoId: CURSO_ID,
  periodoId: PERIODO_ID,
  valor: 'B',
  observacion: null,
  createdAt: '2024-05-02T10:00:00.000Z',
  updatedAt: '2024-05-02T10:00:00.000Z',
}

const NOTA_FINAL: NotaFinalResponse = {
  id: '55555555-5555-4555-8555-555555555555',
  alumnoId: ALUMNO_ID,
  cursoId: CURSO_ID,
  periodoId: PERIODO_ID,
  valor: 'A',
  observacion: 'Cierre del bimestre',
  createdAt: '2024-05-02T10:00:00.000Z',
  updatedAt: '2024-05-02T10:00:00.000Z',
}

const PERMISOS_DOCENTE: Permission[] = [
  'core.perfil.leer',
  'academic.calificaciones.gestionar',
  'academic.calificaciones.leer',
]

const PERMISOS_DIRECTOR: Permission[] = [
  'core.perfil.leer',
  'academic.calificaciones.corregir',
  'academic.calificaciones.leer',
]

const PERMISOS_APODERADO: Permission[] = [
  'core.perfil.leer',
  'academic.calificaciones.leer',
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

function montar(ruta = `/calificaciones?periodoId=${PERIODO_ID}`) {
  const router = createMemoryRouter(
    [{ path: '/calificaciones', element: <CalificacionesPage /> }],
    { initialEntries: [ruta] },
  )

  render(<RouterProvider router={router} />)

  return router
}

beforeEach(() => {
  vi.resetAllMocks()
  api.listarCalificaciones.mockResolvedValue(paginaVacia())
  api.listarNotasFinales.mockResolvedValue(paginaVacia())
  api.crearCalificacion.mockResolvedValue(CALIFICACION)
  api.actualizarCalificacion.mockResolvedValue(CALIFICACION)
  api.crearNotaFinal.mockResolvedValue(NOTA_FINAL)
  api.actualizarNotaFinal.mockResolvedValue(NOTA_FINAL)
  sesion(PERMISOS_DOCENTE, ['DOCENTE'])
})

afterEach(() => {
  cleanup()
})

describe('CalificacionesPage', () => {
  it('muestra un estado de carga accesible mientras consulta', () => {
    api.listarCalificaciones.mockReturnValue(new Promise(() => {}))
    api.listarNotasFinales.mockReturnValue(new Promise(() => {}))

    montar()

    expect(screen.getByRole('status')).toHaveTextContent(
      'Cargando calificaciones…',
    )
  })

  it('muestra los estados vacíos de calificaciones y notas finales', async () => {
    montar()

    expect(
      await screen.findByText(
        'No hay calificaciones registradas en este período.',
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByText('No hay notas finales registradas en este período.'),
    ).toBeInTheDocument()
    expect(api.listarCalificaciones).toHaveBeenCalledWith(PERIODO_ID)
    expect(api.listarNotasFinales).toHaveBeenCalledWith(PERIODO_ID)
  })

  it('pide el período cuando la ruta no lo incluye', () => {
    montar('/calificaciones')

    expect(
      screen.getByText(
        'Indica el período académico para consultar las calificaciones.',
      ),
    ).toBeInTheDocument()
    expect(api.listarCalificaciones).not.toHaveBeenCalled()
  })

  it('permite consultar un período desde el formulario', async () => {
    const usuario = userEvent.setup()
    const router = montar('/calificaciones')

    await usuario.type(
      screen.getByLabelText('Identificador del período'),
      PERIODO_ID,
    )
    await usuario.click(screen.getByRole('button', { name: 'Consultar' }))

    await waitFor(() =>
      expect(api.listarCalificaciones).toHaveBeenCalledWith(PERIODO_ID),
    )
    expect(router.state.location.search).toContain(`periodoId=${PERIODO_ID}`)
  })

  it('anuncia el error de carga con role alert', async () => {
    api.listarCalificaciones.mockRejectedValueOnce(
      new ApiClientError('INTERNAL_ERROR', 'No se pudo consultar.', 500),
    )

    montar()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se pudo consultar.',
    )
  })

  it('oculta todas las acciones de escritura al apoderado', async () => {
    sesion(PERMISOS_APODERADO, ['APODERADO'])
    api.listarCalificaciones.mockResolvedValue(paginaCon([CALIFICACION]))
    api.listarNotasFinales.mockResolvedValue(paginaCon([NOTA_FINAL]))

    montar()

    expect(
      await screen.findByRole('table', {
        name: 'Calificaciones registradas en el período',
      }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Nueva calificación' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Nueva nota final' })).toBeNull()
    expect(
      screen.queryByRole('button', { name: /editar la calificación/i }),
    ).toBeNull()
    expect(
      screen.queryByRole('button', { name: /corregir la calificación/i }),
    ).toBeNull()
    expect(screen.getAllByText('Solo consulta')).toHaveLength(2)
  })

  it('registra una calificación como docente y enfoca la confirmación', async () => {
    const usuario = userEvent.setup()
    api.listarCalificaciones
      .mockReset()
      .mockResolvedValueOnce(paginaVacia())
      .mockResolvedValue(paginaCon([CALIFICACION]))

    montar()

    await usuario.click(
      await screen.findByRole('button', { name: 'Nueva calificación' }),
    )

    const alumno = screen.getByLabelText('Alumno')
    expect(alumno).toHaveFocus()

    await usuario.type(alumno, ALUMNO_ID)
    await usuario.type(screen.getByLabelText('Curso'), CURSO_ID)
    await usuario.selectOptions(screen.getByLabelText('Valor'), 'A')
    await usuario.click(
      screen.getByRole('button', { name: 'Registrar calificación' }),
    )

    expect(api.crearCalificacion).toHaveBeenCalledWith({
      alumnoId: ALUMNO_ID,
      cursoId: CURSO_ID,
      periodoId: PERIODO_ID,
      valor: 'A',
    })

    const confirmacion = await screen.findByText('Calificación registrada.')
    expect(confirmacion).toHaveFocus()
    expect(
      await screen.findByRole('button', {
        name: /editar la calificación B/i,
      }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /corregir la calificación/i }),
    ).toBeNull()
  })

  it('valida los identificadores antes de llamar a la API', async () => {
    const usuario = userEvent.setup()

    montar()

    await usuario.click(
      await screen.findByRole('button', { name: 'Nueva calificación' }),
    )
    await usuario.click(
      screen.getByRole('button', { name: 'Registrar calificación' }),
    )

    expect(screen.getByText('El alumno es obligatorio.')).toBeInTheDocument()
    expect(screen.getByText('El curso es obligatorio.')).toBeInTheDocument()
    expect(api.crearCalificacion).not.toHaveBeenCalled()
  })

  it('exige motivo al Director y audita la corrección', async () => {
    sesion(PERMISOS_DIRECTOR, ['DIRECTOR'])
    api.listarCalificaciones.mockResolvedValue(paginaCon([CALIFICACION]))
    const usuario = userEvent.setup()

    montar()

    await usuario.click(
      await screen.findByRole('button', {
        name: /corregir la calificación B/i,
      }),
    )

    expect(
      screen.getByRole('heading', { name: 'Corregir calificación' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Nueva calificación' })).toBeNull()

    await usuario.click(
      screen.getByRole('button', { name: 'Guardar corrección' }),
    )

    expect(
      screen.getByText('El motivo es obligatorio para corregir.'),
    ).toBeInTheDocument()
    expect(api.actualizarCalificacion).not.toHaveBeenCalled()

    await usuario.type(
      screen.getByLabelText('Motivo de la corrección'),
      'Acta revisada',
    )
    await usuario.selectOptions(screen.getByLabelText('Valor'), 'AD')
    await usuario.click(
      screen.getByRole('button', { name: 'Guardar corrección' }),
    )

    expect(api.actualizarCalificacion).toHaveBeenCalledWith(CALIFICACION.id, {
      valor: 'AD',
      motivo: 'Acta revisada',
    })
    expect(
      await screen.findByText('Calificación corregida.'),
    ).toBeInTheDocument()
  })

  it('registra una nota final manual como docente', async () => {
    const usuario = userEvent.setup()
    api.listarNotasFinales
      .mockReset()
      .mockResolvedValueOnce(paginaVacia())
      .mockResolvedValue(paginaCon([NOTA_FINAL]))

    montar()

    await usuario.click(
      await screen.findByRole('button', { name: 'Nueva nota final' }),
    )
    expect(screen.getByLabelText('Alumno')).toHaveFocus()

    await usuario.type(screen.getByLabelText('Alumno'), ALUMNO_ID)
    await usuario.type(screen.getByLabelText('Curso'), CURSO_ID)
    await usuario.selectOptions(screen.getByLabelText('Valor'), 'C')
    await usuario.click(
      screen.getByRole('button', { name: 'Registrar nota final' }),
    )

    expect(api.crearNotaFinal).toHaveBeenCalledWith({
      alumnoId: ALUMNO_ID,
      cursoId: CURSO_ID,
      periodoId: PERIODO_ID,
      valor: 'C',
    })
    expect(await screen.findByText('Nota final registrada.')).toHaveFocus()
    expect(
      await screen.findByRole('button', {
        name: /editar la nota final A/i,
      }),
    ).toBeInTheDocument()
  })
})
