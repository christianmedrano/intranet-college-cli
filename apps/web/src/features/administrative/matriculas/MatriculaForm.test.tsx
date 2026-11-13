import type { MatriculaAdminResponsePayload } from '@intranet/shared'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MatriculaForm } from './MatriculaForm'

const api = vi.hoisted(() => ({
  solicitarMatricula: vi.fn(),
}))

vi.mock('./api', () => api)

const ALUMNO_ID = '11111111-1111-4111-8111-111111111111'
const ANIO_ID = '22222222-2222-4222-8222-222222222222'
const NIVEL_ID = '33333333-3333-4333-8333-333333333333'
const OTRO_NIVEL_ID = '33333333-3333-4333-8333-333333333334'
const GRADO_ID = '44444444-4444-4444-8444-444444444444'
const SECCION_ID = '55555555-5555-4555-8555-555555555555'

const ALUMNOS = [
  { id: ALUMNO_ID, codigoAlumno: '2026-001', nombres: 'Ana', apellidos: 'Torres' },
]

const ANIOS = [{ id: ANIO_ID, nombre: '2026' }]

const NIVELES = [
  { id: NIVEL_ID, nombre: 'Primaria' },
  { id: OTRO_NIVEL_ID, nombre: 'Secundaria' },
]

const GRADOS = [
  { id: GRADO_ID, nombre: '1° Primaria', nivelId: NIVEL_ID },
  { id: '44444444-4444-4444-8444-444444444445', nombre: '1° Secundaria', nivelId: OTRO_NIVEL_ID },
]

const SECCIONES = [
  { id: SECCION_ID, nombre: 'A', gradoId: GRADO_ID },
  { id: '55555555-5555-4555-8555-555555555556', nombre: 'B', gradoId: '44444444-4444-4444-8444-444444444445' },
]

const MATRICULA: MatriculaAdminResponsePayload = {
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

function montar() {
  const onGuardado = vi.fn()
  const onCancelar = vi.fn()

  render(
    <MatriculaForm
      alumnos={ALUMNOS}
      anios={ANIOS}
      niveles={NIVELES}
      grados={GRADOS}
      secciones={SECCIONES}
      onGuardado={onGuardado}
      onCancelar={onCancelar}
    />,
  )

  return { onGuardado, onCancelar }
}

async function completarSelecciones() {
  const usuario = userEvent.setup()

  await usuario.selectOptions(screen.getByLabelText(/^Alumno/), ALUMNO_ID)
  await usuario.selectOptions(screen.getByLabelText(/Año académico/), ANIO_ID)
  await usuario.selectOptions(screen.getByLabelText(/^Nivel/), NIVEL_ID)
  await usuario.selectOptions(screen.getByLabelText(/^Grado/), GRADO_ID)
  await usuario.selectOptions(screen.getByLabelText(/^Sección/), SECCION_ID)

  return usuario
}

beforeEach(() => {
  vi.resetAllMocks()
  api.solicitarMatricula.mockResolvedValue(MATRICULA)
})

afterEach(() => {
  cleanup()
})

describe('MatriculaForm', () => {
  it('muestra error al enviar sin seleccionar alumno', async () => {
    const usuario = userEvent.setup()

    montar()

    await usuario.click(screen.getByRole('button', { name: 'Solicitar matrícula' }))

    expect(await screen.findByText('Debe seleccionar un alumno')).toBeInTheDocument()
    expect(api.solicitarMatricula).not.toHaveBeenCalled()
  })

  it('filtra grados y secciones en cascada según nivel y grado', async () => {
    const usuario = userEvent.setup()

    montar()

    await usuario.selectOptions(screen.getByLabelText(/^Nivel/), NIVEL_ID)

    await waitFor(() => {
      expect(screen.getByRole('option', { name: '1° Primaria' })).toBeInTheDocument()
      expect(screen.queryByRole('option', { name: '1° Secundaria' })).not.toBeInTheDocument()
    })

    await usuario.selectOptions(screen.getByLabelText(/^Grado/), GRADO_ID)

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'A' })).toBeInTheDocument()
      expect(screen.queryByRole('option', { name: 'B' })).not.toBeInTheDocument()
    })
  })

  it('envía la solicitud con alumno, año y sección', async () => {
    const { onGuardado } = montar()
    const usuario = await completarSelecciones()

    await usuario.click(screen.getByRole('button', { name: 'Solicitar matrícula' }))

    await waitFor(() =>
      expect(api.solicitarMatricula).toHaveBeenCalledWith({
        alumnoId: ALUMNO_ID,
        anioId: ANIO_ID,
        seccionId: SECCION_ID,
      }),
    )
    expect(onGuardado).toHaveBeenCalledWith('Matrícula solicitada correctamente')
  })

  it('incluye los documentos agregados en la solicitud', async () => {
    montar()
    const usuario = await completarSelecciones()

    await usuario.type(screen.getByLabelText('Nombre del archivo'), 'dni-ana.pdf')
    await usuario.type(screen.getByLabelText('Ruta del archivo'), '/documentos/dni-ana.pdf')
    await usuario.click(screen.getByRole('button', { name: 'Agregar documento' }))

    expect(screen.getByText('DNI — dni-ana.pdf')).toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: 'Solicitar matrícula' }))

    await waitFor(() =>
      expect(api.solicitarMatricula).toHaveBeenCalledWith({
        alumnoId: ALUMNO_ID,
        anioId: ANIO_ID,
        seccionId: SECCION_ID,
        documentos: [
          { tipo: 'DNI', archivoNombre: 'dni-ana.pdf', archivoRuta: '/documentos/dni-ana.pdf' },
        ],
      }),
    )
  })

  it('muestra el error de la API cuando la solicitud falla', async () => {
    api.solicitarMatricula.mockRejectedValueOnce(new Error('La sección no tiene cupo disponible'))
    montar()
    const usuario = await completarSelecciones()

    await usuario.click(screen.getByRole('button', { name: 'Solicitar matrícula' }))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('La sección no tiene cupo disponible'),
    )
  })

  it('llama a onCancelar al hacer clic en Cancelar', async () => {
    const { onCancelar } = montar()
    const usuario = userEvent.setup()

    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(onCancelar).toHaveBeenCalled()
  })
})
