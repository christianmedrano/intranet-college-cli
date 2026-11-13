import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { solicitarMatricula } from './api'
import { mensajeError } from '../shared/formato'

/** Opción de alumno para el selector. */
export interface AlumnoOpcion {
  id: string
  codigoAlumno: string
  nombres: string
  apellidos: string
}

/** Opción simple de catálogo (año, nivel, grado o sección). */
export interface CatalogoOpcion {
  id: string
  nombre: string
}

/** Grado con su nivel padre, para el filtrado en cascada. */
export interface GradoOpcion extends CatalogoOpcion {
  nivelId: string
}

/** Sección con su grado padre, para el filtrado en cascada. */
export interface SeccionOpcion extends CatalogoOpcion {
  gradoId: string
}

/** Documento adjunto a la solicitud (RF-ADM-005). */
interface DocumentoMatricula {
  tipo: string
  archivoNombre: string
  archivoRuta: string
}

const TIPOS_DOCUMENTO = [
  { value: 'DNI', label: 'DNI' },
  { value: 'PARTIDA_NACIMIENTO', label: 'Partida de nacimiento' },
  { value: 'FOTO', label: 'Fotografía' },
  { value: 'CERTIFICADO_ESTUDIOS', label: 'Certificado de estudios' },
  { value: 'OTRO', label: 'Otro' },
] as const

const matriculaFormSchema = z.object({
  alumnoId: z.uuid('Debe seleccionar un alumno'),
  anioId: z.uuid('Debe seleccionar un año académico'),
  nivelId: z.uuid('Debe seleccionar un nivel'),
  gradoId: z.uuid('Debe seleccionar un grado'),
  seccionId: z.uuid('Debe seleccionar una sección'),
})

type MatriculaFormInput = z.infer<typeof matriculaFormSchema>

interface MatriculaFormProps {
  /** Alumnos disponibles para el selector */
  alumnos: AlumnoOpcion[]
  /** Años académicos disponibles */
  anios: CatalogoOpcion[]
  /** Niveles disponibles (Inicial, Primaria, Secundaria) */
  niveles: CatalogoOpcion[]
  /** Grados disponibles, con su nivel padre */
  grados: GradoOpcion[]
  /** Secciones disponibles, con su grado padre */
  secciones: SeccionOpcion[]
  /** Callback al guardar exitoso */
  onGuardado: (mensaje?: string) => void
  /** Callback al cancelar */
  onCancelar: () => void
}

export function MatriculaForm({
  alumnos,
  anios,
  niveles,
  grados,
  secciones,
  onGuardado,
  onCancelar,
}: MatriculaFormProps) {
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [documentos, setDocumentos] = useState<DocumentoMatricula[]>([])
  const [documento, setDocumento] = useState<DocumentoMatricula>({
    tipo: 'DNI',
    archivoNombre: '',
    archivoRuta: '',
  })
  const [errorDocumento, setErrorDocumento] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<MatriculaFormInput>({
    resolver: zodResolver(matriculaFormSchema),
    defaultValues: {
      alumnoId: '',
      anioId: '',
      nivelId: '',
      gradoId: '',
      seccionId: '',
    },
  })

  const nivelId = useWatch({ control, name: 'nivelId' })
  const gradoId = useWatch({ control, name: 'gradoId' })

  const gradosFiltrados = nivelId
    ? grados.filter((grado) => grado.nivelId === nivelId)
    : grados
  const seccionesFiltradas = gradoId
    ? secciones.filter((seccion) => seccion.gradoId === gradoId)
    : secciones

  const agregarDocumento = () => {
    if (!documento.archivoNombre.trim() || !documento.archivoRuta.trim()) {
      setErrorDocumento('Indique el nombre y la ruta del archivo.')
      return
    }

    setDocumentos((prev) => [...prev, documento])
    setDocumento({ tipo: 'DNI', archivoNombre: '', archivoRuta: '' })
    setErrorDocumento(null)
  }

  const quitarDocumento = (indice: number) => {
    setDocumentos((prev) => prev.filter((_, i) => i !== indice))
  }

  const handleSubmitForm = async (datos: MatriculaFormInput) => {
    setError(null)
    setCargando(true)

    try {
      await solicitarMatricula({
        alumnoId: datos.alumnoId,
        anioId: datos.anioId,
        seccionId: datos.seccionId,
        ...(documentos.length > 0 ? { documentos } : {}),
      })
      onGuardado('Matrícula solicitada correctamente')
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

      {/* Alumno */}
      <div>
        <label htmlFor="alumnoId" className="block text-sm font-medium text-slate-700 mb-1">
          Alumno <span className="text-red-500" aria-hidden="true">*</span>
        </label>
        <select
          id="alumnoId"
          {...register('alumnoId')}
          className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.alumnoId ? 'border-red-500' : 'border-slate-300'
          }`}
          aria-invalid={errors.alumnoId ? 'true' : 'false'}
          aria-describedby={errors.alumnoId ? 'alumnoId-error' : undefined}
          disabled={cargando}
        >
          <option value="">Seleccionar alumno...</option>
          {alumnos.map((alumno) => (
            <option key={alumno.id} value={alumno.id}>
              {alumno.codigoAlumno} - {alumno.nombres} {alumno.apellidos}
            </option>
          ))}
        </select>
        {errors.alumnoId && (
          <p id="alumnoId-error" className="mt-1 text-sm text-red-600" role="alert">
            {errors.alumnoId.message}
          </p>
        )}
      </div>

      {/* Año académico */}
      <div>
        <label htmlFor="anioId" className="block text-sm font-medium text-slate-700 mb-1">
          Año académico <span className="text-red-500" aria-hidden="true">*</span>
        </label>
        <select
          id="anioId"
          {...register('anioId')}
          className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.anioId ? 'border-red-500' : 'border-slate-300'
          }`}
          aria-invalid={errors.anioId ? 'true' : 'false'}
          aria-describedby={errors.anioId ? 'anioId-error' : undefined}
          disabled={cargando}
        >
          <option value="">Seleccionar año...</option>
          {anios.map((anio) => (
            <option key={anio.id} value={anio.id}>{anio.nombre}</option>
          ))}
        </select>
        {errors.anioId && (
          <p id="anioId-error" className="mt-1 text-sm text-red-600" role="alert">
            {errors.anioId.message}
          </p>
        )}
      </div>

      {/* Nivel */}
      <div>
        <label htmlFor="nivelId" className="block text-sm font-medium text-slate-700 mb-1">
          Nivel <span className="text-red-500" aria-hidden="true">*</span>
        </label>
        <select
          id="nivelId"
          {...register('nivelId', {
            onChange: () => {
              setValue('gradoId', '')
              setValue('seccionId', '')
            },
          })}
          className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.nivelId ? 'border-red-500' : 'border-slate-300'
          }`}
          aria-invalid={errors.nivelId ? 'true' : 'false'}
          aria-describedby={errors.nivelId ? 'nivelId-error' : undefined}
          disabled={cargando}
        >
          <option value="">Seleccionar nivel...</option>
          {niveles.map((nivel) => (
            <option key={nivel.id} value={nivel.id}>{nivel.nombre}</option>
          ))}
        </select>
        {errors.nivelId && (
          <p id="nivelId-error" className="mt-1 text-sm text-red-600" role="alert">
            {errors.nivelId.message}
          </p>
        )}
      </div>

      {/* Grado */}
      <div>
        <label htmlFor="gradoId" className="block text-sm font-medium text-slate-700 mb-1">
          Grado <span className="text-red-500" aria-hidden="true">*</span>
        </label>
        <select
          id="gradoId"
          {...register('gradoId', {
            onChange: () => {
              setValue('seccionId', '')
            },
          })}
          className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.gradoId ? 'border-red-500' : 'border-slate-300'
          }`}
          aria-invalid={errors.gradoId ? 'true' : 'false'}
          aria-describedby={errors.gradoId ? 'gradoId-error' : undefined}
          disabled={cargando || !nivelId}
        >
          <option value="">Seleccionar grado...</option>
          {gradosFiltrados.map((grado) => (
            <option key={grado.id} value={grado.id}>{grado.nombre}</option>
          ))}
        </select>
        {errors.gradoId && (
          <p id="gradoId-error" className="mt-1 text-sm text-red-600" role="alert">
            {errors.gradoId.message}
          </p>
        )}
      </div>

      {/* Sección */}
      <div>
        <label htmlFor="seccionId" className="block text-sm font-medium text-slate-700 mb-1">
          Sección <span className="text-red-500" aria-hidden="true">*</span>
        </label>
        <select
          id="seccionId"
          {...register('seccionId')}
          className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.seccionId ? 'border-red-500' : 'border-slate-300'
          }`}
          aria-invalid={errors.seccionId ? 'true' : 'false'}
          aria-describedby={errors.seccionId ? 'seccionId-error' : undefined}
          disabled={cargando || !gradoId}
        >
          <option value="">Seleccionar sección...</option>
          {seccionesFiltradas.map((seccion) => (
            <option key={seccion.id} value={seccion.id}>{seccion.nombre}</option>
          ))}
        </select>
        {errors.seccionId && (
          <p id="seccionId-error" className="mt-1 text-sm text-red-600" role="alert">
            {errors.seccionId.message}
          </p>
        )}
      </div>

      {/* Documentos */}
      <fieldset className="border border-slate-200 rounded-lg p-4 space-y-4">
        <legend className="px-1 text-sm font-medium text-slate-700">
          Documentos (opcional)
        </legend>

        {documentos.length > 0 && (
          <ul className="divide-y divide-slate-200">
            {documentos.map((doc, indice) => (
              <li key={`${doc.tipo}-${doc.archivoNombre}-${indice}`} className="flex items-center justify-between py-2">
                <span className="text-sm text-slate-700">
                  {doc.tipo} — {doc.archivoNombre}
                </span>
                <button
                  type="button"
                  onClick={() => quitarDocumento(indice)}
                  className="text-xs text-red-600 hover:text-red-800"
                  disabled={cargando}
                >
                  Quitar
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <label htmlFor="documentoTipo" className="block text-sm text-slate-600 mb-1">
              Tipo
            </label>
            <select
              id="documentoTipo"
              value={documento.tipo}
              onChange={(e) => setDocumento((prev) => ({ ...prev, tipo: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={cargando}
            >
              {TIPOS_DOCUMENTO.map((tipo) => (
                <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="documentoNombre" className="block text-sm text-slate-600 mb-1">
              Nombre del archivo
            </label>
            <input
              type="text"
              id="documentoNombre"
              value={documento.archivoNombre}
              onChange={(e) => setDocumento((prev) => ({ ...prev, archivoNombre: e.target.value }))}
              maxLength={200}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="dni-alumno.pdf"
              disabled={cargando}
            />
          </div>

          <div>
            <label htmlFor="documentoRuta" className="block text-sm text-slate-600 mb-1">
              Ruta del archivo
            </label>
            <input
              type="text"
              id="documentoRuta"
              value={documento.archivoRuta}
              onChange={(e) => setDocumento((prev) => ({ ...prev, archivoRuta: e.target.value }))}
              maxLength={500}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="/documentos/dni-alumno.pdf"
              disabled={cargando}
            />
          </div>
        </div>

        {errorDocumento && (
          <p className="text-sm text-red-600" role="alert">{errorDocumento}</p>
        )}

        <button
          type="button"
          onClick={agregarDocumento}
          disabled={cargando}
          className="px-3 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700 disabled:opacity-50"
        >
          Agregar documento
        </button>
      </fieldset>

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
          {cargando || isSubmitting ? 'Guardando...' : 'Solicitar matrícula'}
        </button>
      </div>
    </form>
  )
}

export default MatriculaForm
