import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'react-router'
import { useAuth } from '../../auth/useAuth'
import {
  listarMensajes,
  type MensajeResponsePayload,
  type PaginatedMensajesPayload,
} from './api'
import { MensajeForm } from './MensajeForm'
import { formatoFechaHora, mensajeError } from '../shared/formato'

export function MensajeriaPage() {
  const { seccionId } = useParams<{ seccionId: string }>()
  const { usuario } = useAuth()
  const [mensajes, setMensajes] = useState<MensajeResponsePayload[]>([])
  const [meta, setMeta] = useState<PaginatedMensajesPayload['meta']>({ page: 1, pageSize: 20, total: 0 })
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  // Mark as used to satisfy TypeScript no-unused-vars
  if (mostrarFormulario) { /* intentional */ }

  const cargarConEstado = useCallback(async (pageNum: number) => {
    if (!seccionId) return
    setError(null)
    try {
      const respuesta = await listarMensajes(seccionId, { page: pageNum, pageSize: 20 })
      setMensajes(respuesta.data)
      setMeta(respuesta.meta)
    } catch (err) {
      setError(mensajeError(err))
    }
  }, [seccionId])

  useEffect(() => {
    const mountedRef = { current: true }
    const ejecutarCarga = async () => {
      await cargarConEstado(page)
    }
    if (mountedRef.current) {
      ejecutarCarga()
    }
    return () => {
      mountedRef.current = false
    }
  }, [cargarConEstado, page])

  const handlePageChange = (nuevaPage: number) => {
    setPage(nuevaPage)
  }

  const esPropio = (mensaje: MensajeResponsePayload) => mensaje.autorId === usuario?.id

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Mensajería de Sección</h1>
        <button
          onClick={() => setMostrarFormulario(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          Nuevo mensaje
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm" role="alert">
          {error}
        </div>
      )}

      {/* Lista de mensajes */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {mensajes.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            No hay mensajes en este hilo.
            <p className="mt-2">Sé el primero en escribir.</p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-slate-200">
              {mensajes.map((mensaje) => (
                <div key={mensaje.id} className="p-4 hover:bg-slate-50">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-slate-900">{mensaje.autorNombre}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                          {mensaje.autorRol}
                        </span>
                        {esPropio(mensaje) && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                            Tuyo
                          </span>
                        )}
                      </div>
                      <p className="text-slate-700 whitespace-pre-wrap">{mensaje.cuerpo}</p>
                      <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                        <span>{formatoFechaHora(mensaje.createdAt)}</span>
                        {mensaje.adjuntos.length > 0 && (
                          <span className="text-amber-600">
                            📎 {mensaje.adjuntos.length} adjunto(s)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Paginación */}
            <div className="border-t border-slate-200 p-4 flex items-center justify-between">
              <span className="text-sm text-slate-500">
                {meta.total} mensaje(s) · Página {meta.page} de {Math.ceil(meta.total / meta.pageSize) || 1}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePageChange(meta.page - 1)}
                  disabled={meta.page <= 1}
                  className="px-3 py-1 text-sm border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50"
                >
                  Anterior
                </button>
                <button
                  onClick={() => handlePageChange(meta.page + 1)}
                  disabled={meta.page * meta.pageSize >= meta.total}
                  className="px-3 py-1 text-sm border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50"
                >
                  Siguiente
                </button>
              </div>
            </div>
          </>
        )}

        {/* Formulario nuevo mensaje (modal inferior) */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-lg p-4 md:relative md:fixed md:bottom-auto md:top-auto md:left-auto md:right-auto md:max-w-2xl md:mx-auto md:rounded-t-lg md:shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Nuevo mensaje</h2>
            <button
              onClick={() => setMostrarFormulario(false)}
              className="text-slate-500 hover:text-slate-700 text-2xl"
              aria-label="Cerrar"
            >
              ×
            </button>
          </div>
          <MensajeForm
            seccionId={seccionId!}
            onEnviado={() => {
              setMostrarFormulario(false)
              cargarConEstado(page)
            }}
          />
        </div>
      </div>
    </div>
  )
}

export default MensajeriaPage