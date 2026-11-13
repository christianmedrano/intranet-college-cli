import type { PlantillaCertificadoResponsePayload } from '@intranet/shared'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PlantillaForm } from './PlantillaForm'

const api = vi.hoisted(() => ({
  crearPlantilla: vi.fn(),
  actualizarPlantilla: vi.fn(),
}))

vi.mock('./api', () => api)

const PLANTILLA: PlantillaCertificadoResponsePayload = {
  id: '11111111-1111-4111-8111-111111111111',
  tipo: 'ESTUDIOS',
  nombre: 'Certificado de estudios 2026',
  contenido: '<p>{{alumno.nombres}}</p>',
  activa: true,
  version: 1,
  createdAt: '2026-03-01T10:00:00.000Z',
  updatedAt: '2026-03-01T10:00:00.000Z',
}

function montar(plantilla?: PlantillaCertificadoResponsePayload) {
  const onGuardado = vi.fn()
  const onCancelar = vi.fn()

  render(
    <PlantillaForm
      {...(plantilla ? { plantilla } : {})}
      onGuardado={onGuardado}
      onCancelar={onCancelar}
    />,
  )

  return { onGuardado, onCancelar }
}

beforeEach(() => {
  vi.resetAllMocks()
  api.crearPlantilla.mockResolvedValue(PLANTILLA)
  api.actualizarPlantilla.mockResolvedValue({ ...PLANTILLA, version: 2 })
})

afterEach(() => {
  cleanup()
})

describe('PlantillaForm', () => {
  it('muestra error si el nombre está vacío', async () => {
    const usuario = userEvent.setup()

    montar()

    await usuario.click(screen.getByRole('button', { name: 'Crear plantilla' }))

    expect(await screen.findByText('El nombre es obligatorio')).toBeInTheDocument()
    expect(api.crearPlantilla).not.toHaveBeenCalled()
  })

  it('crea una plantilla con nombre y contenido válidos', async () => {
    const { onGuardado } = montar()
    const usuario = userEvent.setup()

    await usuario.type(screen.getByLabelText(/Nombre/), 'Certificado de estudios 2026')
    await usuario.click(screen.getByRole('button', { name: 'Crear plantilla' }))

    await waitFor(() =>
      expect(api.crearPlantilla).toHaveBeenCalledWith(
        expect.objectContaining({
          tipo: 'ESTUDIOS',
          nombre: 'Certificado de estudios 2026',
          activa: true,
        }),
      ),
    )
    expect(onGuardado).toHaveBeenCalledWith('Plantilla creada correctamente')
  })

  it('actualiza una plantilla existente', async () => {
    const { onGuardado } = montar(PLANTILLA)
    const usuario = userEvent.setup()

    await usuario.click(screen.getByRole('button', { name: 'Actualizar plantilla' }))

    await waitFor(() =>
      expect(api.actualizarPlantilla).toHaveBeenCalledWith(
        PLANTILLA.id,
        expect.objectContaining({ nombre: PLANTILLA.nombre, contenido: PLANTILLA.contenido }),
      ),
    )
    expect(onGuardado).toHaveBeenCalledWith('Plantilla actualizada correctamente')
  })

  it('muestra el error de la API al crear', async () => {
    api.crearPlantilla.mockRejectedValueOnce(new Error('Ya existe una plantilla con ese nombre'))
    montar()
    const usuario = userEvent.setup()

    await usuario.type(screen.getByLabelText(/Nombre/), 'Duplicada')
    await usuario.click(screen.getByRole('button', { name: 'Crear plantilla' }))

    expect(
      await screen.findByRole('alert'),
    ).toHaveTextContent('Ya existe una plantilla con ese nombre')
  })

  it('llama a onCancelar al cancelar', async () => {
    const { onCancelar } = montar()
    const usuario = userEvent.setup()

    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(onCancelar).toHaveBeenCalled()
  })
})
