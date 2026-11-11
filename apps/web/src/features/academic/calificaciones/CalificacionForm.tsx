import {
  actualizarCalificacionSchema,
  crearCalificacionSchema,
  uuidSchema,
  type CalificacionResponse,
  type ValorLiteral,
} from '@intranet/shared'
import { useState, type ChangeEvent, type FormEvent } from 'react'
import { actualizarCalificacion, crearCalificacion } from './api'
import { mensajeError } from './formato'

/** Escala literal oficial; no existen valores numéricos (RN-ACAD-001). */
const VALORES: readonly ValorLiteral[] = ['AD', 'A', 'B', 'C']

/** Modos admitidos por el formulario de calificaciones. */
export type ModoCalificacion = 'crear' | 'editar' | 'corregir'

interface CalificacionFormProps {
  /** Período al que pertenece la calificación. */
  periodoId: string
  modo: ModoCalificacion
  /** Registro a editar o corregir; obligatorio salvo en `crear`. */
  registro?: CalificacionResponse
  /** Identificador del título que rotula el formulario. */
  tituloId: string
  /** Se invoca con un mensaje cuando la operación termina correctamente. */
  onExito: (mensaje: string) => void
  /** Cierra el formulario sin guardar. */
  onCancelar: () => void
}

interface ValoresFormulario {
  alumnoId: string
  cursoId: string
  valor: ValorLiteral
  observacion: string
  motivo: string
}

function valoresIniciales(registro?: CalificacionResponse): ValoresFormulario {
  return {
    alumnoId: '',
    cursoId: '',
    valor: registro?.valor ?? 'A',
    observacion: registro?.observacion ?? '',
    motivo: '',
  }
}

/** Valida los identificadores con mensajes en español antes del schema. */
function validarIdentificadores(
  valores: ValoresFormulario,
): Record<string, string | undefined> {
  const errores: Record<string, string | undefined> = {}

  if (valores.alumnoId.trim().length === 0) {
    errores.alumnoId = 'El alumno es obligatorio.'
  } else if (!uuidSchema.safeParse(valores.alumnoId).success) {
    errores.alumnoId = 'El identificador del alumno no es válido.'
  }

  if (valores.cursoId.trim().length === 0) {
    errores.cursoId = 'El curso es obligatorio.'
  } else if (!uuidSchema.safeParse(valores.cursoId).success) {
    errores.cursoId = 'El identificador del curso no es válido.'
  }

  return errores
}

/**
 * Formulario de alta, edición y corrección de una calificación (RF-ACAD-001).
 *
 * El alta exige alumno, curso y valor. La edición reutiliza el registro y, en
 * modo `corregir`, exige un motivo que el backend audita como presencia sin
 * guardar su texto (RF-ACAD-003, RN-ACAD-006).
 */
export function CalificacionForm({
  periodoId,
  modo,
  registro,
  tituloId,
  onExito,
  onCancelar,
}: CalificacionFormProps) {
  const [valores, setValores] = useState<ValoresFormulario>(() =>
    valoresIniciales(registro),
  )
  const [errores, setErrores] = useState<Record<string, string | undefined>>({})
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  function cambiar(
    evento: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) {
    const { name, value } = evento.target

    setValores((actuales) => ({ ...actuales, [name]: value }))
    setErrores((actuales) => ({ ...actuales, [name]: undefined }))
  }

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setErrorGeneral(null)

    if (modo === 'corregir' && valores.motivo.trim().length === 0) {
      setErrores({ motivo: 'El motivo es obligatorio para corregir.' })
      return
    }

    if (modo === 'crear') {
      const erroresCampos = validarIdentificadores(valores)

      if (Object.keys(erroresCampos).length > 0) {
        setErrores(erroresCampos)
        return
      }

      const validacion = crearCalificacionSchema.safeParse({
        alumnoId: valores.alumnoId,
        cursoId: valores.cursoId,
        periodoId,
        valor: valores.valor,
        ...(valores.observacion.trim().length > 0
          ? { observacion: valores.observacion }
          : {}),
      })

      if (!validacion.success) {
        mostrarErroresValidacion(validacion.error.issues)
        return
      }

      setErrores({})
      setEnviando(true)

      try {
        await crearCalificacion(validacion.data)
        onExito('Calificación registrada.')
      } catch (error) {
        setErrorGeneral(mensajeError(error))
      } finally {
        setEnviando(false)
      }

      return
    }

    if (!registro) {
      setErrorGeneral('No se encontró la calificación a editar.')
      return
    }

    const validacion = actualizarCalificacionSchema.safeParse({
      valor: valores.valor,
      ...(valores.observacion.trim().length > 0
        ? { observacion: valores.observacion }
        : {}),
      ...(valores.motivo.trim().length > 0 ? { motivo: valores.motivo } : {}),
    })

    if (!validacion.success) {
      mostrarErroresValidacion(validacion.error.issues)
      return
    }

    setErrores({})
    setEnviando(true)

    try {
      await actualizarCalificacion(registro.id, validacion.data)
      onExito(
        modo === 'corregir'
          ? 'Calificación corregida.'
          : 'Calificación actualizada.',
      )
    } catch (error) {
      setErrorGeneral(mensajeError(error))
    } finally {
      setEnviando(false)
    }
  }

  function mostrarErroresValidacion(
    issues: readonly { path: PropertyKey[]; message: string }[],
  ) {
    const nuevos: Record<string, string | undefined> = {}

    for (const issue of issues) {
      const campo = issue.path[0]

      if (typeof campo === 'string' && !nuevos[campo]) {
        nuevos[campo] = issue.message
      }
    }

    setErrores(nuevos)
  }

  return (
    <form
      aria-labelledby={tituloId}
      className="mt-4 space-y-4"
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

      {modo === 'crear' ? (
        <>
          <div>
            <label
              htmlFor="calificacion-alumno"
              className="block text-sm font-medium text-slate-700"
            >
              Alumno
            </label>
            <input
              id="calificacion-alumno"
              name="alumnoId"
              type="text"
              autoFocus
              value={valores.alumnoId}
              onChange={cambiar}
              aria-invalid={Boolean(errores.alumnoId)}
              aria-describedby={
                errores.alumnoId ? 'calificacion-alumno-error' : undefined
              }
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            />
            {errores.alumnoId ? (
              <p
                id="calificacion-alumno-error"
                role="alert"
                className="mt-1 text-sm text-red-700"
              >
                {errores.alumnoId}
              </p>
            ) : null}
          </div>

          <div>
            <label
              htmlFor="calificacion-curso"
              className="block text-sm font-medium text-slate-700"
            >
              Curso
            </label>
            <input
              id="calificacion-curso"
              name="cursoId"
              type="text"
              value={valores.cursoId}
              onChange={cambiar}
              aria-invalid={Boolean(errores.cursoId)}
              aria-describedby={
                errores.cursoId ? 'calificacion-curso-error' : undefined
              }
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            />
            {errores.cursoId ? (
              <p
                id="calificacion-curso-error"
                role="alert"
                className="mt-1 text-sm text-red-700"
              >
                {errores.cursoId}
              </p>
            ) : null}
          </div>
        </>
      ) : null}

      <div>
        <label
          htmlFor="calificacion-valor"
          className="block text-sm font-medium text-slate-700"
        >
          Valor
        </label>
        <select
          id="calificacion-valor"
          name="valor"
          autoFocus={modo !== 'crear'}
          value={valores.valor}
          onChange={cambiar}
          aria-invalid={Boolean(errores.valor)}
          aria-describedby={
            errores.valor ? 'calificacion-valor-error' : undefined
          }
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        >
          {VALORES.map((valor) => (
            <option key={valor} value={valor}>
              {valor}
            </option>
          ))}
        </select>
        {errores.valor ? (
          <p
            id="calificacion-valor-error"
            role="alert"
            className="mt-1 text-sm text-red-700"
          >
            {errores.valor}
          </p>
        ) : null}
      </div>

      <div>
        <label
          htmlFor="calificacion-observacion"
          className="block text-sm font-medium text-slate-700"
        >
          Observación (opcional)
        </label>
        <textarea
          id="calificacion-observacion"
          name="observacion"
          rows={3}
          value={valores.observacion}
          onChange={cambiar}
          aria-invalid={Boolean(errores.observacion)}
          aria-describedby={
            errores.observacion ? 'calificacion-observacion-error' : undefined
          }
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        />
        {errores.observacion ? (
          <p
            id="calificacion-observacion-error"
            role="alert"
            className="mt-1 text-sm text-red-700"
          >
            {errores.observacion}
          </p>
        ) : null}
      </div>

      {modo === 'corregir' ? (
        <div>
          <label
            htmlFor="calificacion-motivo"
            className="block text-sm font-medium text-slate-700"
          >
            Motivo de la corrección
          </label>
          <textarea
            id="calificacion-motivo"
            name="motivo"
            rows={2}
            value={valores.motivo}
            onChange={cambiar}
            aria-invalid={Boolean(errores.motivo)}
            aria-describedby={
              errores.motivo
                ? 'calificacion-motivo-error'
                : 'calificacion-motivo-hint'
            }
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          />
          {errores.motivo ? (
            <p
              id="calificacion-motivo-error"
              role="alert"
              className="mt-1 text-sm text-red-700"
            >
              {errores.motivo}
            </p>
          ) : (
            <p id="calificacion-motivo-hint" className="mt-1 text-sm text-slate-500">
              La corrección queda auditada; el texto del motivo no se almacena.
            </p>
          )}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={enviando}
          className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {enviando
            ? 'Guardando…'
            : modo === 'corregir'
              ? 'Guardar corrección'
              : modo === 'editar'
                ? 'Guardar cambios'
                : 'Registrar calificación'}
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
