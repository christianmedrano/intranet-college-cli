import type {
  CalificacionResponse,
  NotaFinalResponse,
} from '@intranet/shared'
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import { useSearchParams } from 'react-router'
import { useAuth } from '../../auth/useAuth'
import { CalificacionForm, type ModoCalificacion } from './CalificacionForm'
import { listarCalificaciones, listarNotasFinales } from './api'
import { mensajeError } from './formato'
import { NotaFinalForm, type ModoNotaFinal } from './NotaFinalForm'

type Accion =
  | { tipo: 'crear-calificacion' }
  | { tipo: 'editar-calificacion'; registro: CalificacionResponse }
  | { tipo: 'corregir-calificacion'; registro: CalificacionResponse }
  | { tipo: 'crear-nota' }
  | { tipo: 'editar-nota'; registro: NotaFinalResponse }
  | { tipo: 'corregir-nota'; registro: NotaFinalResponse }
  | null

function modoCalificacion(accion: Accion): ModoCalificacion | null {
  if (accion?.tipo === 'crear-calificacion') return 'crear'
  if (accion?.tipo === 'editar-calificacion') return 'editar'
  if (accion?.tipo === 'corregir-calificacion') return 'corregir'

  return null
}

function modoNotaFinal(accion: Accion): ModoNotaFinal | null {
  if (accion?.tipo === 'crear-nota') return 'crear'
  if (accion?.tipo === 'editar-nota') return 'editar'
  if (accion?.tipo === 'corregir-nota') return 'corregir'

  return null
}

function registroCalificacion(accion: Accion): CalificacionResponse | undefined {
  if (
    accion?.tipo === 'editar-calificacion' ||
    accion?.tipo === 'corregir-calificacion'
  ) {
    return accion.registro
  }

  return undefined
}

function registroNotaFinal(accion: Accion): NotaFinalResponse | undefined {
  if (accion?.tipo === 'editar-nota' || accion?.tipo === 'corregir-nota') {
    return accion.registro
  }

  return undefined
}

/**
 * Pantalla de calificaciones y notas finales (RF-ACAD-001, RF-ACAD-002).
 *
 * Consulta los dos listados del período indicado en `?periodoId=`. El docente
 * registra y edita; el Director corrige con motivo; el apoderado y el alumno
 * solo consultan. Las acciones se ocultan sin permiso, pero el backend siempre
 * revalida (RF-ACAD-003).
 */
export function CalificacionesPage() {
  const { usuario } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const periodoId = searchParams.get('periodoId')

  const [errorPeriodo, setErrorPeriodo] = useState<string | undefined>()
  const [calificaciones, setCalificaciones] = useState<CalificacionResponse[]>(
    [],
  )
  const [notasFinales, setNotasFinales] = useState<NotaFinalResponse[]>([])
  const [resultado, setResultado] = useState<{
    periodoId: string
    error: string | null
  } | null>(null)
  const [mensajeExito, setMensajeExito] = useState<string | null>(null)
  const [accion, setAccion] = useState<Accion>(null)
  const [recarga, setRecarga] = useState(0)
  const refExito = useRef<HTMLParagraphElement>(null)
  const refPeriodo = useRef<HTMLInputElement>(null)

  const cargando = Boolean(periodoId) && resultado?.periodoId !== periodoId
  const errorCarga =
    resultado?.periodoId === periodoId ? resultado.error : null

  const permisos = usuario?.permissions ?? []
  const puedeLeer = permisos.includes('academic.calificaciones.leer')
  const puedeGestionar = permisos.includes(
    'academic.calificaciones.gestionar',
  )
  const puedeCorregir = permisos.includes('academic.calificaciones.corregir')

  useEffect(() => {
    if (!periodoId) return

    let activo = true

    Promise.all([
      listarCalificaciones(periodoId),
      listarNotasFinales(periodoId),
    ])
      .then(([listaCalificaciones, listaNotas]) => {
        if (!activo) return

        setCalificaciones(listaCalificaciones.data)
        setNotasFinales(listaNotas.data)
        setResultado({ periodoId, error: null })
      })
      .catch((error: unknown) => {
        if (activo) setResultado({ periodoId, error: mensajeError(error) })
      })

    return () => {
      activo = false
    }
  }, [periodoId, recarga])

  useEffect(() => {
    if (mensajeExito) refExito.current?.focus()
  }, [mensajeExito])

  function consultarPeriodo(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const valor = refPeriodo.current?.value.trim() ?? ''

    if (valor.length === 0) {
      setErrorPeriodo('Indica el identificador del período.')
      return
    }

    const siguientes = new URLSearchParams(searchParams)
    siguientes.set('periodoId', valor)
    setSearchParams(siguientes)
    setAccion(null)
    setMensajeExito(null)
  }

  function abrir(nueva: Accion) {
    setMensajeExito(null)
    setAccion(nueva)
  }

  function alExito(mensaje: string) {
    setAccion(null)
    setMensajeExito(mensaje)
    setRecarga((actual) => actual + 1)
  }

  const modoCal = modoCalificacion(accion)
  const modoNota = modoNotaFinal(accion)
  const calificacionEditable = registroCalificacion(accion)
  const notaEditable = registroNotaFinal(accion)

  const tituloFormularioCalificacion =
    modoCal === 'crear'
      ? 'Registrar calificación'
      : modoCal === 'editar'
        ? 'Editar calificación'
        : 'Corregir calificación'

  const tituloFormularioNota =
    modoNota === 'crear'
      ? 'Registrar nota final'
      : modoNota === 'editar'
        ? 'Editar nota final'
        : 'Corregir nota final'

  return (
    <section aria-labelledby="calificaciones-title" className="space-y-6">
      <div>
        <h1 id="calificaciones-title" className="text-2xl font-semibold">
          Calificaciones
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Registro literal AD, A, B o C por curso y período. La nota final se
          registra de forma manual.
        </p>
      </div>

      <form
        aria-label="Consultar período académico"
        className="rounded-md border border-slate-200 bg-white p-4"
        noValidate
        onSubmit={consultarPeriodo}
      >
        <label
          htmlFor="periodo-id"
          className="block text-sm font-medium text-slate-700"
        >
          Identificador del período
        </label>
        <div className="mt-1 flex flex-wrap gap-2">
          <input
            id="periodo-id"
            key={periodoId ?? 'sin-periodo'}
            ref={refPeriodo}
            name="periodoId"
            type="text"
            defaultValue={periodoId ?? ''}
            onChange={() => setErrorPeriodo(undefined)}
            aria-invalid={Boolean(errorPeriodo)}
            aria-describedby={
              errorPeriodo ? 'periodo-id-error' : 'periodo-id-hint'
            }
            className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          />
          <button
            type="submit"
            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          >
            Consultar
          </button>
        </div>
        {errorPeriodo ? (
          <p id="periodo-id-error" role="alert" className="mt-1 text-sm text-red-700">
            {errorPeriodo}
          </p>
        ) : (
          <p id="periodo-id-hint" className="mt-1 text-sm text-slate-500">
            Corresponde al período académico que deseas consultar.
          </p>
        )}
      </form>

      {!puedeLeer ? (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          No tienes permiso para consultar calificaciones.
        </div>
      ) : null}

      {mensajeExito ? (
        <p
          ref={refExito}
          role="status"
          tabIndex={-1}
          className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800"
        >
          {mensajeExito}
        </p>
      ) : null}

      {!periodoId ? (
        <p className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
          Indica el período académico para consultar las calificaciones.
        </p>
      ) : null}

      {periodoId && cargando ? (
        <p role="status" className="text-sm text-slate-600">
          Cargando calificaciones…
        </p>
      ) : null}

      {periodoId && errorCarga ? (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {errorCarga}
        </div>
      ) : null}

      {periodoId && !cargando && !errorCarga && puedeLeer ? (
        <>
          <section aria-labelledby="lista-calificaciones-title">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2
                id="lista-calificaciones-title"
                className="text-xl font-semibold"
              >
                Calificaciones del período
              </h2>
              {puedeGestionar && !modoCal ? (
                <button
                  type="button"
                  onClick={() => abrir({ tipo: 'crear-calificacion' })}
                  className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                >
                  Nueva calificación
                </button>
              ) : null}
            </div>

            {modoCal ? (
              <div className="mt-3 rounded-md border border-slate-200 bg-white p-4">
                <h3 id="calificacion-form-title" className="text-lg font-medium">
                  {tituloFormularioCalificacion}
                </h3>
                <CalificacionForm
                  periodoId={periodoId}
                  modo={modoCal}
                  {...(calificacionEditable
                    ? { registro: calificacionEditable }
                    : {})}
                  tituloId="calificacion-form-title"
                  onExito={alExito}
                  onCancelar={() => setAccion(null)}
                />
              </div>
            ) : null}

            {calificaciones.length === 0 ? (
              <p className="mt-3 text-sm text-slate-600">
                No hay calificaciones registradas en este período.
              </p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <caption className="sr-only">
                    Calificaciones registradas en el período
                  </caption>
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th scope="col" className="px-2 py-2 font-medium">
                        Alumno
                      </th>
                      <th scope="col" className="px-2 py-2 font-medium">
                        Curso
                      </th>
                      <th scope="col" className="px-2 py-2 font-medium">
                        Valor
                      </th>
                      <th scope="col" className="px-2 py-2 font-medium">
                        Observación
                      </th>
                      <th scope="col" className="px-2 py-2 font-medium">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {calificaciones.map((fila) => (
                      <tr key={fila.id} className="border-b border-slate-100">
                        <th scope="row" className="px-2 py-2 font-normal">
                          <code className="break-all text-xs">{fila.alumnoId}</code>
                        </th>
                        <td className="px-2 py-2">
                          <code className="break-all text-xs">{fila.cursoId}</code>
                        </td>
                        <td className="px-2 py-2 font-medium">{fila.valor}</td>
                        <td className="px-2 py-2">{fila.observacion ?? '—'}</td>
                        <td className="px-2 py-2">
                          <div className="flex flex-wrap gap-2">
                            {puedeGestionar ? (
                              <button
                                type="button"
                                onClick={() =>
                                  abrir({
                                    tipo: 'editar-calificacion',
                                    registro: fila,
                                  })
                                }
                                aria-label={`Editar la calificación ${fila.valor} del alumno ${fila.alumnoId}`}
                                className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                              >
                                Editar
                              </button>
                            ) : null}
                            {puedeCorregir ? (
                              <button
                                type="button"
                                onClick={() =>
                                  abrir({
                                    tipo: 'corregir-calificacion',
                                    registro: fila,
                                  })
                                }
                                aria-label={`Corregir la calificación ${fila.valor} del alumno ${fila.alumnoId}`}
                                className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                              >
                                Corregir
                              </button>
                            ) : null}
                            {!puedeGestionar && !puedeCorregir ? (
                              <span className="text-xs text-slate-500">
                                Solo consulta
                              </span>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section aria-labelledby="lista-notas-title">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="lista-notas-title" className="text-xl font-semibold">
                Notas finales del período
              </h2>
              {puedeGestionar && !modoNota ? (
                <button
                  type="button"
                  onClick={() => abrir({ tipo: 'crear-nota' })}
                  className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                >
                  Nueva nota final
                </button>
              ) : null}
            </div>

            {modoNota ? (
              <div className="mt-3 rounded-md border border-slate-200 bg-white p-4">
                <h3 id="nota-form-title" className="text-lg font-medium">
                  {tituloFormularioNota}
                </h3>
                <NotaFinalForm
                  periodoId={periodoId}
                  modo={modoNota}
                  {...(notaEditable ? { registro: notaEditable } : {})}
                  tituloId="nota-form-title"
                  onExito={alExito}
                  onCancelar={() => setAccion(null)}
                />
              </div>
            ) : null}

            {notasFinales.length === 0 ? (
              <p className="mt-3 text-sm text-slate-600">
                No hay notas finales registradas en este período.
              </p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <caption className="sr-only">
                    Notas finales registradas en el período
                  </caption>
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th scope="col" className="px-2 py-2 font-medium">
                        Alumno
                      </th>
                      <th scope="col" className="px-2 py-2 font-medium">
                        Curso
                      </th>
                      <th scope="col" className="px-2 py-2 font-medium">
                        Valor
                      </th>
                      <th scope="col" className="px-2 py-2 font-medium">
                        Observación
                      </th>
                      <th scope="col" className="px-2 py-2 font-medium">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {notasFinales.map((fila) => (
                      <tr key={fila.id} className="border-b border-slate-100">
                        <th scope="row" className="px-2 py-2 font-normal">
                          <code className="break-all text-xs">{fila.alumnoId}</code>
                        </th>
                        <td className="px-2 py-2">
                          <code className="break-all text-xs">{fila.cursoId}</code>
                        </td>
                        <td className="px-2 py-2 font-medium">{fila.valor}</td>
                        <td className="px-2 py-2">{fila.observacion ?? '—'}</td>
                        <td className="px-2 py-2">
                          <div className="flex flex-wrap gap-2">
                            {puedeGestionar ? (
                              <button
                                type="button"
                                onClick={() =>
                                  abrir({ tipo: 'editar-nota', registro: fila })
                                }
                                aria-label={`Editar la nota final ${fila.valor} del alumno ${fila.alumnoId}`}
                                className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                              >
                                Editar
                              </button>
                            ) : null}
                            {puedeCorregir ? (
                              <button
                                type="button"
                                onClick={() =>
                                  abrir({
                                    tipo: 'corregir-nota',
                                    registro: fila,
                                  })
                                }
                                aria-label={`Corregir la nota final ${fila.valor} del alumno ${fila.alumnoId}`}
                                className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                              >
                                Corregir
                              </button>
                            ) : null}
                            {!puedeGestionar && !puedeCorregir ? (
                              <span className="text-xs text-slate-500">
                                Solo consulta
                              </span>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}
    </section>
  )
}
