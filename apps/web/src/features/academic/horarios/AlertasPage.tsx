import type { AlertaAsistenciaResponse } from '@intranet/shared'
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import { useAuth } from '../../auth/useAuth'
import { mensajeError } from '../shared/formato'
import { listarAlertas } from './api'

interface FiltrosFormulario {
  anioId: string
  alumnoId: string
}

/**
 * Pantalla de alertas de inasistencias (RF-ACAD-009).
 *
 * Director y SuperAdmin ven todas (el segundo con acceso auditado);
 * docente ve las de sus secciones; apoderado ve las de sus alumnos;
 * alumno ve la propia.
 */
export function AlertasPage() {
  const { usuario } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  const anioId = searchParams.get('anioId')?.trim() ?? ''
  const alumnoId = searchParams.get('alumnoId')?.trim() ?? ''
  const clave = [anioId, alumnoId].join('|')

  const [borrador, setBorrador] = useState<FiltrosFormulario>({
    anioId,
    alumnoId,
  })
  const [alertas, setAlertas] = useState<AlertaAsistenciaResponse[]>([])
  const [resultado, setResultado] = useState<{
    clave: string
    error: string | null
  } | null>(null)
  const [mensajeExito, setMensajeExito] = useState<string | null>(null)
  const refExito = useRef<HTMLParagraphElement>(null)

  const permisos = usuario?.permissions ?? []
  const puedeLeer = permisos.includes('academic.asistencias.leer')

  const cargando = puedeLeer && resultado?.clave !== clave
  const errorCarga = resultado?.clave === clave ? resultado.error : null

  useEffect(() => {
    if (!puedeLeer) return

    let activo = true

    listarAlertas({
      ...(anioId ? { anioId } : {}),
      ...(alumnoId ? { alumnoId } : {}),
    })
      .then((respuesta) => {
        if (!activo) return
        setAlertas(respuesta.data)
        setResultado({ clave, error: null })
      })
      .catch((error: unknown) => {
        if (activo) setResultado({ clave, error: mensajeError(error) })
      })

    return () => {
      activo = false
    }
  }, [anioId, alumnoId, clave, puedeLeer])

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

    for (const campo of ['anioId', 'alumnoId'] as const) {
      const valor = borrador[campo].trim()
      if (valor.length > 0) siguientes.set(campo, valor)
    }

    setSearchParams(siguientes)
    setMensajeExito(null)
  }

  return (
    <section aria-labelledby="alertas-title" className="space-y-6">
      <div>
        <h1 id="alertas-title" className="text-2xl font-semibold">
          Alertas de inasistencias
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Se generan cuando un alumno alcanza el umbral de faltas injustificadas
          configurado para el año académico.
        </p>
      </div>

      <form
        aria-label="Filtrar alertas"
        className="rounded-md border border-slate-200 bg-white p-4"
        noValidate
        onSubmit={consultar}
      >
        <div className="grid gap-4 sm:grid-cols-2">
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
              htmlFor="filtro-alumno"
              className="block text-sm font-medium text-slate-700"
            >
              Alumno
            </label>
            <input
              id="filtro-alumno"
              name="alumnoId"
              type="text"
              value={borrador.alumnoId}
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
          No tienes permiso para consultar alertas.
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

      {puedeLeer && cargando ? (
        <p role="status" className="text-sm text-slate-600">
          Cargando alertas…
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
        <section aria-labelledby="lista-alertas-title">
          <h2 id="lista-alertas-title" className="text-xl font-semibold">
            Alertas
          </h2>

          {alertas.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600">
              No hay alertas registradas con estos filtros.
            </p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <caption className="sr-only">
                  Alertas de inasistencias con los filtros aplicados
                </caption>
                <thead>
                  <tr className="border-b border-slate-200">
                    <th scope="col" className="px-2 py-2 font-medium">
                      Alumno
                    </th>
                    <th scope="col" className="px-2 py-2 font-medium">
                      Año académico
                    </th>
                    <th scope="col" className="px-2 py-2 font-medium">
                      Faltas injustificadas
                    </th>
                    <th scope="col" className="px-2 py-2 font-medium">
                      Umbral
                    </th>
                    <th scope="col" className="px-2 py-2 font-medium">
                      Generada
                    </th>
                    <th scope="col" className="px-2 py-2 font-medium">
                      Actualizada
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {alertas.map((fila) => (
                    <tr key={fila.id} className="border-b border-slate-100">
                      <th scope="row" className="px-2 py-2 font-normal">
                        <code className="break-all text-xs">{fila.alumnoId}</code>
                      </th>
                      <td className="px-2 py-2">
                        <code className="break-all text-xs">{fila.anioId}</code>
                      </td>
                      <td className="px-2 py-2">{fila.faltasInjustificadas}</td>
                      <td className="px-2 py-2">{fila.umbral}</td>
                      <td className="px-2 py-2">{fila.generadaEn}</td>
                      <td className="px-2 py-2">{fila.actualizadaEn}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}
    </section>
  )
}