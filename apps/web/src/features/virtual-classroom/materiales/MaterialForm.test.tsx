import type { MaterialResponsePayload } from '@intranet/shared'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MaterialForm } from './MaterialForm'

const api = vi.hoisted(() => ({
  subirAdjunto: vi.fn(),
  crearMaterial: vi.fn(),
  actualizarMaterial: vi.fn(),
  eliminarAdjunto: vi.fn(),
  obtenerMaterial: vi.fn(),
}))

vi.mock('./api', () => api)

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

function montar(props: {
  materialId?: string
  onGuardado?: (mensaje?: string) => void
}) {
  const onGuardado = props.onGuardado ?? vi.fn()

  render(
    <MaterialForm
      materialId={props.materialId}
      anioId={ANIO_ID}
      cursos={[{ id: CURSO_ID, nombre: 'Matemática' }]}
      secciones={[{ id: SECCION_ID, nombre: 'A' }]}
      periodos={[{ id: PERIODO_ID, nombre: 'Bimestre I' }]}
      onGuardado={onGuardado}
      onCancelar={vi.fn()}
    />,
  )

  return { onGuardado }
}

function archivoPdf() {
  return new File(['abc'], 'guia.pdf', { type: 'application/pdf' })
}

beforeEach(() => {
  vi.resetAllMocks()
  api.crearMaterial.mockResolvedValue(MATERIAL)
  api.actualizarMaterial.mockResolvedValue(MATERIAL)
  api.obtenerMaterial.mockResolvedValue(MATERIAL)
})

afterEach(() => {
  cleanup()
})

describe('MaterialForm', () => {
  it('valida los campos obligatorios antes de llamar a la API', async () => {
    const usuario = userEvent.setup()

    montar({})

    await usuario.click(screen.getByRole('button', { name: 'Crear' }))

    expect(
      await screen.findByText('El título es obligatorio'),
    ).toBeInTheDocument()
    expect(screen.getByText('Curso inválido')).toBeInTheDocument()
    expect(screen.getByText('Sección inválida')).toBeInTheDocument()
    expect(screen.getByText('Período inválido')).toBeInTheDocument()
    expect(
      screen.getByText('El nombre del archivo es obligatorio'),
    ).toBeInTheDocument()
    expect(screen.getByText('Debe seleccionar un archivo')).toBeInTheDocument()
    expect(api.crearMaterial).not.toHaveBeenCalled()
  })

  it('crea un material con archivo válido y notifica al guardar', async () => {
    const usuario = userEvent.setup()
    const { onGuardado } = montar({})

    await usuario.type(screen.getByLabelText(/Título/), 'Guía de fracciones')
    await usuario.type(screen.getByLabelText(/Curso/), CURSO_ID)
    await usuario.type(screen.getByLabelText(/Sección/), SECCION_ID)
    await usuario.type(screen.getByLabelText(/Período/), PERIODO_ID)
    await usuario.upload(
      screen.getByLabelText('Seleccionar archivo'),
      archivoPdf(),
    )

    await usuario.click(screen.getByRole('button', { name: 'Crear' }))

    await waitFor(() =>
      expect(api.crearMaterial).toHaveBeenCalledWith({
        cursoId: CURSO_ID,
        seccionId: SECCION_ID,
        periodoId: PERIODO_ID,
        titulo: 'Guía de fracciones',
        descripcion: '',
        archivoNombre: 'guia.pdf',
        archivoMime: 'application/pdf',
        tamanoBytes: 3,
      }),
    )
    expect(onGuardado).toHaveBeenCalled()
  })

  it('rechaza archivos con tipo MIME no permitido', async () => {
    montar({})

    // `user.upload` filtra por el atributo `accept`; aquí probamos la validación
    // del formulario con un tipo que llega desde el sistema operativo.
    fireEvent.change(screen.getByLabelText('Seleccionar archivo'), {
      target: {
        files: [
          new File(['x'], 'programa.exe', {
            type: 'application/x-msdownload',
          }),
        ],
      },
    })

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Tipo de archivo no permitido: application/x-msdownload',
    )
    expect(api.crearMaterial).not.toHaveBeenCalled()
  })

  it('precarga los datos del material en modo edición', async () => {
    const usuario = userEvent.setup()
    montar({ materialId: MATERIAL.id })

    expect(api.obtenerMaterial).toHaveBeenCalledWith(MATERIAL.id, ANIO_ID)
    expect(await screen.findByLabelText(/Título/)).toHaveValue(
      'Guía de fracciones',
    )
    expect(screen.getByLabelText('Descripción')).toHaveValue(
      'Material de refuerzo',
    )
    expect(screen.getByLabelText(/Curso/)).toHaveValue(CURSO_ID)

    await usuario.clear(screen.getByLabelText(/Título/))
    await usuario.type(screen.getByLabelText(/Título/), 'Guía corregida')
    await usuario.click(screen.getByRole('button', { name: 'Actualizar' }))

    await waitFor(() =>
      expect(api.actualizarMaterial).toHaveBeenCalledWith(MATERIAL.id, {
        cursoId: CURSO_ID,
        seccionId: SECCION_ID,
        periodoId: PERIODO_ID,
        titulo: 'Guía corregida',
        descripcion: 'Material de refuerzo',
        archivoNombre: 'guia-fracciones.pdf',
        archivoMime: 'application/pdf',
        tamanoBytes: 2048,
      }),
    )
  })
})
