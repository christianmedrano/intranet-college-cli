import { type MaterialResponsePayload } from '@intranet/shared'
import { useState } from 'react'
import { prepararDescargaMaterial, prepararDescargaAdjunto } from './api'
import { formatoFecha, formatoTamanio, mensajeError } from '../shared'

interface MaterialDetalleProps {
  material: MaterialResponsePayload
  anioId: string
  onEditar: () => void
  onCerrar: () => void
  puedeEliminar: boolean
  onEliminar: () => void
}

export function MaterialDetalle({
  material,
  anioId,
  onEditar,
  onCerrar,
  puedeEliminar,
  onEliminar,
}: MaterialDetalleProps) {
  const [descargando, setDescargando] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function descargarArchivo() {
    try {
      setDescargando('principal')
      const info = await prepararDescargaMaterial(material.id, anioId)
      // Trigger download
      const link = document.createElement('a')
      link.href = info.url
      link.download = info.archivoNombre
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setDescargando(null)
    }
  }

  async function descargarAdjunto(adjuntoId: string) {
    try {
      setDescargando(adjuntoId)
      const info = await prepararDescargaAdjunto(material.id, adjuntoId)
      const link = document.createElement('a')
      link.href = info.url
      link.download = info.nombreOriginal
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setDescargando(null)
    }
  }

  function esImagen(mime: string): boolean {
    return mime.startsWith('image/')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-xl font-semibold">{material.titulo}</h4>
          <p className="mt-1 text-sm text-slate-500">
            {material.cursoId} / {material.seccionId} / {material.periodoId}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cerrar
          </button>
          <button
            type="button"
            onClick={onEditar}
            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Editar
          </button>
          {puedeEliminar && (
            <button
              type="button"
              onClick={onEliminar}
              className="rounded-md border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
            >
              Eliminar
            </button>
          )}
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <section aria-labelledby="material-desc" className="space-y-2">
        <h5 id="material-desc" className="text-sm font-medium text-slate-700">Descripción</h5>
        <p className="text-sm text-slate-600 whitespace-pre-wrap">
          {material.descripcion ?? '— Sin descripción —'}
        </p>
      </section>

      <section aria-labelledby="material-meta" className="space-y-2 border-t border-slate-200 pt-4">
        <h5 id="material-meta" className="text-sm font-medium text-slate-700">Metadatos</h5>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-slate-500">Curso</dt>
            <dd className="font-mono text-slate-700">{material.cursoId}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Sección</dt>
            <dd className="font-mono text-slate-700">{material.seccionId}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Período</dt>
            <dd className="font-mono text-slate-700">{material.periodoId}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Docente</dt>
            <dd className="font-mono text-slate-700">{material.docenteId}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Archivo principal</dt>
            <dd className="font-mono text-slate-700 truncate">{material.archivoNombre}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Tipo</dt>
            <dd className="font-mono text-slate-700">{material.archivoMime}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Tamaño</dt>
            <dd className="font-mono text-slate-700">{formatoTamanio(material.tamanoBytes)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Creado</dt>
            <dd className="text-slate-700">{formatoFecha(material.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Actualizado</dt>
            <dd className="text-slate-700">{formatoFecha(material.updatedAt)}</dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="material-adjuntos" className="space-y-3">
        <h5 id="material-adjuntos" className="text-sm font-medium text-slate-700">
          Adjuntos ({material.adjuntos.length})
        </h5>
        {material.adjuntos.length === 0 ? (
          <p className="text-sm text-slate-500">No hay adjuntos adicionales.</p>
        ) : (
          <ul className="space-y-2" role="list">
            {material.adjuntos.map((adjunto) => (
              <li key={adjunto.id} className="flex flex-wrap items-center gap-3 p-3 border border-slate-200 bg-white rounded-lg">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {esImagen(adjunto.tipoMime) ? (
                    <img
                      src={adjunto.url}
                      alt={adjunto.nombreOriginal}
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
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900 truncate">{adjunto.nombreOriginal}</p>
                    <p className="text-xs text-slate-500">
                      {adjunto.tipoMime} • {formatoTamanio(adjunto.tamanoBytes)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => descargarAdjunto(adjunto.id)}
                  disabled={descargando === adjunto.id}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  {descargando === adjunto.id ? (
                    <span className="flex items-center gap-1">
                      <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Descargando…
                    </span>
                  ) : (
                    'Descargar'
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="material-download" className="space-y-2 border-t border-slate-200 pt-4">
        <h5 id="material-download" className="text-sm font-medium text-slate-700">Descargar archivo principal</h5>
        <button
          type="button"
          onClick={descargarArchivo}
          disabled={descargando === 'principal'}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          {descargando === 'principal' ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Preparando descarga…
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Descargar {material.archivoNombre}
            </span>
          )}
        </button>
        <p className="text-xs text-slate-500">
          {material.archivoMime} • {formatoTamanio(material.tamanoBytes)}
        </p>
      </section>
    </div>
  )
}