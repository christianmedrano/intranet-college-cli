import { umbralAsistenciaSchema } from '@intranet/shared'
import { useEffect, useState, type FormEvent } from 'react'
import { mensajeError } from '../shared/formato'
import { guardarUmbral, obtenerUmbral } from './api'

interface UmbralFormProps {
  anioId: string
  onExito: (mensaje: string) => void
  onCancelar: () => void
}

/**
 * Formulario para configurar el umbral de inasistencias (RF-ACAD-008).
 *
 * Solo accesible para Director y SuperAdmin (permiso core.estructura.gestionar).
 * Devuelve null cuando el año no tiene umbral configurado.
 */
export function UmbralForm({ anioId, onExito, onCancelar }: UmbralFormProps) {
  const [valor, setValor] = useState<string>('')
  const [error, setError] = useState<string | undefined>()
  const [resultado, setResultado] = useState<{
    anioId: string
    error: string | null
  } | null>(null)
  const [recarga, setRecarga] = useState(0)

  const cargando = resultado?.anioId !== anioId
  const errorCarga = resultado?.anioId === anioId ? resultado.error : null

  // Cargar valor actual al montar o cuando cambia anioId
  useEffect(() => {
    if (!anioId) return

    let activo = true

    obtenerUmbral(anioId)
      .then((respuesta) => {
        if (!activo) return
        if (respuesta.faltasParaAlerta !== null) {
          setValor(String(respuesta.faltasParaAlerta))
        }
        setResultado({ anioId, error: null })
      })
      .catch((errorCarga: unknown) => {
        if (activo) setResultado({ anioId, error: mensajeError(errorCarga) })
      })

    return () => {
      activo = false
    }
  }, [anioId, recarga])

  function recargar() {
    setRecarga((c) => c + 1)
  }

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()

    const validacion = umbralAsistenciaSchema.safeParse({
      faltasParaAlerta: Number(valor),
    })

    if (!validacion.success) {
      setError(
        validacion.error.issues[0]?.message ?? 'El umbral debe ser un entero positivo.',
      )
      return
    }

    setError(undefined)

    try {
      await guardarUmbral(anioId, validacion.data)
      onExito('Umbral guardado.')
      recargar()
    } catch (errorGuardar) {
      setError(mensajeError(errorGuardar))
    }
  }

  if (cargando) {
    return (
      <div role="status" className="py-8 text-center text-slate-600">
        Cargando umbral actual…
      </div>
    )
  }

  return (
    <form
      aria-labelledby="umbral-title"
      className="space-y-4"
      noValidate
      onSubmit={enviar}
    >
      {errorCarga ? (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {errorCarga}
        </div>
      ) : null}

      <div>
        <label
          htmlFor="umbral-valor"
          className="block text-sm font-medium text-slate-700"
        >
          Umbral de faltas injustificadas para alerta
        </label>
        <input
          id="umbral-valor"
          name="faltasParaAlerta"
          type="number"
          min="1"
          step="1"
          autoFocus
          value={valor}
          onChange={(evento) => {
            setValor(evento.target.value)
            setError(undefined)
          }}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'umbral-valor-error' : undefined}
          className="mt-1 w-full max-w-xs rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        />
        {error ? (
          <p id="umbral-valor-error" role="alert" className="mt-1 text-sm text-red-700">
            {error}
          </p>
        ) : (
          <p className="mt-1 text-sm text-slate-500">
            Entero positivo. Sin umbral no se generan alertas.
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={valor.trim().length === 0}
          className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Guardar umbral
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