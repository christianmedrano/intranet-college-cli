import { useEffect, useState, useRef } from 'react'
import { useParams, Link } from 'react-router'
import { useAuth } from '../../auth/useAuth'
import {
  obtenerAnuncio,
  type AnuncioResponsePayload,
} from './api'
import {
  formatoFechaHora,
  mensajeError,
} from '../shared/formato'

export function AnuncioDetalle() {
  const { id } = useParams<{ id: string }>()
  useAuth()
  const [anuncio, setAnuncio] = useState<AnuncioResponsePayload | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    if (!id) return
    obtenerAnuncio(id)
      .then(setAnuncio)
      .catch((err) => {
        if (mountedRef.current) setError(mensajeError(err))
      })
      .finally(() => {
        if (mountedRef.current) setCargando(false)
      })
    return () => {
      mountedRef.current = false
    }
  }, [id])

  if (cargando) {
    return (
      <div className="p-8 text-center text-slate-500">
        Cargando anuncio...
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8 text-center text-red-600">
        {error}
      </div>
    )
  }

  if (!anuncio) {
    return (
      <div className="p-8 text-center text-slate-500">
        Anuncio no encontrado.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link to="/anuncios" className="text-blue-600 hover:underline text-sm">
          ← Volver a anuncios
        </Link>
        {anuncio.estado !== 'ARCHIVADO' && (
          <a
            href={`/anuncios/${anuncio.id}/editar`}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            Editar
          </a>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-slate-900">{anuncio.titulo}</h1>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <span
                className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                  anuncio.tipo === 'INSTITUCIONAL'
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-green-100 text-green-800'
                }`}
              >
                {anuncio.tipo}
              </span>
              <span
                className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                  anuncio.estado === 'PUBLICADO'
                    ? 'bg-emerald-100 text-emerald-800'
                    : anuncio.estado === 'BORRADOR'
                    ? 'bg-slate-100 text-slate-800'
                    : anuncio.estado === 'EXPIRADO'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                {anuncio.estado}
              </span>
            </div>
          </div>
          {anuncio.estado !== 'ARCHIVADO' && (
            <a
              href={`/anuncios/${anuncio.id}/editar`}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium whitespace-nowrap"
            >
              Editar
            </a>
          )}
        </div>

        <div className="prose prose-slate max-w-none">
          <p className="whitespace-pre-wrap">{anuncio.cuerpo}</p>
        </div>

        <div className="border-t border-slate-200 pt-4 space-y-2 text-sm text-slate-600">
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-900">Autor:</span>
            <span>{anuncio.autorId}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-900">Creado:</span>
            <span>{formatoFechaHora(anuncio.createdAt)}</span>
          </div>
          {anuncio.publicadoEn && (
            <div className="flex items-center gap-2">
              <span className="font-medium text-slate-900">Publicado:</span>
              <span>{formatoFechaHora(anuncio.publicadoEn)}</span>
            </div>
          )}
          {anuncio.expiraEn && (
            <div className="flex items-center gap-2">
              <span className="font-medium text-slate-900">Expira:</span>
              <span>{formatoFechaHora(anuncio.expiraEn)}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-900">Tipo:</span>
            <span className="capitalize">{anuncio.tipo.toLowerCase()}</span>
          </div>
          {anuncio.audienciaNiveles.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="font-medium text-slate-900">Niveles:</span>
              <span>{anuncio.audienciaNiveles.length} seleccionado(s)</span>
            </div>
          )}
          {anuncio.audienciaGrados.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="font-medium text-slate-900">Grados:</span>
              <span>{anuncio.audienciaGrados.length} seleccionado(s)</span>
            </div>
          )}
          {anuncio.audienciaSecciones.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="font-medium text-slate-900">Secciones:</span>
              <span>{anuncio.audienciaSecciones.length} seleccionado(s)</span>
            </div>
          )}
          {anuncio.audienciaRoles.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="font-medium text-slate-900">Roles:</span>
              <span>{anuncio.audienciaRoles.join(', ')}</span>
            </div>
          )}
        </div>

        {/* Adjuntos */}
        {anuncio.adjuntos.length > 0 && (
          <div className="border-t border-slate-200 pt-4">
            <h3 className="text-lg font-semibold text-slate-900">Adjuntos</h3>
            <div className="space-y-2 mt-2">
              {anuncio.adjuntos.map((adjunto) => (
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
                  <a
                    href={adjunto.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 min-w-0 text-sm font-medium text-slate-900 truncate hover:text-blue-600"
                  >
                    {adjunto.nombreOriginal}
                  </a>
                  <span className="text-xs text-slate-500 whitespace-nowrap">
                    {(adjunto.tamanoBytes / 1024).toFixed(1)} KB • {adjunto.tipoMime}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default AnuncioDetalle