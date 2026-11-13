import { useState, type FormEvent } from 'react'
import {
  TIPO_CERTIFICADO_VALUES,
  plantillaCertificadoSchema,
  actualizarPlantillaSchema,
  type TipoCertificado,
  type PlantillaCertificadoResponsePayload,
} from '@intranet/shared'
import { PlantillaEditor } from '../shared/PlantillaEditor'
import { etiquetaTipoCertificado, mensajeError } from '../shared/formato'
import { crearPlantilla, actualizarPlantilla } from './api'

interface PlantillaFormProps {
  /** Plantilla existente para editar; si se omite, se crea una nueva. */
  plantilla?: PlantillaCertificadoResponsePayload
  /** Callback al guardar exitoso */
  onGuardado: (mensaje?: string) => void
  /** Callback al cancelar */
  onCancelar: () => void
}

interface ErroresFormulario {
  tipo?: string
  nombre?: string
  contenido?: string
  general?: string
}

export function PlantillaForm({
  plantilla,
  onGuardado,
  onCancelar,
}: PlantillaFormProps) {
  const esEdicion = plantilla !== undefined

  const [tipo, setTipo] = useState<TipoCertificado>(plantilla?.tipo ?? 'ESTUDIOS')
  const [nombre, setNombre] = useState(plantilla?.nombre ?? '')
  const [contenido, setContenido] = useState(plantilla?.contenido ?? '')
  const [activa, setActiva] = useState(plantilla?.activa ?? true)
  const [errores, setErrores] = useState<ErroresFormulario>({})
  const [cargando, setCargando] = useState(false)

  async function handleSubmit(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setErrores({})

    if (esEdicion) {
      const resultado = actualizarPlantillaSchema.safeParse({ nombre, contenido, activa })

      if (!resultado.success) {
        setErrores(mapearErrores(resultado.error.issues))
        return
      }

      setCargando(true)

      try {
        await actualizarPlantilla(plantilla.id, resultado.data)
        onGuardado('Plantilla actualizada correctamente')
      } catch (error) {
        setErrores({ general: mensajeError(error) })
      } finally {
        setCargando(false)
      }

      return
    }

    const resultado = plantillaCertificadoSchema.safeParse({
      tipo,
      nombre,
      contenido,
      activa,
    })

    if (!resultado.success) {
      setErrores(mapearErrores(resultado.error.issues))
      return
    }

    setCargando(true)

    try {
      await crearPlantilla(resultado.data)
      onGuardado('Plantilla creada correctamente')
    } catch (error) {
      setErrores({ general: mensajeError(error) })
    } finally {
      setCargando(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      {errores.general && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm" role="alert">
          {errores.general}
        </div>
      )}

      {/* Tipo */}
      <div>
        <label htmlFor="plantilla-tipo" className="block text-sm font-medium text-slate-700 mb-1">
          Tipo de certificado <span className="text-red-500" aria-hidden="true">*</span>
        </label>
        <select
          id="plantilla-tipo"
          value={tipo}
          onChange={(e) => {
            const valor = TIPO_CERTIFICADO_VALUES.find((opcion) => opcion === e.target.value)
            if (valor) setTipo(valor)
          }}
          disabled={cargando || esEdicion}
          className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errores.tipo ? 'border-red-500' : 'border-slate-300'
          }`}
          aria-invalid={errores.tipo ? 'true' : 'false'}
          aria-describedby={errores.tipo ? 'plantilla-tipo-error' : undefined}
        >
          {TIPO_CERTIFICADO_VALUES.map((valor) => (
            <option key={valor} value={valor}>{etiquetaTipoCertificado(valor)}</option>
          ))}
        </select>
        {errores.tipo && (
          <p id="plantilla-tipo-error" className="mt-1 text-sm text-red-600" role="alert">
            {errores.tipo}
          </p>
        )}
      </div>

      {/* Nombre */}
      <div>
        <label htmlFor="plantilla-nombre" className="block text-sm font-medium text-slate-700 mb-1">
          Nombre <span className="text-red-500" aria-hidden="true">*</span>
        </label>
        <input
          type="text"
          id="plantilla-nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          maxLength={100}
          disabled={cargando}
          className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errores.nombre ? 'border-red-500' : 'border-slate-300'
          }`}
          aria-invalid={errores.nombre ? 'true' : 'false'}
          aria-describedby={errores.nombre ? 'plantilla-nombre-error' : undefined}
        />
        {errores.nombre && (
          <p id="plantilla-nombre-error" className="mt-1 text-sm text-red-600" role="alert">
            {errores.nombre}
          </p>
        )}
      </div>

      {/* Activa */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="plantilla-activa"
          checked={activa}
          onChange={(e) => setActiva(e.target.checked)}
          disabled={cargando}
          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
        />
        <label htmlFor="plantilla-activa" className="text-sm text-slate-700">
          Plantilla activa
        </label>
      </div>

      {/* Contenido */}
      <PlantillaEditor
        valorInicial={contenido}
        tipo={tipo}
        onChange={setContenido}
        deshabilitado={cargando}
        error={errores.contenido}
      />

      {/* Acciones */}
      <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
        <button
          type="button"
          onClick={onCancelar}
          disabled={cargando}
          className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700 disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={cargando}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {cargando ? 'Guardando...' : esEdicion ? 'Actualizar plantilla' : 'Crear plantilla'}
        </button>
      </div>
    </form>
  )
}

function mapearErrores(
  issues: { path: PropertyKey[]; message: string }[],
): ErroresFormulario {
  const errores: ErroresFormulario = {}

  for (const issue of issues) {
    const campo = issue.path[0]

    if (campo === 'tipo' || campo === 'nombre' || campo === 'contenido') {
      errores[campo] ??= issue.message
    }
  }

  return errores
}

export default PlantillaForm
