import {
  corregirAsistenciaSchema,
  estadoAsistenciaSchema,
  type AsistenciaResponse,
  type EstadoAsistencia,
} from '@intranet/shared'
import { useState, type FormEvent } from 'react'
import { mensajeError } from '../shared/formato'
import { corregirAsistencia } from './api'

/** Estados válidos de una asistencia diaria (RN-ACAD-009). */
const ESTADOS: readonly EstadoAsistencia[] = [
  'PRESENTE',
  'TARDE',
  'FALTA_JUSTIFICADA',
  'FALTA_INJUSTIFICADA',
]

interface CorregirAsistenciaFormProps {
  asistencia: AsistenciaResponse
  onExito: (mensaje: string) => void
  onCancelar: () => void
}

/**
 * Corrección de una asistencia con motivo obligatorio (RF-ACAD-005).
 *
 * El backend audita el estado anterior y el nuevo, y registra solo la
 * presencia del motivo, nunca su texto (RN-ACAD-010).
 */
export function CorregirAsistenciaForm({
  asistencia,
  onExito,
  onCancelar,
}: CorregirAsistenciaFormProps) {
  const [estado, setEstado] = useState<EstadoAsistencia>(asistencia.estado)
  const [observacion, setObservacion] = useState(asistencia.observacion ?? '')
  const [motivo, setMotivo] = useState('')
  const [errores, setErrores] = useState<Record<string, string | undefined>>({})
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setErrorGeneral(null)

    if (motivo.trim().length === 0) {
      setErrores({ motivo: 'El motivo es obligatorio.' })
      return
    }

    const validacion = corregirAsistenciaSchema.safeParse({
      estado,
      ...(observacion.trim().length > 0 ? { observacion } : {}),
      motivo,
    })

    if (!validacion.success) {
      const nuevos: Record<string, string | undefined> = {}

      for (const issue of validacion.error.issues) {
        const campo = issue.path[0]

        if (typeof campo === 'string' && !nuevos[campo]) {
          nuevos[campo] = issue.message
        }
      }

      setErrores(nuevos)
      return
    }

    setErrores({})
    setEnviando(true)

    try {
      await corregirAsistencia(asistencia.id, validacion.data)
      onExito('Asistencia corregida.')
    } catch (error) {
      setErrorGeneral(mensajeError(error))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form
      aria-labelledby="corregir-asistencia-title"
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
          htmlFor="corregir-estado"
          className="block text-sm font-medium text-slate-700"
        >
          Estado
        </label>
        <select
          id="corregir-estado"
          name="estado"
          autoFocus
          value={estado}
          onChange={(evento) => {
            const nuevo = estadoAsistenciaSchema.safeParse(evento.target.value)

            if (nuevo.success) {
              setEstado(nuevo.data)
              setErrores((actuales) => ({ ...actuales, estado: undefined }))
            }
          }}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        >
          {ESTADOS.map((valor) => (
            <option key={valor} value={valor}>
              {valor}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor="corregir-observacion"
          className="block text-sm font-medium text-slate-700"
        >
          Observación (opcional)
        </label>
        <textarea
          id="corregir-observacion"
          name="observacion"
          rows={2}
          value={observacion}
          onChange={(evento) => setObservacion(evento.target.value)}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        />
      </div>

      <div>
        <label
          htmlFor="corregir-motivo"
          className="block text-sm font-medium text-slate-700"
        >
          Motivo de la corrección
        </label>
        <textarea
          id="corregir-motivo"
          name="motivo"
          rows={2}
          value={motivo}
          onChange={(evento) => {
            setMotivo(evento.target.value)
            setErrores((actuales) => ({ ...actuales, motivo: undefined }))
          }}
          aria-invalid={Boolean(errores.motivo)}
          aria-describedby={
            errores.motivo ? 'corregir-motivo-error' : 'corregir-motivo-hint'
          }
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        />
        {errores.motivo ? (
          <p
            id="corregir-motivo-error"
            role="alert"
            className="mt-1 text-sm text-red-700"
          >
            {errores.motivo}
          </p>
        ) : (
          <p id="corregir-motivo-hint" className="mt-1 text-sm text-slate-500">
            La corrección queda auditada; el texto del motivo no se almacena.
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={enviando}
          className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {enviando ? 'Guardando…' : 'Guardar corrección'}
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
