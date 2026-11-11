import {
  crearJustificacionSchema,
  rechazarJustificacionSchema,
  type AsistenciaResponse,
  type JustificacionResponse,
} from '@intranet/shared'
import { useState, type FormEvent } from 'react'
import { mensajeError } from '../shared/formato'
import { rechazarJustificacion, solicitarJustificacion } from './api'

interface JustificacionFormProps {
  asistencia: AsistenciaResponse
  onExito: (mensaje: string) => void
  onCancelar: () => void
}

/**
 * Solicitud de justificación de una falta (RF-ACAD-006).
 *
 * La crea el apoderado vinculado; el backend valida el vínculo y que no exista
 * otra solicitud abierta para la misma asistencia.
 */
export function JustificacionForm({
  asistencia,
  onExito,
  onCancelar,
}: JustificacionFormProps) {
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState<string | undefined>()
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setErrorGeneral(null)

    const validacion = crearJustificacionSchema.safeParse({ motivo })

    if (!validacion.success) {
      setError(
        validacion.error.issues[0]?.message ?? 'El motivo es obligatorio.',
      )
      return
    }

    setError(undefined)
    setEnviando(true)

    try {
      await solicitarJustificacion(asistencia.id, validacion.data)
      onExito('Solicitud de justificación enviada.')
    } catch (errorSolicitud) {
      setErrorGeneral(mensajeError(errorSolicitud))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form
      aria-labelledby="solicitar-justificacion-title"
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

      <div>
        <label
          htmlFor="justificacion-motivo"
          className="block text-sm font-medium text-slate-700"
        >
          Motivo de la solicitud
        </label>
        <textarea
          id="justificacion-motivo"
          name="motivo"
          rows={3}
          autoFocus
          value={motivo}
          onChange={(evento) => {
            setMotivo(evento.target.value)
            setError(undefined)
          }}
          aria-invalid={Boolean(error)}
          aria-describedby={
            error ? 'justificacion-motivo-error' : undefined
          }
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        />
        {error ? (
          <p
            id="justificacion-motivo-error"
            role="alert"
            className="mt-1 text-sm text-red-700"
          >
            {error}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={enviando}
          className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {enviando ? 'Enviando…' : 'Enviar solicitud'}
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

interface RechazoJustificacionFormProps {
  justificacion: JustificacionResponse
  onExito: (mensaje: string) => void
  onCancelar: () => void
}

/**
 * Rechazo de una solicitud de justificación con motivo obligatorio
 * (RF-ACAD-006, RN-ACAD-012).
 */
export function RechazoJustificacionForm({
  justificacion,
  onExito,
  onCancelar,
}: RechazoJustificacionFormProps) {
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState<string | undefined>()
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setErrorGeneral(null)

    const validacion = rechazarJustificacionSchema.safeParse({ motivo })

    if (!validacion.success) {
      setError(
        validacion.error.issues[0]?.message ?? 'El motivo es obligatorio.',
      )
      return
    }

    setError(undefined)
    setEnviando(true)

    try {
      await rechazarJustificacion(justificacion.id, validacion.data)
      onExito('Justificación rechazada.')
    } catch (errorRechazo) {
      setErrorGeneral(mensajeError(errorRechazo))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form
      aria-labelledby="rechazar-justificacion-title"
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

      <div>
        <label
          htmlFor="rechazo-motivo"
          className="block text-sm font-medium text-slate-700"
        >
          Motivo del rechazo
        </label>
        <textarea
          id="rechazo-motivo"
          name="motivo"
          rows={3}
          autoFocus
          value={motivo}
          onChange={(evento) => {
            setMotivo(evento.target.value)
            setError(undefined)
          }}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'rechazo-motivo-error' : undefined}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        />
        {error ? (
          <p
            id="rechazo-motivo-error"
            role="alert"
            className="mt-1 text-sm text-red-700"
          >
            {error}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={enviando}
          className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {enviando ? 'Guardando…' : 'Rechazar justificación'}
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
