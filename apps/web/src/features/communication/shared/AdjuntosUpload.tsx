import { useState, type ChangeEvent, type DragEvent } from 'react'
import { TIPOS_MIME_PERMITIDOS, TAMANO_MAXIMO_BYTES, esTipoMimePermitido, esTamanoValido } from '@intranet/shared'

export interface AdjuntoTemporal {
  id: string
  archivo: File
  preview: string | null
  error: string | null
  subiendo: boolean
}

export interface AdjuntosUploadProps {
  /** Archivos ya subidos (para mostrar en lista) */
  adjuntosExistentes?: { id: string; nombreOriginal: string; url: string; tipoMime: string; tamanoBytes: number }[]
  /** Callback cuando se añade un archivo válido */
  onAgregar: (archivo: File) => void
  /** Callback cuando se elimina un archivo temporal */
  onEliminar: (id: string) => void
  /** Deshabilita el componente */
  deshabilitado?: boolean
  /** Texto personalizado para el área de drop */
  textoDrop?: string
  /** Límite de archivos (0 = sin límite) */
  maxArchivos?: number
}

/**
 * Componente para subir múltiples archivos con drag & drop y validación cliente.
 *
 * Valida:
 * - Tipo MIME contra lista blanca (`TIPOS_MIME_PERMITIDOS`)
 * - Tamaño máximo (`TAMANO_MAXIMO_BYTES`, por defecto 10 MB)
 * - Límite de cantidad de archivos
 */
export function AdjuntosUpload({
  adjuntosExistentes = [],
  onAgregar,
  onEliminar,
  deshabilitado = false,
  textoDrop = 'Arrastra archivos aquí o haz clic para seleccionar',
  maxArchivos = 0,
}: AdjuntosUploadProps) {
  const [arrastrando, setArrastrando] = useState(false)
  const [temporales, setTemporales] = useState<Array<{
    id: string
    archivo: File
    preview: string | null
    error: string | null
  }>>([])

  // Generar preview para imágenes
  const generarPreview = (archivo: File): string | null => {
    if (archivo.type.startsWith('image/')) {
      return URL.createObjectURL(archivo)
    }
    return null
  }

  // Validar un archivo
  const validarArchivo = (archivo: File): string | null => {
    if (!esTipoMimePermitido(archivo.type)) {
      return `Tipo de archivo no permitido: ${archivo.type}. Permitidos: ${TIPOS_MIME_PERMITIDOS.join(', ')}`
    }
    if (!esTamanoValido(archivo.size)) {
      return `Archivo demasiado grande (${(archivo.size / 1024 / 1024).toFixed(1)} MB). Máximo: ${TAMANO_MAXIMO_BYTES / 1024 / 1024} MB`
    }
    return null
  }

  const procesarArchivos = (archivos: FileList | File[]) => {
    const nuevos: Array<{ id: string; archivo: File; preview: string | null; error: string | null }> = []

    for (const archivo of Array.from(archivos)) {
      const error = validarArchivo(archivo)

      if (maxArchivos > 0 && temporales.length + adjuntosExistentes.length + nuevos.length >= maxArchivos) {
        nuevos.push({
          id: `temp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          archivo,
          preview: null,
          error: `Límite de ${maxArchivos} archivo(s) alcanzado.`,
        })
        continue
      }

      nuevos.push({
        id: `temp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        archivo,
        preview: generarPreview(archivo),
        error,
      })
    }

    setTemporales((actuales) => [...actuales, ...nuevos])

    // Notificar al padre solo los válidos
    nuevos.filter((t) => !t.error).forEach((t) => onAgregar(t.archivo))
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setArrastrando(false)

    if (deshabilitado) return
    if (!e.dataTransfer?.files?.length) return

    procesarArchivos(e.dataTransfer.files)
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (!deshabilitado) setArrastrando(true)
  }

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setArrastrando(false)
  }

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return
    procesarArchivos(e.target.files)
    e.target.value = '' // Permitir seleccionar el mismo archivo de nuevo
  }

  const eliminarTemporal = (id: string) => {
    const temporal = temporales.find((t) => t.id === id)
    if (temporal?.preview) URL.revokeObjectURL(temporal.preview)
    setTemporales((actuales) => actuales.filter((t) => t.id !== id))
    onEliminar(id)
  }

  const totalArchivos = temporales.length + adjuntosExistentes.length
  const hayLimite = maxArchivos > 0 && totalArchivos >= maxArchivos

  return (
    <div className="space-y-4">
      {/* Área de drop */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`
          border-2 border-dashed rounded-lg p-6 text-center transition-colors
          ${deshabilitado ? 'bg-slate-50 border-slate-200 cursor-not-allowed' : ''}
          ${arrastrando && !deshabilitado ? 'border-blue-500 bg-blue-50' : 'border-slate-300'}
          ${hayLimite ? 'border-amber-500 bg-amber-50' : ''}
        `}
        role="button"
        tabIndex={deshabilitado ? -1 : 0}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !deshabilitado) {
            e.preventDefault()
            document.getElementById('file-input')?.click()
          }
        }}
      >
        <input
          id="file-input"
          type="file"
          multiple
          accept={TIPOS_MIME_PERMITIDOS.join(',')}
          onChange={handleFileChange}
          className="hidden"
          disabled={deshabilitado || hayLimite}
          aria-label="Seleccionar archivos"
        />
        <label htmlFor="file-input" className="cursor-pointer">
          <div className="space-y-2">
            <svg
              className="mx-auto h-12 w-12 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M7 16a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-1 1H8a1 1 0 01-1-1v-3z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M3 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M14 10a1 1 0 01-1.414-1.414L9 4.586A1 1 0 007.586 6H5a1 1 0 000 2h2.586l2.293 2.293a1 1 0 001.414 0l4.707 4.707a1 1 0 001.414-1.414z"
              />
            </svg>
            <p className="text-lg font-medium text-slate-700">{textoDrop}</p>
            <p className="text-sm text-slate-500">
              Tipos permitidos: {TIPOS_MIME_PERMITIDOS.map((t) => (t.split('/')[1] ?? t).toUpperCase()).join(', ')} • Máx. {TAMANO_MAXIMO_BYTES / 1024 / 1024} MB
            </p>
            {hayLimite && (
              <p className="text-sm text-amber-600 font-medium">
                Límite de {maxArchivos} archivo(s) alcanzado.
              </p>
            )}
            {deshabilitado && (
              <p className="text-sm text-slate-500">Subida deshabilitada.</p>
            )}
          </div>
        </label>
      </div>

      {/* Lista de archivos temporales (pendientes) */}
      {temporales.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-slate-700">Pendientes de subida</h4>
          <div className="space-y-2">
            {temporales.map((temporal) => (
              <div
                key={temporal.id}
                className={`flex items-center gap-3 p-3 rounded-lg border ${
                  temporal.error ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-white'
                }`}
              >
                {temporal.preview ? (
                  <img
                    src={temporal.preview}
                    alt={temporal.archivo.name}
                    className="w-12 h-12 object-cover rounded"
                  />
                ) : (
                  <div className="w-12 h-12 flex items-center justify-center bg-slate-100 rounded">
                    <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.172 7l-6.586 6.586a1 1 0 101.414 1.414l6.586-6.586a1 1 0 00-1.414-1.414z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{temporal.archivo.name}</p>
                  <p className="text-xs text-slate-500">
                    {(temporal.archivo.size / 1024).toFixed(1)} KB • {temporal.archivo.type}
                  </p>
                  {temporal.error && (
                    <p className="text-xs text-red-600 mt-1">{temporal.error}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => eliminarTemporal(temporal.id)}
                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                  aria-label={`Eliminar ${temporal.archivo.name}`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Archivos existentes (ya subidos) */}
      {adjuntosExistentes.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-slate-700">Archivos adjuntos</h4>
          <div className="space-y-2">
            {adjuntosExistentes.map((adjunto) => (
              <div
                key={adjunto.id}
                className="flex items-center gap-3 p-3 border border-slate-200 bg-white rounded-lg"
              >
                <div className="w-12 h-12 flex items-center justify-center bg-slate-100 rounded">
                  <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.172 7l-6.586 6.586a1 1 0 101.414 1.414l6.586-6.586a1 1 0 00-1.414-1.414z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <a
                    href={adjunto.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-slate-900 truncate hover:text-blue-600"
                  >
                    {adjunto.nombreOriginal}
                  </a>
                  <p className="text-xs text-slate-500">
                    {(adjunto.tamanoBytes / 1024).toFixed(1)} KB • {adjunto.tipoMime}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onEliminar(adjunto.id)}
                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                  aria-label={`Eliminar ${adjunto.nombreOriginal}`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Indicador de límite */}
      {maxArchivos > 0 && (
        <p className={`text-xs text-center ${totalArchivos >= maxArchivos ? 'text-amber-600' : 'text-slate-500'}`}>
          {totalArchivos} / {maxArchivos} archivo(s)
        </p>
      )}
    </div>
  )
}