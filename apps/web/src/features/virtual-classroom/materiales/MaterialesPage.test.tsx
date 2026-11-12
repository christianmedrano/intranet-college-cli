import type {
  MaterialResponsePayload,
  MeResponse,
  Permission,
  RoleCode,
} from '@intranet/shared'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiClientError } from '../../../shared/api/client'
import { MaterialesPage } from './MaterialesPage'

const api = vi.hoisted(() => ({
  listarMateriales: vi.fn(),
  obtenerMaterial: vi.fn(),
  eliminarMaterial: vi.fn(),
}))

vi.mock('./api', () => api)

const { useAuthMock } = vi.hoisted(() => ({ useAuthMock: vi.fn() }))

vi.mock('../../auth/useAuth', () => ({ useAuth: useAuthMock }))

const ANIO_ID = '11111111-1111-4111-8111-111111111111'
const CURSO_ID = '22222222-2222-4222-8222-222222222222'
const SECCION_ID = '33333333-3333-4333-8333-333333333333'
const PERIODO_ID = '44444444-4444-4444-8444-444444444444'
const DOCENTE_ID = '55555555-5555-4555-8555-555555555555'

const MATERIAL: MaterialResponsePayload = {
  id: '66666666-6666-4666-8666-666666666666',
  cursoId: CURSO_ID,
  seccionId: SECCION_ID,
  periodoId: PERIODO_ID,
  docenteId: DOCENTE_ID,
  titulo: 'Guía de fracciones',
  descripcion: 'Material de refuerzo',
  archivoNombre: 'guia-fracciones.pdf',
  archivoMime: 'application/pdf',
  tamanoBytes: 2048,
  createdAt: '2026-05-02T10:00:00.000Z',
  updatedAt: '2026-05-02T10:00:00.000Z',
  adjuntos: [],
}

const PERMISOS_DOCENTE: Permission[] = [
  'core.perfil.leer',
  'virtual.leer',
  'virtual.gestionar',
  'virtual.eliminar',
]

const PERMISOS_APODERADO: Permission[] = ['core.perfil.leer', 'virtual.leer']

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
  return { data: [], meta: { page: 1, pageSize: 20, total: 0 } }
}

function paginaCon(data: MaterialResponsePayload[]) {
  return { data, meta: { page: 1, pageSize: 20, total: data.length } }
}

function montar(ruta = `/virtual?anioId=${ANIO_ID}`) {
  const router = createMemoryRouter(
    [{ path: '/virtual', element: <MaterialesPage /> }],
    { initialEntries: [ruta] },
  )

  render(<RouterProvider router={router} />)

  return router
}

beforeEach(() => {
  vi.resetAllMocks()
  api.listarMateriales.mockResolvedValue(paginaVacia())
  api.obtenerMaterial.mockResolvedValue(MATERIAL)
  api.eliminarMaterial.mockResolvedValue(undefined)
  sesion(PERMISOS_DOCENTE, ['DOCENTE'])
})

afterEach(() => {
  cleanup()
})

describe('MaterialesPage', () => {
  it('muestra un estado de carga accesible mientras consulta', () => {
    api.listarMateriales.mockReturnValue(new Promise(() => {}))

    montar()

    expect(screen.getByRole('status')).toHaveTextContent(
      'Cargando materiales…',
    )
  })

  it('pide el año académico cuando la ruta no lo incluye', () => {
    montar('/virtual')

    expect(
      screen.getByText(
        'Indica el año académico para consultar los materiales.',
      ),
    ).toBeInTheDocument()
    expect(api.listarMateriales).not.toHaveBeenCalled()
  })

  it('muestra el estado vacío del listado', async () => {
    montar()

    expect(
      await screen.findByText('No hay materiales registrados en este año.'),
    ).toBeInTheDocument()
    expect(api.listarMateriales).toHaveBeenCalledWith(ANIO_ID, {
      page: 1,
      pageSize: 20,
    })
  })

  it('anuncia el error de carga con role alert', async () => {
    api.listarMateriales.mockRejectedValueOnce(
      new ApiClientError('INTERNAL_ERROR', 'No se pudo consultar.', 500),
    )

    montar()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se pudo consultar.',
    )
  })

  it('lista los materiales del año en una tabla accesible', async () => {
    api.listarMateriales.mockResolvedValue(paginaCon([MATERIAL]))

    montar()

    expect(
      await screen.findByRole('table', {
        name: 'Materiales registrados en el año',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('rowheader', { name: /Guía de fracciones/ }),
    ).toBeInTheDocument()
    expect(screen.getByText('guia-fracciones.pdf')).toBeInTheDocument()
    expect(
      screen.getByRole('button', {
        name: 'Ver detalle del material Guía de fracciones',
      }),
    ).toBeInTheDocument()
  })

  it('aplica los filtros de curso, sección y período', async () => {
    const usuario = userEvent.setup()

    montar()

    await screen.findByText('No hay materiales registrados en este año.')

    await usuario.type(screen.getByLabelText('Curso'), CURSO_ID)
    await usuario.type(screen.getByLabelText('Sección'), SECCION_ID)
    await usuario.type(screen.getByLabelText('Período'), PERIODO_ID)
    await usuario.click(screen.getByRole('button', { name: 'Aplicar filtros' }))

    await waitFor(() =>
      expect(api.listarMateriales).toHaveBeenLastCalledWith(ANIO_ID, {
        page: 1,
        pageSize: 20,
        cursoId: CURSO_ID,
        seccionId: SECCION_ID,
        periodoId: PERIODO_ID,
      }),
    )
  })

  it('vuelve a consultar sin filtros al limpiarlos', async () => {
    const usuario = userEvent.setup()

    montar()

    await screen.findByText('No hay materiales registrados en este año.')

    await usuario.type(screen.getByLabelText('Curso'), CURSO_ID)
    await usuario.click(screen.getByRole('button', { name: 'Aplicar filtros' }))
    await usuario.click(screen.getByRole('button', { name: 'Limpiar filtros' }))

    await waitFor(() =>
      expect(api.listarMateriales).toHaveBeenLastCalledWith(ANIO_ID, {
        page: 1,
        pageSize: 20,
      }),
    )
  })

  it('oculta las acciones de escritura al apoderado', async () => {
    sesion(PERMISOS_APODERADO, ['APODERADO'])
    api.listarMateriales.mockResolvedValue(paginaCon([MATERIAL]))

    montar()

    expect(
      await screen.findByRole('table', {
        name: 'Materiales registrados en el año',
      }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Nuevo material' })).toBeNull()
    expect(
      screen.queryByRole('button', { name: /editar material/i }),
    ).toBeNull()
    expect(
      screen.queryByRole('button', { name: /eliminar material/i }),
    ).toBeNull()
    expect(screen.getByText('Solo consulta')).toBeInTheDocument()
  })

  it('abre el detalle del material con sus metadatos', async () => {
    const usuario = userEvent.setup()
    api.listarMateriales.mockResolvedValue(paginaCon([MATERIAL]))

    montar()

    await usuario.click(
      await screen.findByRole('button', {
        name: 'Ver detalle del material Guía de fracciones',
      }),
    )

    expect(api.obtenerMaterial).toHaveBeenCalledWith(MATERIAL.id, ANIO_ID)
    expect(
      await screen.findByRole('heading', { name: 'Guía de fracciones' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Archivo principal')).toBeInTheDocument()
    expect(screen.getByText('Metadatos')).toBeInTheDocument()
  })

  it('elimina un material tras confirmar y anuncia el resultado', async () => {
    const usuario = userEvent.setup()
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(true)
    api.listarMateriales
      .mockReset()
      .mockResolvedValueOnce(paginaCon([MATERIAL]))
      .mockResolvedValue(paginaVacia())

    montar()

    await usuario.click(
      await screen.findByRole('button', {
        name: 'Eliminar material Guía de fracciones',
      }),
    )

    expect(confirmar).toHaveBeenCalled()
    expect(api.eliminarMaterial).toHaveBeenCalledWith(MATERIAL.id)
    expect(
      await screen.findByText('Material eliminado correctamente.'),
    ).toHaveFocus()

    confirmar.mockRestore()
  })

  it('no elimina si el usuario cancela la confirmación', async () => {
    const usuario = userEvent.setup()
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(false)
    api.listarMateriales.mockResolvedValue(paginaCon([MATERIAL]))

    montar()

    await usuario.click(
      await screen.findByRole('button', {
        name: 'Eliminar material Guía de fracciones',
      }),
    )

    expect(api.eliminarMaterial).not.toHaveBeenCalled()

    confirmar.mockRestore()
  })

  it('niega el acceso cuando falta el permiso de lectura', () => {
    sesion(['core.perfil.leer'], ['ALUMNO'])

    montar('/virtual')

    expect(
      screen.getByText('No tienes permiso para consultar materiales.'),
    ).toBeInTheDocument()
  })
})
