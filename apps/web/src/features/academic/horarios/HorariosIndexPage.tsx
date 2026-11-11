import { useState } from 'react'
import { AlertasPage } from './AlertasPage'
import { HorariosPage } from './HorariosPage'
import { UmbralForm } from './UmbralForm'
import { useAuth } from '../../auth/useAuth'
import { mensajeError } from '../shared/formato'
import { obtenerUmbral } from './api'

type Pestaña = 'umbral' | 'alertas' | 'horarios'

/**
 * Página principal que agrupa umbral, alertas y horarios (RF-ACAD-008 a RF-ACAD-011).
 *
 * - Umbral: solo Director/SuperAdmin (core.estructura.gestionar).
 * - Alertas: lectura con alcance según rol (academic.asistencias.leer).
 * - Horarios: gestión (academic.horarios.gestionar) y lectura (academic.horarios.leer).
 */
export function HorariosIndexPage() {
  const { usuario } = useAuth()
  const [pestañaActiva, setPestañaActiva] = useState<Pestaña>('horarios')
  const [anioIdUmbral, setAnioIdUmbral] = useState('')
  const [umbralActual, setUmbralActual] = useState<{ anioId: string; faltasParaAlerta: number | null } | null>(null)
  const [cargandoUmbral, setCargandoUmbral] = useState(false)
  const [errorUmbral, setErrorUmbral] = useState<string | null>(null)

  const permisos = usuario?.permissions ?? []
  const puedeUmbral = permisos.includes('core.estructura.gestionar')
  const puedeAlertas = permisos.includes('academic.asistencias.leer')
  const puedeHorarios = permisos.includes('academic.horarios.leer')

  // Cargar umbral cuando cambia el año
  const cargarUmbral = async (anioId: string) => {
    if (!anioId.trim()) return
    setCargandoUmbral(true)
    setErrorUmbral(null)
    try {
      const respuesta = await obtenerUmbral(anioId)
      setUmbralActual(respuesta)
    } catch (error) {
      setErrorUmbral(mensajeError(error))
    } finally {
      setCargandoUmbral(false)
    }
  }

  function alGuardarUmbral() {
    if (umbralActual) {
      cargarUmbral(umbralActual.anioId)
    }
  }

  const pestañas: { id: Pestaña; etiqueta: string; habilitada: boolean }[] = [
    { id: 'umbral', etiqueta: 'Umbral', habilitada: puedeUmbral },
    { id: 'alertas', etiqueta: 'Alertas', habilitada: puedeAlertas },
    { id: 'horarios', etiqueta: 'Horarios', habilitada: puedeHorarios },
  ]

  const primeraHabilitada = pestañas.find((p) => p.habilitada)?.id ?? 'horarios'

  // Asegurar que la pestaña activa sea habilitada
  if (!pestañas.find((p) => p.id === pestañaActiva)?.habilitada) {
    setPestañaActiva(primeraHabilitada)
  }

  return (
    <section aria-labelledby="horarios-index-title" className="space-y-6">
      <div>
        <h1 id="horarios-index-title" className="text-2xl font-semibold">
          Configuración académica
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Umbral de alertas, consulta de alertas y gestión de horarios.
        </p>
      </div>

      <nav aria-label="Pestañas de configuración académica" className="border-b border-slate-200">
        <ul className="flex gap-1 overflow-x-auto" role="tablist">
          {pestañas.map((pestaña) => (
            <li key={pestaña.id} role="presentation">
              <button
                role="tab"
                aria-selected={pestañaActiva === pestaña.id}
                aria-controls={`panel-${pestaña.id}`}
                id={`tab-${pestaña.id}`}
                disabled={!pestaña.habilitada}
                onClick={() => pestaña.habilitada && setPestañaActiva(pestaña.id)}
                className={`
                  px-4 py-2 text-sm font-medium border-b-2 -mb-px
                  focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
                  ${pestaña.habilitada
                    ? pestañaActiva === pestaña.id
                      ? 'border-slate-900 text-slate-900'
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                    : 'border-transparent text-slate-400 cursor-not-allowed'
                  }
                `}
              >
                {pestaña.etiqueta}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {!pestañas.some((p) => p.habilitada) ? (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          No tienes permiso para acceder a ninguna de estas funciones.
        </div>
      ) : null}

      {pestañaActiva === 'umbral' && puedeUmbral ? (
        <div id="panel-umbral" role="tabpanel" aria-labelledby="tab-umbral" className="mt-4">
          <h2 className="text-lg font-medium">Configurar umbral de alertas</h2>
          <p className="mt-1 text-sm text-slate-600">
            Define el número de faltas injustificadas que dispara una alerta.
            Sin umbral no se generan alertas.
          </p>
          <div className="mt-4 rounded-md border border-slate-200 bg-white p-4">
            <div className="mb-4">
              <label
                htmlFor="umbral-anio"
                className="block text-sm font-medium text-slate-700"
              >
                Año académico
              </label>
              <div className="mt-1 flex flex-wrap gap-3 items-end">
                <input
                  id="umbral-anio"
                  type="text"
                  value={anioIdUmbral}
                  onChange={(e) => setAnioIdUmbral(e.target.value)}
                  placeholder="UUID del año académico"
                  className="w-full max-w-xs rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                />
                <button
                  type="button"
                  onClick={() => cargarUmbral(anioIdUmbral)}
                  disabled={cargandoUmbral || anioIdUmbral.trim().length === 0}
                  className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {cargandoUmbral ? 'Cargando…' : 'Cargar umbral'}
                </button>
              </div>
            </div>

            {errorUmbral ? (
              <div
                role="alert"
                className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                {errorUmbral}
              </div>
            ) : null}

            {umbralActual !== null ? (
              <UmbralForm
                anioId={umbralActual.anioId}
                onExito={alGuardarUmbral}
                onCancelar={() => {
                  setAnioIdUmbral('')
                  setUmbralActual(null)
                }}
              />
            ) : (
              <p className="text-sm text-slate-500">
                Ingresa un año académico y pulsa «Cargar umbral» para ver o
                configurar el valor actual.
              </p>
            )}
          </div>
        </div>
      ) : null}

      {pestañaActiva === 'alertas' && puedeAlertas ? (
        <div id="panel-alertas" role="tabpanel" aria-labelledby="tab-alertas" className="mt-4">
          <AlertasPage />
        </div>
      ) : null}

      {pestañaActiva === 'horarios' && puedeHorarios ? (
        <div id="panel-horarios" role="tabpanel" aria-labelledby="tab-horarios" className="mt-4">
          <HorariosPage />
        </div>
      ) : null}
    </section>
  )
}