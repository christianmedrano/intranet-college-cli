import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AdjuntosUpload } from './AdjuntosUpload'

const ADJUNTO_EXISTENTE = {
  id: '11111111-1111-4111-8111-111111111111',
  nombreOriginal: 'guia.pdf',
  url: 'http://localhost:3000/uploads/guia.pdf',
  tipoMime: 'application/pdf',
  tamanoBytes: 2048,
}

function archivoPdf(nombre = 'material.pdf') {
  return new File(['abc'], nombre, { type: 'application/pdf' })
}

function archivoGrande() {
  const archivo = new File(['x'], 'enorme.pdf', { type: 'application/pdf' })
  Object.defineProperty(archivo, 'size', { value: 11 * 1024 * 1024 })
  return archivo
}

function seleccionar(archivos: File[]) {
  fireEvent.change(screen.getByLabelText('Seleccionar archivos'), {
    target: { files: archivos },
  })
}

const onAgregar = vi.fn()
const onEliminar = vi.fn()

function montar(props: Partial<Parameters<typeof AdjuntosUpload>[0]> = {}) {
  render(
    <AdjuntosUpload
      onAgregar={onAgregar}
      onEliminar={onEliminar}
      maxArchivos={3}
      {...props}
    />,
  )
}

beforeEach(() => {
  vi.resetAllMocks()
  URL.createObjectURL = vi.fn(() => 'blob:preview')
  URL.revokeObjectURL = vi.fn()
})

afterEach(() => {
  cleanup()
})

describe('AdjuntosUpload', () => {
  it('notifica un archivo válido y lo muestra como pendiente', async () => {
    const usuario = userEvent.setup()

    montar()

    await usuario.upload(
      screen.getByLabelText('Seleccionar archivos'),
      archivoPdf(),
    )

    expect(onAgregar).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Pendientes de subida')).toBeInTheDocument()
    expect(screen.getByText('material.pdf')).toBeInTheDocument()
    expect(screen.getByText('1 / 3 archivo(s)')).toBeInTheDocument()
  })

  it('rechaza un tipo MIME no permitido sin notificar al padre', () => {
    montar()

    seleccionar([
      new File(['x'], 'programa.exe', { type: 'application/x-msdownload' }),
    ])

    expect(
      screen.getByText(/Tipo de archivo no permitido/),
    ).toBeInTheDocument()
    expect(onAgregar).not.toHaveBeenCalled()
  })

  it('rechaza archivos que superan el tamaño máximo', () => {
    montar()

    seleccionar([archivoGrande()])

    expect(
      screen.getByText(/Archivo demasiado grande/),
    ).toBeInTheDocument()
    expect(onAgregar).not.toHaveBeenCalled()
  })

  it('respeta el límite de archivos configurado', () => {
    montar({
      maxArchivos: 1,
      adjuntosExistentes: [ADJUNTO_EXISTENTE],
    })

    seleccionar([archivoPdf()])

    expect(
      screen.getAllByText('Límite de 1 archivo(s) alcanzado.'),
    ).toHaveLength(2)
    expect(onAgregar).not.toHaveBeenCalled()
  })

  it('genera preview para imágenes', () => {
    montar()

    seleccionar([
      new File(['x'], 'foto.png', { type: 'image/png' }),
    ])

    expect(URL.createObjectURL).toHaveBeenCalled()
    expect(
      screen.getByRole('img', { name: 'foto.png' }),
    ).toBeInTheDocument()
  })

  it('elimina un archivo pendiente y notifica al padre', async () => {
    const usuario = userEvent.setup()

    montar()

    await usuario.upload(
      screen.getByLabelText('Seleccionar archivos'),
      archivoPdf(),
    )
    await usuario.click(
      screen.getByRole('button', { name: 'Eliminar material.pdf' }),
    )

    expect(onEliminar).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Pendientes de subida')).toBeNull()
  })

  it('lista los adjuntos existentes y permite eliminarlos', async () => {
    const usuario = userEvent.setup()

    montar({ adjuntosExistentes: [ADJUNTO_EXISTENTE] })

    expect(screen.getByText('Archivos adjuntos')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'guia.pdf' })).toHaveAttribute(
      'href',
      ADJUNTO_EXISTENTE.url,
    )

    await usuario.click(
      screen.getByRole('button', { name: 'Eliminar guia.pdf' }),
    )

    expect(onEliminar).toHaveBeenCalledWith(ADJUNTO_EXISTENTE.id)
  })

  it('deshabilita la subida cuando se solicita', () => {
    montar({ deshabilitado: true })

    expect(screen.getByLabelText('Seleccionar archivos')).toBeDisabled()
    expect(screen.getByText('Subida deshabilitada.')).toBeInTheDocument()
  })
})
