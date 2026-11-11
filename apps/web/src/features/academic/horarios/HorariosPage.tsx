import type { HorarioResponse } from '@intranet/shared'
import {
  crearHorarioSchema,
  actualizarHorarioSchema,
  diaSemanaSchema,
  horaSchema,
  type CrearHorarioInput,
  type ActualizarHorarioInput,
  type DiaSemana,
} from '@intranet/shared'
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import { useAuth } from '../../auth/useAuth'
import { mensajeError } from '../shared/formato'
import {
  actualizarHorario,
  crearHorario,
  eliminarHorario,
  listarHorarios,
} from './api'

const DIAS: readonly DiaSemana[] = [1, 2, 3, 4, 5, 6, 7]

const ETIQUETAS_DIAS: Record<DiaSemana, string> = {
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
  7: 'Domingo',
}

type Accion =
  | { tipo: 'crear' }
  | { tipo: 'editar'; horario: HorarioResponse }
  | { tipo: 'eliminar'; horario: HorarioResponse }
  | null

interface FiltrosFormulario {
  anioId: string
  seccionId: string
  docenteId: string
}

interface HorarioFormProps {
  modo: 'crear' | 'editar'
  inicial?: HorarioResponse
  onExito: (mensaje: string) => void
  onCancelar: () => void
}

/**
 * Formulario para crear o editar un bloque de horario (RF-ACAD-010).
 *
 * Valida día, horas (HH:MM), curso, sección y docente opcional.
 */
function HorarioForm({
  modo,
  inicial,
  onExito,
  onCancelar,
}: HorarioFormProps) {
  const [anioId, setAnioId] = useState(inicial?.anioId ?? '')
  const [seccionId, setSeccionId] = useState(inicial?.seccionId ?? '')
  const [cursoId, setCursoId] = useState(inicial?.cursoId ?? '')
  const [docenteId, setDocenteId] = useState(inicial?.docenteId ?? '')
  const [diaSemana, setDiaSemana] = useState<DiaSemana>(inicial?.diaSemana ?? 1)
  const [horaInicio, setHoraInicio] = useState(inicial?.horaInicio ?? '')
  const [horaFin, setHoraFin] = useState(inicial?.horaFin ?? '')
  const [errores, setErrores] = useState<Record<string, string | undefined>>({})
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setErrorGeneral(null)

    const erroresCampos: Record<string, string | undefined> = {}

    if (anioId.trim().length === 0) {
      erroresCampos.anioId = 'El año académico es obligatorio.'
    }
    if (seccionId.trim().length === 0) {
      erroresCampos.seccionId = 'La sección es obligatoria.'
    }
    if (cursoId.trim().length === 0) {
      erroresCampos.cursoId = 'El curso es obligatorio.'
    }
    if (horaInicio.trim().length === 0) {
      erroresCampos.horaInicio = 'La hora de inicio es obligatoria.'
    } else if (!horaSchema.safeParse(horaInicio).success) {
      erroresCampos.horaInicio = 'La hora debe tener el formato HH:MM.'
    }
    if (horaFin.trim().length === 0) {
      erroresCampos.horaFin = 'La hora de fin es obligatoria.'
    } else if (!horaSchema.safeParse(horaFin).success) {
      erroresCampos.horaFin = 'La hora debe tener el formato HH:MM.'
    }

    if (Object.keys(erroresCampos).length > 0) {
      setErrores(erroresCampos)
      return
    }

    if (horaInicio >= horaFin) {
      setErrores({ horaFin: 'La hora de inicio debe ser anterior a la de fin.' })
      return
    }

    const inputBase = {
      anioId,
      seccionId,
      cursoId,
      docenteId: docenteId.trim().length > 0 ? docenteId : undefined,
      diaSemana,
      horaInicio,
      horaFin,
    }

    const schema = modo === 'crear' ? crearHorarioSchema : actualizarHorarioSchema
    const validacion = schema.safeParse(inputBase)

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
      if (modo === 'crear') {
        await crearHorario(validacion.data as CrearHorarioInput)
        onExito('Horario creado.')
      } else {
        await actualizarHorario(inicial!.id, validacion.data as ActualizarHorarioInput)
        onExito('Horario actualizado.')
      }
    } catch (error) {
      setErrorGeneral(mensajeError(error))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form
      aria-labelledby={`horario-${modo}-title`}
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
            htmlFor="horario-anio"
            className="block text-sm font-medium text-slate-700"
          >
            Año académico
          </label>
          <input
            id="horario-anio"
            name="anioId"
            type="text"
            value={anioId}
            onChange={(e) => {
              setAnioId(e.target.value)
              setErrores((a) => ({ ...a, anioId: undefined }))
            }}
            aria-invalid={Boolean(errores.anioId)}
            aria-describedby={errores.anioId ? 'horario-anio-error' : undefined}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          />
          {errores.anioId ? (
            <p id="horario-anio-error" role="alert" className="mt-1 text-sm text-red-700">
              {errores.anioId}
            </p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor="horario-seccion"
            className="block text-sm font-medium text-slate-700"
          >
            Sección
          </label>
          <input
            id="horario-seccion"
            name="seccionId"
            type="text"
            value={seccionId}
            onChange={(e) => {
              setSeccionId(e.target.value)
              setErrores((a) => ({ ...a, seccionId: undefined }))
            }}
            aria-invalid={Boolean(errores.seccionId)}
            aria-describedby={errores.seccionId ? 'horario-seccion-error' : undefined}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          />
          {errores.seccionId ? (
            <p id="horario-seccion-error" role="alert" className="mt-1 text-sm text-red-700">
              {errores.seccionId}
            </p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor="horario-curso"
            className="block text-sm font-medium text-slate-700"
          >
            Curso
          </label>
          <input
            id="horario-curso"
            name="cursoId"
            type="text"
            value={cursoId}
            onChange={(e) => {
              setCursoId(e.target.value)
              setErrores((a) => ({ ...a, cursoId: undefined }))
            }}
            aria-invalid={Boolean(errores.cursoId)}
            aria-describedby={errores.cursoId ? 'horario-curso-error' : undefined}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          />
          {errores.cursoId ? (
            <p id="horario-curso-error" role="alert" className="mt-1 text-sm text-red-700">
              {errores.cursoId}
            </p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor="horario-docente"
            className="block text-sm font-medium text-slate-700"
          >
            Docente (opcional)
          </label>
          <input
            id="horario-docente"
            name="docenteId"
            type="text"
            value={docenteId}
            onChange={(e) => setDocenteId(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          />
        </div>

        <div>
          <label
            htmlFor="horario-dia"
            className="block text-sm font-medium text-slate-700"
          >
            Día de la semana
          </label>
          <select
            id="horario-dia"
            name="diaSemana"
            value={String(diaSemana)}
            onChange={(e) => {
              const numero = Number(e.target.value)
              const val = diaSemanaSchema.safeParse(numero)
              if (val.success) setDiaSemana(val.data)
            }}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          >
            {DIAS.map((d) => (
              <option key={d} value={String(d)}>
                {ETIQUETAS_DIAS[d]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="horario-inicio"
            className="block text-sm font-medium text-slate-700"
          >
            Hora de inicio
          </label>
          <input
            id="horario-inicio"
            name="horaInicio"
            type="text"
            placeholder="HH:MM"
            value={horaInicio}
            onChange={(e) => {
              setHoraInicio(e.target.value)
              setErrores((a) => ({ ...a, horaInicio: undefined }))
            }}
            aria-invalid={Boolean(errores.horaInicio)}
            aria-describedby={errores.horaInicio ? 'horario-inicio-error' : undefined}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          />
          {errores.horaInicio ? (
            <p id="horario-inicio-error" role="alert" className="mt-1 text-sm text-red-700">
              {errores.horaInicio}
            </p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor="horario-fin"
            className="block text-sm font-medium text-slate-700"
          >
            Hora de fin
          </label>
          <input
            id="horario-fin"
            name="horaFin"
            type="text"
            placeholder="HH:MM"
            value={horaFin}
            onChange={(e) => {
              setHoraFin(e.target.value)
              setErrores((a) => ({ ...a, horaFin: undefined }))
            }}
            aria-invalid={Boolean(errores.horaFin)}
            aria-describedby={errores.horaFin ? 'horario-fin-error' : undefined}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          />
          {errores.horaFin ? (
            <p id="horario-fin-error" role="alert" className="mt-1 text-sm text-red-700">
              {errores.horaFin}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={enviando}
          className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {enviando ? 'Guardando…' : modo === 'crear' ? 'Crear horario' : 'Actualizar horario'}
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

/**
 * Pantalla de horarios (RF-ACAD-010, RF-ACAD-011).
 *
 * Director y SuperAdmin crean, editan y eliminan; todos consultan con alcance.
 */
export function HorariosPage() {
  const { usuario } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  const anioId = searchParams.get('anioId')?.trim() ?? ''
  const seccionId = searchParams.get('seccionId')?.trim() ?? ''
  const docenteId = searchParams.get('docenteId')?.trim() ?? ''
  const clave = [anioId, seccionId, docenteId].join('|')

  const [borrador, setBorrador] = useState<FiltrosFormulario>({
    anioId,
    seccionId,
    docenteId,
  })
  const [horarios, setHorarios] = useState<HorarioResponse[]>([])
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
  const puedeLeer = permisos.includes('academic.horarios.leer')
  const puedeGestionar = permisos.includes('academic.horarios.gestionar')

  const cargando = puedeLeer && resultado?.clave !== clave
  const errorCarga = resultado?.clave === clave ? resultado.error : null

  useEffect(() => {
    if (!puedeLeer) return

    let activo = true

    listarHorarios({
      anioId: anioId || '',
      ...(seccionId ? { seccionId } : {}),
      ...(docenteId ? { docenteId } : {}),
    })
      .then((respuesta) => {
        if (!activo) return
        setHorarios(respuesta.data)
        setResultado({ clave, error: null })
      })
      .catch((error: unknown) => {
        if (activo) setResultado({ clave, error: mensajeError(error) })
      })

    return () => {
      activo = false
    }
  }, [anioId, seccionId, docenteId, clave, recarga, puedeLeer])

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

    if (borrador.anioId.trim().length > 0) siguientes.set('anioId', borrador.anioId.trim())
    if (borrador.seccionId.trim().length > 0) siguientes.set('seccionId', borrador.seccionId.trim())
    if (borrador.docenteId.trim().length > 0) siguientes.set('docenteId', borrador.docenteId.trim())

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

  async function eliminar(horario: HorarioResponse) {
    setMensajeExito(null)
    setErrorAccion(null)

    if (!window.confirm(`¿Eliminar el horario ${horario.id}?`)) return

    try {
      await eliminarHorario(horario.id)
      alExito('Horario eliminado.')
    } catch (error) {
      setErrorAccion(mensajeError(error))
    }
  }

  const accionFormulario = accion?.tipo === 'crear' || accion?.tipo === 'editar'

  return (
    <section aria-labelledby="horarios-title" className="space-y-6">
      <div>
        <h1 id="horarios-title" className="text-2xl font-semibold">
          Horarios
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Bloques semanales por sección, curso y docente. Director y SuperAdmin
          gestionan; docente, apoderado y alumno consultan con alcance.
        </p>
      </div>

      <form
        aria-label="Filtrar horarios"
        className="rounded-md border border-slate-200 bg-white p-4"
        noValidate
        onSubmit={consultar}
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label
              htmlFor="filtro-anio"
              className="block text-sm font-medium text-slate-700"
            >
              Año académico (obligatorio)
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
              htmlFor="filtro-docente"
              className="block text-sm font-medium text-slate-700"
            >
              Docente
            </label>
            <input
              id="filtro-docente"
              name="docenteId"
              type="text"
              value={borrador.docenteId}
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
          No tienes permiso para consultar horarios.
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
          Cargando horarios…
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
          <section aria-labelledby="lista-horarios-title">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="lista-horarios-title" className="text-xl font-semibold">
                Horarios
              </h2>
              {puedeGestionar && !accionFormulario ? (
                <button
                  type="button"
                  onClick={() => abrir({ tipo: 'crear' })}
                  className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                >
                  Crear horario
                </button>
              ) : null}
            </div>

            {accion?.tipo === 'crear' ? (
              <div className="mt-3 rounded-md border border-slate-200 bg-white p-4">
                <h3 id="horario-crear-title" className="text-lg font-medium">
                  Crear horario
                </h3>
                <HorarioForm
                  modo="crear"
                  onExito={alExito}
                  onCancelar={() => setAccion(null)}
                />
              </div>
            ) : null}

            {accion?.tipo === 'editar' ? (
              <div className="mt-3 rounded-md border border-slate-200 bg-white p-4">
                <h3 id="horario-editar-title" className="text-lg font-medium">
                  Editar horario
                </h3>
                <HorarioForm
                  modo="editar"
                  inicial={accion.horario}
                  onExito={alExito}
                  onCancelar={() => setAccion(null)}
                />
              </div>
            ) : null}

            {horarios.length === 0 ? (
              <p className="mt-3 text-sm text-slate-600">
                No hay horarios registrados con estos filtros.
              </p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <caption className="sr-only">
                    Horarios registrados con los filtros aplicados
                  </caption>
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th scope="col" className="px-2 py-2 font-medium">
                        Sección
                      </th>
                      <th scope="col" className="px-2 py-2 font-medium">
                        Curso
                      </th>
                      <th scope="col" className="px-2 py-2 font-medium">
                        Docente
                      </th>
                      <th scope="col" className="px-2 py-2 font-medium">
                        Día
                      </th>
                      <th scope="col" className="px-2 py-2 font-medium">
                        Inicio
                      </th>
                      <th scope="col" className="px-2 py-2 font-medium">
                        Fin
                      </th>
                      <th scope="col" className="px-2 py-2 font-medium">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {horarios.map((fila) => (
                      <tr key={fila.id} className="border-b border-slate-100">
                        <th scope="row" className="px-2 py-2 font-normal">
                          <code className="break-all text-xs">{fila.seccionId}</code>
                        </th>
                        <td className="px-2 py-2">
                          <code className="break-all text-xs">{fila.cursoId}</code>
                        </td>
                        <td className="px-2 py-2">
                          {fila.docenteId ? (
                            <code className="break-all text-xs">{fila.docenteId}</code>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>
                        <td className="px-2 py-2">{fila.diaSemana}</td>
                        <td className="px-2 py-2">{fila.horaInicio}</td>
                        <td className="px-2 py-2">{fila.horaFin}</td>
                        <td className="px-2 py-2">
                          <div className="flex flex-wrap gap-2">
                            {puedeGestionar ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => abrir({ tipo: 'editar', horario: fila })}
                                  aria-label={`Editar el horario ${fila.id}`}
                                  className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                                >
                                  Editar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => eliminar(fila)}
                                  aria-label={`Eliminar el horario ${fila.id}`}
                                  className="rounded-md border border-red-300 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
                                >
                                  Eliminar
                                </button>
                              </>
                            ) : (
                              <span className="text-xs text-slate-500">Solo consulta</span>
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