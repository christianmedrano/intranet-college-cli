import {
  estadoAsistenciaSchema,
  fechaEscolarSchema,
  registrarAsistenciaLoteSchema,
  uuidSchema,
  type EstadoAsistencia,
} from '@intranet/shared'
import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { registrarAsistenciaLote } from './api'
import { mensajeError } from '../shared/formato'

/** Estados válidos de una asistencia diaria (RN-ACAD-009). */
const ESTADOS: readonly EstadoAsistencia[] = [
  'PRESENTE',
  'TARDE',
  'FALTA_JUSTIFICADA',
  'FALTA_INJUSTIFICADA',
]

interface FilaLote {
  clave: number
  alumnoId: string
  estado: EstadoAsistencia
  observacion: string
}

interface AsistenciaLoteFormProps {
  /** Sección preseleccionada desde los filtros de la pantalla. */
  seccionInicial?: string
  /** Se invoca con un mensaje cuando el lote se registra correctamente. */
  onExito: (mensaje: string) => void
  /** Cierra el formulario sin guardar. */
  onCancelar: () => void
}

/**
 * Registro atómico de la asistencia diaria de una sección (RF-ACAD-004).
 *
 * Cada fila representa un alumno con su estado y observación opcional. El
 * backend valida matrícula, fecha y unicidad por alumno y fecha.
 */
export function AsistenciaLoteForm({
  seccionInicial,
  onExito,
  onCancelar,
}: AsistenciaLoteFormProps) {
  const [seccionId, setSeccionId] = useState(seccionInicial ?? '')
  const [fecha, setFecha] = useState('')
  const [filas, setFilas] = useState<FilaLote[]>([
    { clave: 0, alumnoId: '', estado: 'PRESENTE', observacion: '' },
  ])
  const [errores, setErrores] = useState<Record<string, string | undefined>>({})
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const siguienteClave = useRef(1)

  function cambiarFila(
    clave: number,
    cambios: Partial<Pick<FilaLote, 'alumnoId' | 'estado' | 'observacion'>>,
  ) {
    setFilas((actuales) =>
      actuales.map((fila) =>
        fila.clave === clave ? { ...fila, ...cambios } : fila,
      ),
    )
    setErrores((actuales) => ({ ...actuales, [`alumno-${clave}`]: undefined }))
  }

  function agregarFila() {
    setFilas((actuales) => [
      ...actuales,
      {
        clave: siguienteClave.current++,
        alumnoId: '',
        estado: 'PRESENTE',
        observacion: '',
      },
    ])
  }

  function quitarFila(clave: number) {
    setFilas((actuales) =>
      actuales.length > 1
        ? actuales.filter((fila) => fila.clave !== clave)
        : actuales,
    )
  }

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setErrorGeneral(null)

    const erroresCampos: Record<string, string | undefined> = {}

    if (seccionId.trim().length === 0) {
      erroresCampos.seccionId = 'La sección es obligatoria.'
    } else if (!uuidSchema.safeParse(seccionId).success) {
      erroresCampos.seccionId =
        'El identificador de la sección no es válido.'
    }

    const validacionFecha = fechaEscolarSchema.safeParse(fecha)

    if (!validacionFecha.success) {
      erroresCampos.fecha =
        validacionFecha.error.issues[0]?.message ?? 'La fecha no es válida.'
    }

    for (const fila of filas) {
      if (fila.alumnoId.trim().length === 0) {
        erroresCampos[`alumno-${fila.clave}`] = 'El alumno es obligatorio.'
      } else if (!uuidSchema.safeParse(fila.alumnoId).success) {
        erroresCampos[`alumno-${fila.clave}`] =
          'El identificador del alumno no es válido.'
      }
    }

    if (Object.keys(erroresCampos).length > 0) {
      setErrores(erroresCampos)
      return
    }

    const validacion = registrarAsistenciaLoteSchema.safeParse({
      seccionId,
      fecha,
      registros: filas.map((fila) => ({
        alumnoId: fila.alumnoId,
        estado: fila.estado,
        ...(fila.observacion.trim().length > 0
          ? { observacion: fila.observacion }
          : {}),
      })),
    })

    if (!validacion.success) {
      setErrores({})
      setErrorGeneral(validacion.error.issues.map((issue) => issue.message).join(' '))
      return
    }

    setErrores({})
    setEnviando(true)

    try {
      const resultado = await registrarAsistenciaLote(validacion.data)
      const total = resultado.registros.length
      onExito(
        total === 1
          ? 'Asistencia registrada para 1 alumno.'
          : `Asistencia registrada para ${total} alumnos.`,
      )
    } catch (error) {
      setErrorGeneral(mensajeError(error))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form
      aria-labelledby="asistencia-lote-title"
      className="space-y-4"
      noValidate
      onSubmit={enviar}
    >
      {errorGeneral ? (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {errorGeneral}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="lote-seccion"
            className="block text-sm font-medium text-slate-700"
          >
            Sección de la asistencia
          </label>
          <input
            id="lote-seccion"
            name="seccionId"
            type="text"
            autoFocus
            value={seccionId}
            onChange={(evento: ChangeEvent<HTMLInputElement>) => {
              setSeccionId(evento.target.value)
              setErrores((actuales) => ({
                ...actuales,
                seccionId: undefined,
              }))
            }}
            aria-invalid={Boolean(errores.seccionId)}
            aria-describedby={
              errores.seccionId ? 'lote-seccion-error' : undefined
            }
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          />
          {errores.seccionId ? (
            <p
              id="lote-seccion-error"
              role="alert"
              className="mt-1 text-sm text-red-700"
            >
              {errores.seccionId}
            </p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor="lote-fecha"
            className="block text-sm font-medium text-slate-700"
          >
            Fecha de la asistencia
          </label>
          <input
            id="lote-fecha"
            name="fecha"
            type="date"
            value={fecha}
            onChange={(evento: ChangeEvent<HTMLInputElement>) => {
              setFecha(evento.target.value)
              setErrores((actuales) => ({ ...actuales, fecha: undefined }))
            }}
            aria-invalid={Boolean(errores.fecha)}
            aria-describedby={errores.fecha ? 'lote-fecha-error' : undefined}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          />
          {errores.fecha ? (
            <p
              id="lote-fecha-error"
              role="alert"
              className="mt-1 text-sm text-red-700"
            >
              {errores.fecha}
            </p>
          ) : null}
        </div>
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-slate-700">
          Registros de asistencia
        </legend>

        {filas.map((fila, indice) => {
          const sufijo = fila.clave
          const etiquetaAlumno = `Alumno ${indice + 1}`
          const etiquetaEstado = `Estado ${indice + 1}`
          const etiquetaObservacion = `Observación ${indice + 1}`

          return (
            <div
              key={sufijo}
              className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2"
            >
              <div>
                <label
                  htmlFor={`lote-alumno-${sufijo}`}
                  className="block text-sm font-medium text-slate-700"
                >
                  {etiquetaAlumno}
                </label>
                <input
                  id={`lote-alumno-${sufijo}`}
                  name={`alumnoId-${sufijo}`}
                  type="text"
                  value={fila.alumnoId}
                  onChange={(evento) =>
                    cambiarFila(sufijo, { alumnoId: evento.target.value })
                  }
                  aria-invalid={Boolean(errores[`alumno-${sufijo}`])}
                  aria-describedby={
                    errores[`alumno-${sufijo}`]
                      ? `lote-alumno-${sufijo}-error`
                      : undefined
                  }
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                />
                {errores[`alumno-${sufijo}`] ? (
                  <p
                    id={`lote-alumno-${sufijo}-error`}
                    role="alert"
                    className="mt-1 text-sm text-red-700"
                  >
                    {errores[`alumno-${sufijo}`]}
                  </p>
                ) : null}
              </div>

              <div>
                <label
                  htmlFor={`lote-estado-${sufijo}`}
                  className="block text-sm font-medium text-slate-700"
                >
                  {etiquetaEstado}
                </label>
                <select
                  id={`lote-estado-${sufijo}`}
                  name={`estado-${sufijo}`}
                  value={fila.estado}
                  onChange={(evento) => {
                    const estado = estadoAsistenciaSchema.safeParse(
                      evento.target.value,
                    )

                    if (estado.success) {
                      cambiarFila(sufijo, { estado: estado.data })
                    }
                  }}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                >
                  {ESTADOS.map((estado) => (
                    <option key={estado} value={estado}>
                      {estado}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label
                  htmlFor={`lote-observacion-${sufijo}`}
                  className="block text-sm font-medium text-slate-700"
                >
                  {etiquetaObservacion} (opcional)
                </label>
                <textarea
                  id={`lote-observacion-${sufijo}`}
                  name={`observacion-${sufijo}`}
                  rows={2}
                  value={fila.observacion}
                  onChange={(evento) =>
                    cambiarFila(sufijo, { observacion: evento.target.value })
                  }
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                />
              </div>

              <div className="sm:col-span-2">
                <button
                  type="button"
                  disabled={filas.length === 1}
                  onClick={() => quitarFila(sufijo)}
                  className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Quitar {etiquetaAlumno.toLowerCase()}
                </button>
              </div>
            </div>
          )
        })}
      </fieldset>

      <button
        type="button"
        onClick={agregarFila}
        className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
      >
        Agregar alumno
      </button>

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={enviando}
          className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {enviando ? 'Guardando…' : 'Registrar asistencia'}
        </button>
        <button
          type="button"
          onClick={onCancelar}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}
