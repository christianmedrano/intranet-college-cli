import { useState, useEffect, type ChangeEvent } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  tipoMimeVirtualSchema,
  type CrearMaterialInput,
  type ActualizarMaterialInput,
  TIPOS_MIME_PERMITIDOS,
  TAMANO_MAXIMO_BYTES_VIR,
} from '@intranet/shared'
import { z } from 'zod'
import { AdjuntosUpload } from '../shared'
import { mensajeError, formatoTamanio } from '../shared'
import { subirAdjunto, crearMaterial, actualizarMaterial, eliminarAdjunto, obtenerMaterial } from './api'

/** Esquema para el formulario: permite strings vacíos en selects/archivoMime, valida en submit. */
const crearMaterialFormSchema = z.object({
  cursoId: z.string().uuid('Curso inválido'),
  seccionId: z.string().uuid('Sección inválida'),
  periodoId: z.string().uuid('Período inválido'),
  titulo: z.string().min(1, 'El título es obligatorio').max(200, 'El título es demasiado largo'),
  descripcion: z.string().max(5000, 'La descripción es demasiado larga').optional(),
  archivoNombre: z.string().min(1, 'El nombre del archivo es obligatorio'),
  archivoMime: tipoMimeVirtualSchema.or(z.literal('')),
  tamanoBytes: z.number().int().positive('El tamaño debe ser positivo'),
}).refine(
  (data) => data.tamanoBytes <= 10 * 1024 * 1024,
  { message: 'El archivo supera el tamaño máximo permitido (10 MB)', path: ['tamanoBytes'] },
).refine(
  (data) => data.archivoMime !== '',
  { message: 'Debe seleccionar un archivo', path: ['archivoMime'] },
)

const actualizarMaterialFormSchema = z.object({
  cursoId: z.string().uuid('Curso inválido').optional(),
  seccionId: z.string().uuid('Sección inválida').optional(),
  periodoId: z.string().uuid('Período inválido').optional(),
  titulo: z.string().min(1, 'El título es obligatorio').max(200, 'El título es demasiado largo').optional(),
  descripcion: z.string().max(5000, 'La descripción es demasiado larga').optional(),
  archivoNombre: z.string().min(1, 'El nombre del archivo es obligatorio').optional(),
  archivoMime: tipoMimeVirtualSchema.optional(),
  tamanoBytes: z.number().int().positive('El tamaño debe ser positivo').optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'Debe enviar al menos un campo para actualizar',
})

type CrearMaterialFormInput = z.infer<typeof crearMaterialFormSchema>
type ActualizarMaterialFormInput = z.infer<typeof actualizarMaterialFormSchema>

interface MaterialFormProps {
  /** Material existente para editar (si no se pasa, es creación) */
  materialId?: string
  /** ID del año académico */
  anioId: string
  /** Cursos disponibles para el selector */
  cursos: { id: string; nombre: string }[]
  /** Secciones disponibles para el selector */
  secciones: { id: string; nombre: string }[]
  /** Períodos disponibles para el selector */
  periodos: { id: string; nombre: string }[]
  /** Callback al guardar exitoso */
  onGuardado: (mensaje?: string) => void
  /** Callback al cancelar */
  onCancelar: () => void
}

export function MaterialForm({
  materialId,
  anioId,
  cursos,
  secciones,
  periodos,
  onGuardado,
  onCancelar,
}: MaterialFormProps) {
  const esEdicion = !!materialId
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [archivo, setArchivo] = useState<File | null>(null)
  const [adjuntos, setAdjuntos] = useState<Array<{
    id: string
    nombreOriginal: string
    url: string
    tipoMime: string
    tamanoBytes: number
  }>>([])

  // Seleccionar esquema según modo
  const schema = esEdicion ? actualizarMaterialFormSchema : crearMaterialFormSchema

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CrearMaterialFormInput | ActualizarMaterialFormInput>({
    resolver: zodResolver(schema),
    defaultValues: {
      titulo: '',
      descripcion: '',
      archivoNombre: '',
      archivoMime: '',
      tamanoBytes: 0,
    },
    mode: 'onChange',
  })

  // Cargar material existente si es edición
  const [materialCargado, setMaterialCargado] = useState(false)
  useEffect(() => {
    if (esEdicion && !materialCargado) {
      obtenerMaterial(materialId!, anioId)
        .then((material) => {
          setValue('cursoId', material.cursoId)
          setValue('seccionId', material.seccionId)
          setValue('periodoId', material.periodoId)
          setValue('titulo', material.titulo)
          setValue('descripcion', material.descripcion ?? '')
          setValue('archivoNombre', material.archivoNombre)
          setValue('archivoMime', material.archivoMime as CrearMaterialFormInput['archivoMime'])
          setValue('tamanoBytes', material.tamanoBytes)
          setAdjuntos(material.adjuntos)
          setMaterialCargado(true)
        })
        .catch(() => {
          setError('No se pudo cargar el material.')
        })
    }
  }, [esEdicion, materialId, anioId, materialCargado, setValue])

  // Manejo de archivo
  const handleArchivoChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validar MIME type
    const mimeResult = tipoMimeVirtualSchema.safeParse(file.type)
    if (!mimeResult.success) {
      setError(`Tipo de archivo no permitido: ${file.type}`)
      return
    }

    setArchivo(file)
    setValue('archivoNombre', file.name)
    setValue('archivoMime', mimeResult.data)
    setValue('tamanoBytes', file.size)
    setError(null)
  }

  // Subir adjunto
  const handleSubirAdjunto = async (file: File) => {
    try {
      const nuevo = await subirAdjunto(materialId!, file)
      setAdjuntos((prev) => [...prev, nuevo])
    } catch (err) {
      setError(mensajeError(err))
    }
  }

  // Eliminar adjunto
  const handleEliminarAdjunto = async (adjuntoId: string) => {
    if (!materialId) return
    try {
      await eliminarAdjunto(materialId, adjuntoId)
      setAdjuntos((prev) => prev.filter((a) => a.id !== adjuntoId))
    } catch (err) {
      setError(mensajeError(err))
    }
  }

  // Enviar formulario
  const onSubmit = async (data: CrearMaterialFormInput | ActualizarMaterialFormInput) => {
    if (!data.archivoNombre && !esEdicion) {
      setError('Debe seleccionar un archivo.')
      return
    }

    // Convertir a tipos estrictos para la API
    // En onSubmit, los campos requeridos ya fueron validados por el schema del formulario
    // Podemos hacer cast seguro sabiendo que no están vacíos
    const apiData: CrearMaterialInput | ActualizarMaterialInput = {
      ...data,
      cursoId: data.cursoId as string,
      seccionId: data.seccionId as string,
      periodoId: data.periodoId as string,
      archivoMime: data.archivoMime as CrearMaterialInput['archivoMime'],
    }

    setCargando(true)
    setError(null)

    try {
      if (esEdicion) {
        await actualizarMaterial(materialId!, apiData as ActualizarMaterialInput)
      } else {
        await crearMaterial(apiData as CrearMaterialInput)
      }
      onGuardado()
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setCargando(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700" role="alert">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label htmlFor="titulo" className="block text-sm font-medium text-slate-700">
            Título <span className="text-red-500" aria-hidden="true">*</span>
          </label>
          <input
            {...register('titulo')}
            id="titulo"
            type="text"
            maxLength={200}
            className={`mt-1 block w-full rounded-lg border px-3 py-2 text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:ring-blue-500 ${
              errors.titulo ? 'border-red-500' : 'border-slate-300'
            }`}
            aria-invalid={errors.titulo ? 'true' : 'false'}
            aria-describedby={errors.titulo ? 'titulo-error' : undefined}
          />
          {errors.titulo && (
            <p id="titulo-error" className="mt-1 text-sm text-red-600" role="alert">
              {errors.titulo.message}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="cursoId" className="block text-sm font-medium text-slate-700">
            Curso <span className="text-red-500" aria-hidden="true">*</span>
          </label>
          <input
            {...register('cursoId')}
            id="cursoId"
            type="text"
            list="material-cursos"
            placeholder="Identificador del curso"
            className={`mt-1 block w-full rounded-lg border px-3 py-2 text-slate-900 focus:border-blue-500 focus:ring-blue-500 ${
              errors.cursoId ? 'border-red-500' : 'border-slate-300'
            }`}
            aria-invalid={errors.cursoId ? 'true' : 'false'}
          />
          <datalist id="material-cursos">
            {cursos.map((curso) => (
              <option key={curso.id} value={curso.id}>
                {curso.nombre}
              </option>
            ))}
          </datalist>
          {errors.cursoId && (
            <p className="mt-1 text-sm text-red-600" role="alert">{errors.cursoId.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="seccionId" className="block text-sm font-medium text-slate-700">
            Sección <span className="text-red-500" aria-hidden="true">*</span>
          </label>
          <input
            {...register('seccionId')}
            id="seccionId"
            type="text"
            list="material-secciones"
            placeholder="Identificador de la sección"
            className={`mt-1 block w-full rounded-lg border px-3 py-2 text-slate-900 focus:border-blue-500 focus:ring-blue-500 ${
              errors.seccionId ? 'border-red-500' : 'border-slate-300'
            }`}
            aria-invalid={errors.seccionId ? 'true' : 'false'}
          />
          <datalist id="material-secciones">
            {secciones.map((seccion) => (
              <option key={seccion.id} value={seccion.id}>
                {seccion.nombre}
              </option>
            ))}
          </datalist>
          {errors.seccionId && (
            <p className="mt-1 text-sm text-red-600" role="alert">{errors.seccionId.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="periodoId" className="block text-sm font-medium text-slate-700">
            Período <span className="text-red-500" aria-hidden="true">*</span>
          </label>
          <input
            {...register('periodoId')}
            id="periodoId"
            type="text"
            list="material-periodos"
            placeholder="Identificador del período"
            className={`mt-1 block w-full rounded-lg border px-3 py-2 text-slate-900 focus:border-blue-500 focus:ring-blue-500 ${
              errors.periodoId ? 'border-red-500' : 'border-slate-300'
            }`}
            aria-invalid={errors.periodoId ? 'true' : 'false'}
          />
          <datalist id="material-periodos">
            {periodos.map((periodo) => (
              <option key={periodo.id} value={periodo.id}>
                {periodo.nombre}
              </option>
            ))}
          </datalist>
          {errors.periodoId && (
            <p className="mt-1 text-sm text-red-600" role="alert">{errors.periodoId.message}</p>
          )}
        </div>

        <div className="md:col-span-2">
          <label htmlFor="descripcion" className="block text-sm font-medium text-slate-700">
            Descripción
          </label>
          <textarea
            {...register('descripcion')}
            id="descripcion"
            rows={3}
            maxLength={5000}
            className={`mt-1 block w-full rounded-lg border px-3 py-2 text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:ring-blue-500 ${
              errors.descripcion ? 'border-red-500' : 'border-slate-300'
            }`}
            aria-invalid={errors.descripcion ? 'true' : 'false'}
            aria-describedby={errors.descripcion ? 'descripcion-error' : undefined}
          />
          {errors.descripcion && (
            <p id="descripcion-error" className="mt-1 text-sm text-red-600" role="alert">
              {errors.descripcion.message}
            </p>
          )}
        </div>

        <div className="md:col-span-2">
          <fieldset>
            <legend className="block text-sm font-medium text-slate-700">
              Archivo <span className="text-red-500" aria-hidden="true">{!esEdicion ? '*' : ''}</span>
            </legend>
            <div className="mt-2 space-y-4">
              <div>
                <label htmlFor="archivo" className="sr-only">
                  Seleccionar archivo
                </label>
                <input
                  type="file"
                  id="archivo"
                  accept={TIPOS_MIME_PERMITIDOS.join(',')}
                  onChange={handleArchivoChange}
                  disabled={esEdicion && !archivo} // En edición, solo si se va a cambiar
                  className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  aria-describedby="archivo-ayuda"
                />
                <p id="archivo-ayuda" className="text-xs text-slate-500">
                  Tipos permitidos: PDF, DOCX, XLSX, PPTX, JPEG, PNG, WEBP • Máx. {TAMANO_MAXIMO_BYTES_VIR / 1024 / 1024} MB
                </p>
                {archivo && (
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                    <span className="text-sm font-medium text-slate-900 truncate flex-1">
                      {archivo.name}
                    </span>
                    <span className="text-sm text-slate-500">
                      {formatoTamanio(archivo.size)}
                    </span>
                    <span className="text-sm text-slate-500">
                      {archivo.type}
                    </span>
                  </div>
                )}
                {errors.archivoNombre && (
                  <p className="text-sm text-red-600" role="alert">
                    {errors.archivoNombre.message}
                  </p>
                )}
                {errors.archivoMime && (
                  <p className="text-sm text-red-600" role="alert">
                    {errors.archivoMime.message}
                  </p>
                )}
                {errors.tamanoBytes && (
                  <p className="text-sm text-red-600" role="alert">
                    {errors.tamanoBytes.message}
                  </p>
                )}
              </div>

              {/* Adjuntos adicionales (solo en edición o después de crear) */}
              {(esEdicion || materialId) && (
                <AdjuntosUpload
                  adjuntosExistentes={adjuntos}
                  onAgregar={handleSubirAdjunto}
                  onEliminar={handleEliminarAdjunto}
                  deshabilitado={cargando}
                  textoDrop="Arrastra adjuntos adicionales o haz clic para seleccionar"
                  maxArchivos={10}
                />
              )}
            </div>
          </fieldset>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
        <button
          type="button"
          onClick={onCancelar}
          disabled={cargando}
          className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-500"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={cargando || isSubmitting}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {cargando || isSubmitting ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Guardando...
            </span>
          ) : (
            esEdicion ? 'Actualizar' : 'Crear'
          )}
        </button>
      </div>
    </form>
  )
}