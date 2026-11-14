/* eslint-disable react-hooks/incompatible-library */
import { useState, useEffect } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  crearAnuncioSchema,
  actualizarAnuncioSchema,
  type CrearAnuncioInput,
  type ActualizarAnuncioInput,
  type AnuncioTipo,
  type RoleCode,
} from '@intranet/shared'
import { mensajeError } from '../shared/formato'
import { AdjuntosUpload } from '../shared/AdjuntosUpload'
import {
  listarNivelesCatalogo,
  listarGradosCatalogo,
  listarSeccionesCatalogo,
  listarAniosCatalogo,
  crearAnuncio,
  actualizarAnuncio,
} from './api'

interface AnuncioFormProps {
  /** Anuncio existente para editar (undefined = crear) */
  anuncio?: {
    id: string
    titulo: string
    cuerpo: string
    tipo: AnuncioTipo
    estado: 'BORRADOR' | 'PUBLICADO' | 'EXPIRADO' | 'ARCHIVADO'
    anioId: string | null
    audienciaNiveles: string[]
    audienciaGrados: string[]
    audienciaSecciones: string[]
    audienciaRoles: string[]
    expiraEn: string | null
    adjuntos: { id: string; nombreOriginal: string; url: string; tipoMime: string; tamanoBytes: number }[]
  }
  /** Callback al guardar exitoso */
  onGuardado: (mensaje?: string) => void
  /** Callback al cancelar */
  onCancelar: () => void
}

const ROLES_DISPONIBLES = [
  { value: 'SUPER_ADMIN', label: 'SuperAdmin' },
  { value: 'DIRECTOR', label: 'Director' },
  { value: 'DOCENTE', label: 'Docente' },
  { value: 'APODERADO', label: 'Apoderado' },
  { value: 'ALUMNO', label: 'Alumno' },
] as const

function parseFechaISO(fechaISO: string | null): string | undefined {
  if (!fechaISO) return undefined
  // Convert ISO datetime (2026-01-15T23:59:59.999Z) to datetime-local format (2026-01-15T23:59)
  if (fechaISO.includes('T')) {
    const parts = fechaISO.split('.')
    const base = parts[0] ?? ''
    return base.replace('Z', '')
  }
  // If it's already a date string (YYYY-MM-DD), return as is
  return fechaISO.split('T')[0] ?? undefined
}

export function AnuncioForm({ anuncio, onGuardado, onCancelar }: AnuncioFormProps) {
  const esEdicion = !!anuncio
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Catálogos
  const [niveles, setNiveles] = useState<{ id: string; nombre: string }[]>([])
  const [grados, setGrados] = useState<{ id: string; nombre: string; nivelId: string }[]>([])
  const [secciones, setSecciones] = useState<{ id: string; nombre: string; gradoId: string }[]>([])
  const [anios, setAnios] = useState<{ id: string; nombre: string }[]>([])
  const [cargandoCatalogos, setCargandoCatalogos] = useState(true)

  const [nivelSeleccionado, setNivelSeleccionado] = useState<string>('')

  // Grados filtrados por nivel
  const [gradoSeleccionado, setGradoSeleccionado] = useState<string>('')

  // Grados filtrados por nivel seleccionado
  const gradosFiltrados = grados.filter((g) => !nivelSeleccionado || g.nivelId === nivelSeleccionado)
  // Secciones filtradas por grado seleccionado
  const seccionesFiltradas = secciones.filter((s) => !gradoSeleccionado || s.gradoId === gradoSeleccionado)

  // Cargar catálogos al montar
  useEffect(() => {
    Promise.all([
      listarNivelesCatalogo(),
      listarGradosCatalogo(),
      listarSeccionesCatalogo(),
      listarAniosCatalogo(),
    ])
      .then(([n, g, s, a]) => {
        setNiveles(n)
        setGrados(g)
        setSecciones(s)
        setAnios(a)
      })
      .catch(() => setError('No se pudieron cargar los catálogos'))
      .finally(() => setCargandoCatalogos(false))
  }, [])

  const schema = esEdicion ? actualizarAnuncioSchema : crearAnuncioSchema
  type FormInput = ActualizarAnuncioInput

  const {
    register,
    handleSubmit,
    setValue,
    control,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormInput>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema as any),
    defaultValues: (esEdicion
      ? {
          titulo: anuncio!.titulo,
          cuerpo: anuncio!.cuerpo,
          tipo: anuncio!.tipo,
          estado: anuncio!.estado,
          anioId: anuncio!.anioId ?? undefined,
          audienciaNiveles: anuncio!.audienciaNiveles,
          audienciaGrados: anuncio!.audienciaGrados,
          audienciaSecciones: anuncio!.audienciaSecciones,
          audienciaRoles: anuncio!.audienciaRoles as RoleCode[],
          expiraEn: parseFechaISO(anuncio!.expiraEn),
        }
      : {
          estado: 'BORRADOR',
          anioId: null,
        }) as Partial<FormInput>,
    mode: 'onChange',
  })

  const tipo = watch('tipo')

  // Manejar cambios en nivel/grado para resetear selectores dependientes
  const nivelId = useWatch({ control, name: 'audienciaNiveles' })
  const gradoId = useWatch({ control, name: 'audienciaGrados' })

  // Cuando cambia el nivel, resetear grado y sección
  useEffect(() => {
    if (nivelId && Array.isArray(nivelId) && nivelId[0] !== nivelSeleccionado) {
      setNivelSeleccionado(nivelId[0] ?? '')
      setValue('audienciaGrados', [], { shouldValidate: true })
      setValue('audienciaSecciones', [], { shouldValidate: true })
      setGradoSeleccionado('')
    }
  }, [nivelId, nivelSeleccionado, setValue, setNivelSeleccionado, setGradoSeleccionado])

  // Cuando cambia el grado, resetear sección
  useEffect(() => {
    if (gradoId && Array.isArray(gradoId) && gradoId[0] !== gradoSeleccionado) {
      setGradoSeleccionado(gradoId[0] ?? '')
      setValue('audienciaSecciones', [], { shouldValidate: true })
    }
  }, [gradoId, gradoSeleccionado, setValue, setGradoSeleccionado])

  const handleSubmitForm = async (data: FormInput) => {
    setCargando(true)
    setError(null)

    try {
      if (esEdicion) {
        await actualizarAnuncio(anuncio!.id, data)
      } else {
        await crearAnuncio(data as CrearAnuncioInput)
      }
      onGuardado(esEdicion ? 'Anuncio actualizado' : 'Anuncio creado')
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setCargando(false)
    }
  }

  if (cargandoCatalogos) {
    return (
      <div className="p-8 text-center text-slate-500">
        Cargando catálogos...
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(handleSubmitForm)} className="space-y-6" noValidate>
      {/* Título */}
      <div>
        <label htmlFor="titulo" className="block text-sm font-medium text-slate-700 mb-1">
          Título <span className="text-red-500" aria-hidden="true">*</span>
        </label>
        <input
          id="titulo"
          {...register('titulo')}
          className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.titulo ? 'border-red-500' : 'border-slate-300'
          }`}
          aria-invalid={errors.titulo ? 'true' : 'false'}
          aria-describedby={errors.titulo ? 'titulo-error' : undefined}
          placeholder="Título del anuncio"
        />
        {errors.titulo && (
          <p id="titulo-error" className="mt-1 text-sm text-red-600" role="alert">
            {errors.titulo.message}
          </p>
        )}
      </div>

      {/* Cuerpo */}
      <div>
        <label htmlFor="cuerpo" className="block text-sm font-medium text-slate-700 mb-1">
          Cuerpo <span className="text-red-500" aria-hidden="true">*</span>
        </label>
        <textarea
          id="cuerpo"
          {...register('cuerpo')}
          rows={8}
          className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.cuerpo ? 'border-red-500' : 'border-slate-300'
          }`}
          aria-invalid={errors.cuerpo ? 'true' : 'false'}
          aria-describedby={errors.cuerpo ? 'cuerpo-error' : undefined}
          placeholder="Contenido del anuncio (soporta texto plano)..."
        />
        {errors.cuerpo && (
          <p id="cuerpo-error" className="mt-1 text-sm text-red-600" role="alert">
            {errors.cuerpo.message}
          </p>
        )}
        <p className="mt-1 text-xs text-slate-500">Máx. 10,000 caracteres. Se renderiza como texto plano.</p>
      </div>

      {/* Tipo */}
      <div>
        <label htmlFor="tipo" className="block text-sm font-medium text-slate-700 mb-1">
          Tipo <span className="text-red-500" aria-hidden="true">*</span>
        </label>
        <select
          id="tipo"
          {...register('tipo')}
          className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.tipo ? 'border-red-500' : 'border-slate-300'
          }`}
          aria-invalid={errors.tipo ? 'true' : 'false'}
        >
          <option value="">Seleccionar tipo...</option>
          <option value="INSTITUCIONAL">Institucional (con segmentación)</option>
          <option value="SECCION">De sección (solo para tutores)</option>
        </select>
        {errors.tipo && (
          <p className="mt-1 text-sm text-red-600" role="alert">{errors.tipo.message}</p>
        )}
      </div>

      {/* Estado: al crear solo se permite borrador o publicación (RF-COM-001) */}
      <div>
        <label htmlFor="estado" className="block text-sm font-medium text-slate-700 mb-1">
          Estado
        </label>
        <select
          id="estado"
          {...register('estado')}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="BORRADOR">Borrador</option>
          <option value="PUBLICADO">Publicado</option>
          {esEdicion && <option value="EXPIRADO">Expirado</option>}
          {esEdicion && <option value="ARCHIVADO">Archivado</option>}
        </select>
      </div>

      {/* Segmentación de audiencia (solo para INSTITUCIONAL) */}
      {tipo === 'INSTITUCIONAL' && (
        <fieldset className="border border-slate-200 rounded-lg p-4 space-y-4">
          <legend className="px-1 text-sm font-medium text-slate-700">
            Audiencia (requerida para institucional)
          </legend>
          <p className="text-sm text-slate-500">
            Selecciona al menos una audiencia. El anuncio será visible para los usuarios que coincidan.
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Niveles */}
            <div>
              <label htmlFor="niveles" className="block text-sm font-medium text-slate-700 mb-1">
                Niveles
              </label>
              <select
                id="niveles"
                {...register('audienciaNiveles')}
                multiple
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                onChange={(e) => {
                  const seleccionados = Array.from(e.target.selectedOptions).map((o) => o.value)
                  setValue('audienciaNiveles', seleccionados)
                  setNivelSeleccionado(seleccionados[0] ?? '')
                  setValue('audienciaGrados', [], { shouldValidate: true })
                  setValue('audienciaSecciones', [], { shouldValidate: true })
                }}
              >
                {niveles.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.nombre}
                  </option>
                ))}
              </select>
            </div>

            {/* Grados */}
            <div>
              <label htmlFor="grados" className="block text-sm font-medium text-slate-700 mb-1">
                Grados
              </label>
              <select
                id="grados"
                {...register('audienciaGrados')}
                multiple
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  !nivelSeleccionado ? 'bg-slate-50 cursor-not-allowed' : ''
                }`}
                disabled={!nivelSeleccionado}
              >
                {gradosFiltrados.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nombre}
                  </option>
                ))}
              </select>
              {!nivelSeleccionado && (
                <p className="mt-1 text-xs text-slate-500">Selecciona primero un nivel</p>
              )}
            </div>

            {/* Secciones */}
            <div>
              <label htmlFor="secciones" className="block text-sm font-medium text-slate-700 mb-1">
                Secciones
              </label>
              <select
                id="secciones"
                {...register('audienciaSecciones')}
                multiple
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  !gradoSeleccionado ? 'bg-slate-50 cursor-not-allowed' : ''
                }`}
                disabled={!gradoSeleccionado}
              >
                {seccionesFiltradas.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
              </select>
              {!gradoSeleccionado && (
                <p className="mt-1 text-xs text-slate-500">Selecciona primero un grado</p>
              )}
            </div>

            {/* Roles */}
            <div>
              <label htmlFor="roles" className="block text-sm font-medium text-slate-700 mb-1">
                Roles
              </label>
              <select
                id="roles"
                {...register('audienciaRoles')}
                multiple
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {ROLES_DISPONIBLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {errors.audienciaNiveles && (
            <p className="text-sm text-red-600" role="alert">{errors.audienciaNiveles.message}</p>
          )}
        </fieldset>
      )}

      {/* Año académico (solo para INSTITUCIONAL) */}
      {tipo === 'INSTITUCIONAL' && (
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
          >
            <option value="">Seleccionar año académico...</option>
            {anios.map((anio) => (
              <option key={anio.id} value={anio.id}>
                {anio.nombre}
              </option>
            ))}
          </select>
          {errors.anioId && (
            <p id="anioId-error" className="mt-1 text-sm text-red-600" role="alert">
              {errors.anioId.message}
            </p>
          )}
        </div>
      )}

      {/* Expiración (solo para INSTITUCIONAL) */}
      {tipo === 'INSTITUCIONAL' && (
        <div>
          <label htmlFor="expiraEn" className="block text-sm font-medium text-slate-700 mb-1">
            Fecha de expiración (opcional)
          </label>
          <input
            id="expiraEn"
            type="datetime-local"
            {...register('expiraEn')}
            className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.expiraEn ? 'border-red-500' : 'border-slate-300'
            }`}
            aria-invalid={errors.expiraEn ? 'true' : 'false'}
            aria-describedby={errors.expiraEn ? 'expiraEn-error' : undefined}
          />
          {errors.expiraEn && (
            <p id="expiraEn-error" className="mt-1 text-sm text-red-600" role="alert">
              {errors.expiraEn.message}
            </p>
          )}
        </div>
      )}

      {/* Expiración (solo para INSTITUCIONAL) */}

      {/* Adjuntos */}
      <AdjuntosUpload
        adjuntosExistentes={anuncio?.adjuntos?.map((a) => ({
          id: a.id,
          nombreOriginal: a.nombreOriginal,
          url: a.url,
          tipoMime: a.tipoMime,
          tamanoBytes: a.tamanoBytes,
        })) ?? []}
        onAgregar={() => {}}
        onEliminar={() => {}}
        maxArchivos={5}
        deshabilitado={cargando}
      />

      {/* Acciones */}
      <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
        <button
          type="button"
          onClick={onCancelar}
          disabled={cargando || isSubmitting}
          className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700 disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={cargando || isSubmitting}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {cargando || isSubmitting ? 'Guardando...' : esEdicion ? 'Actualizar' : 'Crear anuncio'}
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm" role="alert">
          {error}
        </div>
      )}
    </form>
  )
}

export default AnuncioForm