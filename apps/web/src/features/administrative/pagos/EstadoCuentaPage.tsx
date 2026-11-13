import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router'
import {
  obtenerEstadoCuenta,
  type EstadoCuentaResponsePayload,
} from './api'
import { mensajeError, formatoMoneda, etiquetaConceptoPago } from '../shared/formato'

interface EstadoCuentaPageProps {
  /** Si se usa como modal, este prop indica si está abierto */
  isOpen?: boolean
  onClose?: () => void
}

export function EstadoCuentaPage({ isOpen = false, onClose }: EstadoCuentaPageProps) {
  const navigate = useNavigate()
  const { alumnoId } = useParams<{ alumnoId: string }>()
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [estadoCuenta, setEstadoCuenta] = useState<EstadoCuentaResponsePayload | null>(null)

  const cargarEstadoCuenta = useCallback(async () => {
    if (!alumnoId) return
    setCargando(true)
    setError(null)
    try {
      const datos = await obtenerEstadoCuenta(alumnoId)
      setEstadoCuenta(datos)
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setCargando(false)
    }
  }, [alumnoId])

  useEffect(() => {
    const mountedRef = { current: true }
    const ejecutarCarga = async () => {
      await cargarEstadoCuenta()
    }
    if (mountedRef.current) {
      ejecutarCarga()
    }
    return () => {
      mountedRef.current = false
    }
  }, [cargarEstadoCuenta])

  const handleCerrar = () => {
    if (onClose) {
      onClose()
    } else {
      navigate(-1)
    }
  }

  if (isOpen && !estadoCuenta && !cargando && !error) {
    return null
  }

  const contenido = (
    <div className={isOpen ? 'w-full max-w-3xl' : 'space-y-6'}>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-slate-900">
          Estado de Cuenta
        </h1>
        {isOpen && (
          <button
            onClick={handleCerrar}
            className="text-slate-500 hover:text-slate-700 text-2xl"
            aria-label="Cerrar"
          >
            ×
          </button>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm mb-4" role="alert">
          {error}
        </div>
      )}

      {cargando ? (
        <div className="p-8 text-center text-slate-500">
          Cargando estado de cuenta...
        </div>
      ) : estadoCuenta ? (
        <div className="space-y-6">
          {/* Resumen general */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm text-green-700">Total Pagado</p>
              <p className="text-3xl font-bold text-green-600">
                {formatoMoneda(estadoCuenta.totalGeneralPagado)}
              </p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-700">Total Pendiente</p>
              <p className="text-3xl font-bold text-red-600">
                {formatoMoneda(estadoCuenta.totalGeneralPendiente)}
              </p>
            </div>
          </div>

          {/* Detalle por concepto */}
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200">
              <h3 className="text-lg font-medium text-slate-900">Detalle por Concepto</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Concepto
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Total Pagado
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Total Pendiente
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Cantidad
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {estadoCuenta.totalesPorConcepto.map((t: { concepto: string; totalPagado: number; totalPendiente: number; cantidad: number }, i: number) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-sm text-slate-900">
                        {etiquetaConceptoPago(t.concepto)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-green-600">
                        {formatoMoneda(t.totalPagado)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-red-600">
                        {formatoMoneda(t.totalPendiente)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-slate-700">
                        {t.cantidad}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totales por alumno - si hay datos de alumno específico */}
          {/* En una implementación completa, aquí se mostrarían los pagos individuales */}
        </div>
      ) : null}

      {!isOpen && (
        <div className="mt-6 text-center">
          <button
            onClick={() => navigate('/pagos')}
            className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700"
          >
            Volver a Pagos
          </button>
        </div>
      )}
    </div>
  )

  if (isOpen) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-auto">
          <div className="p-4 border-b border-slate-200 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-slate-900">Estado de Cuenta</h2>
            <button
              onClick={handleCerrar}
              className="text-slate-500 hover:text-slate-700 text-2xl"
              aria-label="Cerrar"
            >
              ×
            </button>
          </div>
          {contenido}
        </div>
      </div>
    )
  }

  return contenido
}

export default EstadoCuentaPage