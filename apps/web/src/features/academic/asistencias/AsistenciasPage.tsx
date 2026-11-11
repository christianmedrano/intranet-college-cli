import type {
  AsistenciaResponse,
  JustificacionResponse,
} from '@intranet/shared'
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import { useAuth } from '../../auth/useAuth'
import {
  etiquetaEstadoAsistencia,
  etiquetaEstadoJustificacion,
  mensajeError,
} from '../shared/formato'
import { AsistenciaLoteForm } from './AsistenciaLoteForm'
import { CorregirAsistenciaForm } from './CorregirAsistenciaForm'
import {
  JustificacionForm,
  RechazoJustificacionForm,
} from './JustificacionForm'
import {
  aprobarJustificacion,
  listarAsistencias,
  listarJustificaciones,
} from './api'

type Accion =
  | { tipo: 'lote' }
  | { tipo: 'corregir'; asistencia: AsistenciaResponse }
  | { tipo: 'solicitar'; asistencia: AsistenciaResponse }
  | { tipo: 'rechazar'; justificacion: JustificacionResponse }
  | null

interface FiltrosFormulario {
  anioId: string
  seccionId: string
  desde: string
  hasta: string
}

/**
 * Pantalla de asistencias y justificaciones (RF-ACAD-004 a RF-ACAD-007).
 *
 * El Director y el docente registran el lote y corrigen con motivo; el
 * apoderado solicita la justificación de una falta; el tutor o Director la
 * aprueba o rechaza. El alumno y el apoderado solo consultan. El backend
 * revalida siempre el vínculo y los permisos.
 */
export function AsistenciasPage() {
  const { usuario } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  const anioId = searchParams.get('anioId')?.trim() ?? ''
  const seccionId = searchParams.get('seccionId')?.trim() ?? ''
  const desde = searchParams.get('desde')?.trim() ?? ''
  const hasta = searchParams.get('hasta')?.trim() ?? ''
  const clave = [anioId, seccionId, desde, hasta].join('|')

  const [borrador, setBorrador] = useState<FiltrosFormulario>({
    anioId,
    seccionId,
    desde,
    hasta,
  })
  const [asistencias, setAsistencias] = useState<AsistenciaResponse[]>([])
  const [justificaciones, setJustificaciones] = useState<
    JustificacionResponse[]
  >([])
  const [resultado, setResultado] = useState<{
    clave: string
    error: string | null
  } | null>(null)
  const [mensajeExito, setMensajeExito] = useState<string | null>(null)
  const [errorAccion, setErrorAccion] = useState<string | null>(null)
  const [accion, setAccion] = useState<Accion>(null)
  const [recarga, setRecarga] = useState(0)
  const refExito = useRef<HTMLParagraphElement>(null)

  const permisos = usuario?.permissions ?? []
  const puedeLeer = permisos.includes('academic.asistencias.leer')
  const puedeGestionar = permisos.includes('academic.asistencias.gestionar')
  const puedeSolicitar = permisos.includes('academic.asistencias.solicitar')
  const puedeJustificar = permisos.includes('academic.asistencias.justificar')

  const cargando = puedeLeer && resultado?.clave !== clave
  const errorCarga = resultado?.clave === clave ? resultado.error : null

  useEffect(() => {
    if (!puedeLeer) return

    let activo = true

    Promise.all([
      listarAsistencias({
        ...(anioId ? { anioId } : {}),
        ...(seccionId ? { seccionId } : {}),
        ...(desde ? { desde } : {}),
        ...(hasta ? { hasta } : {}),
      }),
      listarJustificaciones({
        ...(seccionId ? { seccionId } : {}),
      }),
    ])
      .then(([listaAsistencias, listaJustificaciones]) => {
        if (!activo) return

        setAsistencias(listaAsistencias.data)
        setJustificaciones(listaJustificaciones.data)
        setResultado({ clave, error: null })
      })
      .catch((error: unknown) => {
        if (activo) setResultado({ clave, error: mensajeError(error) })
      })

    return () => {
      activo = false
    }
  }, [anioId, seccionId, desde, hasta, clave, recarga, puedeLeer])

  useEffect(() => {
    if (mensajeExito) refExito.current?.focus()
  }, [mensajeExito])

  function cambiarFiltro(evento: ChangeEvent<HTMLInputElement>) {
    const { name, value } = evento.target

    setBorrador((actuales) => ({ ...actuales, [name]: value }))
  }

  function consultar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()

    const siguientes = new URLSearchParams()

    for (const campo of ['anioId', 'seccionId', 'desde', 'hasta'] as const) {
      const valor = borrador[campo].trim()

      if (valor.length > 0) siguientes.set(campo, valor)
    }

    setSearchParams(siguientes)
    setAccion(null)
    setMensajeExito(null)
    setErrorAccion(null)
  }

  function abrir(nueva: Accion) {
    setMensajeExito(null)
    setErrorAccion(null)
    setAccion(nueva)
  }

  function alExito(mensaje: string) {
    setAccion(null)
    setMensajeExito(mensaje)
    setRecarga((actual) => actual + 1)
  }

  async function aprobar(justificacion: JustificacionResponse) {
    setMensajeExito(null)
    setErrorAccion(null)

    try {
      await aprobarJustificacion(justificacion.id)
      alExito('Justificación aprobada.')
    } catch (error) {
      setErrorAccion(mensajeError(error))
    }
  }

  const accionAsistencia =
    accion?.tipo === 'lote' ||
    accion?.tipo === 'corregir' ||
    accion?.tipo === 'solicitar'

  return (
    <section aria-labelledby="asistencias-title" className="space-y-6">
      <div>
        <h1 id="asistencias-title" className="text-2xl font-semibold">
          Asistencias y justificaciones
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Registro diario por sección, corrección con motivo y justificación de
          faltas injustificadas.
        </p>
      </div>

      <form
        aria-label="Filtrar asistencias"
        className="rounded-md border border-slate-200 bg-white p-4"
        noValidate
        onSubmit={consultar}
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label
              htmlFor="filtro-anio"
              className="block text-sm font-medium text-slate-700"
            >
              Año académico
            </label>
            <input
              id="filtro-anio"
              name="anioId"
              type="text"
              value={borrador.anioId}
              onChange={cambiarFiltro}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            />
          </div>

          <div>
            <label
              htmlFor="filtro-seccion"
              className="block text-sm font-medium text-slate-700"
            >
              Sección
            </label>
            <input
              id="filtro-seccion"
              name="seccionId"
              type="text"
              value={borrador.seccionId}
              onChange={cambiarFiltro}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            />
          </div>

          <div>
            <label
              htmlFor="filtro-desde"
              className="block text-sm font-medium text-slate-700"
            >
              Desde
            </label>
            <input
              id="filtro-desde"
              name="desde"
              type="date"
              value={borrador.desde}
              onChange={cambiarFiltro}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            />
          </div>

          <div>
            <label
              htmlFor="filtro-hasta"
              className="block text-sm font-medium text-slate-700"
            >
              Hasta
            </label>
            <input
              id="filtro-hasta"
              name="hasta"
              type="date"
              value={borrador.hasta}
              onChange={cambiarFiltro}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            />
          </div>
        </div>

        <button
          type="submit"
          className="mt-4 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        >
          Consultar
        </button>
      </form>

      {!puedeLeer ? (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          No tienes permiso para consultar asistencias.
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

      {errorAccion ? (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {errorAccion}
        </div>
      ) : null}

      {puedeLeer && cargando ? (
        <p role="status" className="text-sm text-slate-600">
          Cargando asistencias…
        </p>
      ) : null}

      {puedeLeer && errorCarga ? (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {errorCarga}
        </div>
      ) : null}

      {puedeLeer && !cargando && !errorCarga ? (
        <>
          <section aria-labelledby="lista-asistencias-title">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="lista-asistencias-title" className="text-xl font-semibold">
                Asistencias
              </h2>
              {puedeGestionar && !accionAsistencia ? (
                <button
                  type="button"
                  onClick={() => abrir({ tipo: 'lote' })}
                  className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                >
                  Registrar asistencia
                </button>
              ) : null}
            </div>

            {accion?.tipo === 'lote' ? (
              <div className="mt-3 rounded-md border border-slate-200 bg-white p-4">
                <h3 id="asistencia-lote-title" className="text-lg font-medium">
                  Registrar asistencia
                </h3>
                <AsistenciaLoteForm
                  {...(seccionId ? { seccionInicial: seccionId } : {})}
                  onExito={alExito}
                  onCancelar={() => setAccion(null)}
                />
              </div>
            ) : null}

            {accion?.tipo === 'corregir' ? (
              <div className="mt-3 rounded-md border border-slate-200 bg-white p-4">
                <h3
                  id="corregir-asistencia-title"
                  className="text-lg font-medium"
                >
                  Corregir asistencia
                </h3>
                <CorregirAsistenciaForm
                  asistencia={accion.asistencia}
                  onExito={alExito}
                  onCancelar={() => setAccion(null)}
                />
              </div>
            ) : null}

            {accion?.tipo === 'solicitar' ? (
              <div className="mt-3 rounded-md border border-slate-200 bg-white p-4">
                <h3
                  id="solicitar-justificacion-title"
                  className="text-lg font-medium"
                >
                  Solicitar justificación
                </h3>
                <JustificacionForm
                  asistencia={accion.asistencia}
                  onExito={alExito}
                  onCancelar={() => setAccion(null)}
                />
              </div>
            ) : null}

            {asistencias.length === 0 ? (
              <p className="mt-3 text-sm text-slate-600">
                No hay asistencias registradas con estos filtros.
              </p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <caption className="sr-only">
                    Asistencias registradas con los filtros aplicados
                  </caption>
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th scope="col" className="px-2 py-2 font-medium">
                        Alumno
                      </th>
                      <th scope="col" className="px-2 py-2 font-medium">
                        Fecha
                      </th>
                      <th scope="col" className="px-2 py-2 font-medium">
                        Estado
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
                    {asistencias.map((fila) => {
                      const puedeSolicitarEstaFila =
                        puedeSolicitar &&
                        fila.estado === 'FALTA_INJUSTIFICADA'

                      return (
                        <tr key={fila.id} className="border-b border-slate-100">
                          <th scope="row" className="px-2 py-2 font-normal">
                            <code className="break-all text-xs">
                              {fila.alumnoId}
                            </code>
                          </th>
                          <td className="px-2 py-2">{fila.fecha}</td>
                          <td className="px-2 py-2">
                            {etiquetaEstadoAsistencia(fila.estado)}
                          </td>
                          <td className="px-2 py-2">
                            {fila.observacion ?? '—'}
                          </td>
                          <td className="px-2 py-2">
                            <div className="flex flex-wrap gap-2">
                              {puedeGestionar ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    abrir({ tipo: 'corregir', asistencia: fila })
                                  }
                                  aria-label={`Corregir la asistencia del alumno ${fila.alumnoId} del ${fila.fecha}`}
                                  className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                                >
                                  Corregir
                                </button>
                              ) : null}
                              {puedeSolicitarEstaFila ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    abrir({
                                      tipo: 'solicitar',
                                      asistencia: fila,
                                    })
                                  }
                                  aria-label={`Solicitar justificación de la falta del alumno ${fila.alumnoId} del ${fila.fecha}`}
                                  className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                                >
                                  Solicitar justificación
                                </button>
                              ) : null}
                              {!puedeGestionar && !puedeSolicitarEstaFila ? (
                                <span className="text-xs text-slate-500">
                                  Solo consulta
                                </span>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section aria-labelledby="lista-justificaciones-title">
            <h2
              id="lista-justificaciones-title"
              className="text-xl font-semibold"
            >
              Justificaciones
            </h2>

            {accion?.tipo === 'rechazar' ? (
              <div className="mt-3 rounded-md border border-slate-200 bg-white p-4">
                <h3
                  id="rechazar-justificacion-title"
                  className="text-lg font-medium"
                >
                  Rechazar justificación
                </h3>
                <RechazoJustificacionForm
                  justificacion={accion.justificacion}
                  onExito={alExito}
                  onCancelar={() => setAccion(null)}
                />
              </div>
            ) : null}

            {justificaciones.length === 0 ? (
              <p className="mt-3 text-sm text-slate-600">
                No hay justificaciones registradas.
              </p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <caption className="sr-only">
                    Justificaciones registradas con los filtros aplicados
                  </caption>
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th scope="col" className="px-2 py-2 font-medium">
                        Asistencia
                      </th>
                      <th scope="col" className="px-2 py-2 font-medium">
                        Motivo
                      </th>
                      <th scope="col" className="px-2 py-2 font-medium">
                        Estado
                      </th>
                      <th scope="col" className="px-2 py-2 font-medium">
                        Resolución
                      </th>
                      <th scope="col" className="px-2 py-2 font-medium">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {justificaciones.map((fila) => (
                      <tr key={fila.id} className="border-b border-slate-100">
                        <th scope="row" className="px-2 py-2 font-normal">
                          <code className="break-all text-xs">
                            {fila.asistenciaId}
                          </code>
                        </th>
                        <td className="px-2 py-2">{fila.motivo}</td>
                        <td className="px-2 py-2">
                          {etiquetaEstadoJustificacion(fila.estado)}
                        </td>
                        <td className="px-2 py-2">
                          {fila.motivoResolucion ?? '—'}
                        </td>
                        <td className="px-2 py-2">
                          <div className="flex flex-wrap gap-2">
                            {puedeJustificar &&
                            fila.estado === 'SOLICITADA' ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => void aprobar(fila)}
                                  aria-label={`Aprobar la justificación ${fila.id}`}
                                  className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                                >
                                  Aprobar
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    abrir({ tipo: 'rechazar', justificacion: fila })
                                  }
                                  aria-label={`Rechazar la justificación ${fila.id}`}
                                  className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                                >
                                  Rechazar
                                </button>
                              </>
                            ) : (
                              <span className="text-xs text-slate-500">
                                Sin acciones
                              </span>
                            )}
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
