import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  TIPO_CERTIFICADO_VALUES,
  tipoCertificadoSchema,
  type PlantillaCertificadoResponsePayload,
} from '@intranet/shared'
import { etiquetaTipoCertificado, mensajeError } from '../shared/formato'
import { crearCertificado, solicitarCertificado } from './api'

/** Opción de alumno para el selector. */
export interface AlumnoOpcion {
  id: string
  codigoAlumno: string
  nombres: string
  apellidos: string
}

/** Opción simple de año académico. */
export interface AnioOpcion {
  id: string
  nombre: string
}

interface CertificadoFormProps {
  /** `emitir` crea el certificado directamente; `solicitar` lo deja pendiente. */
  modo: 'emitir' | 'solicitar'
  /** Alumnos disponibles para el selector */
  alumnos: AlumnoOpcion[]
  /** Años académicos disponibles */
  anios: AnioOpcion[]
  /** Plantillas disponibles (opcional) */
  plantillas: PlantillaCertificadoResponsePayload[]
  /** Callback al guardar exitoso */
  onGuardado: (mensaje?: string) => void
  /** Callback al cancelar */
  onCancelar: () => void
}

const certificadoFormSchema = z.object({
  tipo: tipoCertificadoSchema,
  alumnoId: z.uuid('Debe seleccionar un alumno'),
  anioId: z.uuid('Debe seleccionar un año académico'),
  plantillaId: z.uuid().or(z.literal('')),
})

type CertificadoFormInput = z.infer<typeof certificadoFormSchema>

/** Extrae las variables `{{variable}}` del contenido de una plantilla. */
function extraerVariables(contenido: string): string[] {
  const regex = /\{\{(\w+(?:\.\w+)*)\}\}/g
  const variables = new Set<string>()
  let coincidencia: RegExpExecArray | null

  while ((coincidencia = regex.exec(contenido)) !== null) {
    if (coincidencia[1]) variables.add(coincidencia[1])
  }

  return Array.from(variables).sort()
}

/** Sustituye las variables por sus valores en el contenido de la plantilla. */
function renderizarPlantilla(
  contenido: string,
  valores: Record<string, string>,
): string {
  return contenido.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_coincidencia, clave: string) => {
    return valores[clave] ?? `{{${clave}}}`
  })
}

export function CertificadoForm({
  modo,
  alumnos,
  anios,
  plantillas,
  onGuardado,
  onCancelar,
}: CertificadoFormProps) {
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [variables, setVariables] = useState<Record<string, string>>({})
  const [mostrarPreview, setMostrarPreview] = useState(false)

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<CertificadoFormInput>({
    resolver: zodResolver(certificadoFormSchema),
    defaultValues: {
      tipo: 'ESTUDIOS',
      alumnoId: '',
      anioId: '',
      plantillaId: '',
    },
  })

  const tipo = useWatch({ control, name: 'tipo' })
  const alumnoId = useWatch({ control, name: 'alumnoId' })
  const anioId = useWatch({ control, name: 'anioId' })
  const plantillaId = useWatch({ control, name: 'plantillaId' })

  const plantillaSeleccionada = plantillas.find((plantilla) => plantilla.id === plantillaId)
  const variablesDetectadas = plantillaSeleccionada
    ? extraerVariables(plantillaSeleccionada.contenido)
    : []

  const alumno = alumnos.find((item) => item.id === alumnoId)
  const anio = anios.find((item) => item.id === anioId)

  const valoresPreview: Record<string, string> = {
    'alumno.nombres': alumno?.nombres ?? '',
    'alumno.apellidos': alumno?.apellidos ?? '',
    'alumno.codigoAlumno': alumno?.codigoAlumno ?? '',
    'anio.nombre': anio?.nombre ?? '',
    fechaEmision: new Date().toLocaleDateString('es-PE'),
    ...variables,
  }

  const contenidoPreview = plantillaSeleccionada
    ? renderizarPlantilla(plantillaSeleccionada.contenido, valoresPreview)
    : ''

  async function handleSubmitForm(datos: CertificadoFormInput) {
    setError(null)
    setCargando(true)

    try {
      const base = {
        tipo: datos.tipo,
        alumnoId: datos.alumnoId,
        anioId: datos.anioId,
        ...(datos.plantillaId ? { plantillaId: datos.plantillaId } : {}),
      }

      if (modo === 'emitir') {
        await crearCertificado({
          ...base,
          ...(Object.keys(variables).length > 0 ? { variables } : {}),
        })
        onGuardado('Certificado emitido correctamente')
      } else {
        await solicitarCertificado(base)
        onGuardado('Certificado solicitado correctamente')
      }
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setCargando(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(handleSubmitForm)} className="space-y-6" noValidate>
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm" role="alert">
          {error}
        </div>
      )}

      {/* Tipo */}
      <div>
        <label htmlFor="certificado-tipo" className="block text-sm font-medium text-slate-700 mb-1">
          Tipo de certificado <span className="text-red-500" aria-hidden="true">*</span>
        </label>
        <select
          id="certificado-tipo"
          {...register('tipo')}
          disabled={cargando}
          className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.tipo ? 'border-red-500' : 'border-slate-300'
          }`}
        >
          {TIPO_CERTIFICADO_VALUES.map((valor) => (
            <option key={valor} value={valor}>{etiquetaTipoCertificado(valor)}</option>
          ))}
        </select>
        {errors.tipo && (
          <p className="mt-1 text-sm text-red-600" role="alert">{errors.tipo.message}</p>
        )}
      </div>

      {/* Alumno */}
      <div>
        <label htmlFor="certificado-alumno" className="block text-sm font-medium text-slate-700 mb-1">
          Alumno <span className="text-red-500" aria-hidden="true">*</span>
        </label>
        <select
          id="certificado-alumno"
          {...register('alumnoId')}
          disabled={cargando}
          className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.alumnoId ? 'border-red-500' : 'border-slate-300'
          }`}
          aria-invalid={errors.alumnoId ? 'true' : 'false'}
          aria-describedby={errors.alumnoId ? 'certificado-alumno-error' : undefined}
        >
          <option value="">Seleccionar alumno...</option>
          {alumnos.map((item) => (
            <option key={item.id} value={item.id}>
              {item.codigoAlumno} - {item.nombres} {item.apellidos}
            </option>
          ))}
        </select>
        {errors.alumnoId && (
          <p id="certificado-alumno-error" className="mt-1 text-sm text-red-600" role="alert">
            {errors.alumnoId.message}
          </p>
        )}
      </div>

      {/* Año */}
      <div>
        <label htmlFor="certificado-anio" className="block text-sm font-medium text-slate-700 mb-1">
          Año académico <span className="text-red-500" aria-hidden="true">*</span>
        </label>
        <select
          id="certificado-anio"
          {...register('anioId')}
          disabled={cargando}
          className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.anioId ? 'border-red-500' : 'border-slate-300'
          }`}
          aria-invalid={errors.anioId ? 'true' : 'false'}
          aria-describedby={errors.anioId ? 'certificado-anio-error' : undefined}
        >
          <option value="">Seleccionar año...</option>
          {anios.map((item) => (
            <option key={item.id} value={item.id}>{item.nombre}</option>
          ))}
        </select>
        {errors.anioId && (
          <p id="certificado-anio-error" className="mt-1 text-sm text-red-600" role="alert">
            {errors.anioId.message}
          </p>
        )}
      </div>

      {/* Plantilla */}
      <div>
        <label htmlFor="certificado-plantilla" className="block text-sm font-medium text-slate-700 mb-1">
          Plantilla (opcional)
        </label>
        <select
          id="certificado-plantilla"
          {...register('plantillaId')}
          disabled={cargando}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Plantilla base del tipo</option>
          {plantillas
            .filter((plantilla) => plantilla.tipo === tipo)
            .map((plantilla) => (
              <option key={plantilla.id} value={plantilla.id}>
                {plantilla.nombre} (v{plantilla.version})
              </option>
            ))}
        </select>
      </div>

      {/* Variables de la plantilla */}
      {variablesDetectadas.length > 0 && (
        <fieldset className="border border-slate-200 rounded-lg p-4 space-y-3">
          <legend className="px-1 text-sm font-medium text-slate-700">
            Variables de la plantilla
          </legend>
          {variablesDetectadas.map((variable) => (
            <div key={variable} className="grid gap-2 md:grid-cols-3 md:items-center">
              <code className="text-sm text-slate-600">{'{{' + variable + '}}'}</code>
              <input
                type="text"
                value={variables[variable] ?? ''}
                onChange={(e) => {
                  const valor = e.target.value
                  setVariables((previos) => ({ ...previos, [variable]: valor }))
                }}
                disabled={cargando}
                className="md:col-span-2 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label={`Valor de ${variable}`}
              />
            </div>
          ))}
        </fieldset>
      )}

      {/* Vista previa */}
      {plantillaSeleccionada && (
        <div>
          <button
            type="button"
            onClick={() => setMostrarPreview((actual) => !actual)}
            className="px-3 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700"
          >
            {mostrarPreview ? 'Ocultar vista previa' : 'Ver vista previa'}
          </button>
          {mostrarPreview && (
            <div
              className="mt-3 border border-slate-200 rounded-lg p-4 bg-white overflow-auto"
              data-testid="certificado-preview"
              dangerouslySetInnerHTML={{ __html: contenidoPreview }}
            />
          )}
        </div>
      )}

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
          disabled={cargando || isSubmitting}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {cargando || isSubmitting
            ? 'Guardando...'
            : modo === 'emitir'
              ? 'Emitir certificado'
              : 'Solicitar certificado'}
        </button>
      </div>
    </form>
  )
}

export default CertificadoForm
