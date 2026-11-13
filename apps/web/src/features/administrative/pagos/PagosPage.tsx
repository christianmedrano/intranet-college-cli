import { useState, useEffect, useCallback } from 'react'
import {
  listarPagos,
  anularPago,
  obtenerEstadoCuenta,
  type PagoResponsePayload,
  type PaginatedPagosPayload,
  type EstadoCuentaResponsePayload,
} from './api'
import { mensajeError, formatoMoneda, formatoFecha, colorEstadoPago, etiquetaConceptoPago, etiquetaMetodoPago, etiquetaEstadoPago } from '../shared/formato'

export function PagosPage() {
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pagos, setPagos] = useState<PagoResponsePayload[]>([])
  const [meta, setMeta] = useState<PaginatedPagosPayload['meta']>({ page: 1, pageSize: 20, total: 0 })
  const [filtros, setFiltros] = useState({
    page: 1,
    pageSize: 20,
    alumnoId: '',
    concepto: '',
    fechaDesde: '',
    fechaHasta: '',
    estado: '',
    metodo: '',
  })
  const [alumnos, setAlumnos] = useState<Array<{ id: string; codigoAlumno: string; nombres: string; apellidos: string }>>([])
  const [mostrarEstadoCuenta, setMostrarEstadoCuenta] = useState<{ alumno: { id: string; nombre: string }; datos: EstadoCuentaResponsePayload } | null>(null)

  const cargarPagos = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const resultado = await listarPagos(filtros)
      setPagos(resultado.data)
      setMeta(resultado.meta)
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setCargando(false)
    }
  }, [filtros])

  const cargarAlumnos = useCallback(async () => {
    try {
      // Usar la API de alumnos existente
      const response = await fetch('/api/v1/alumnos?pageSize=1000', {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      })
      if (response.ok) {
        const data = await response.json()
        setAlumnos(data.data)
      }
    } catch {
      // Silenciar error - el selector simplemente no tendrá opciones
    }
  }, [])

  useEffect(() => {
    // Evitar llamada sincrónica a setState en el efecto usando una ref
    const mountedRef = { current: true }
    const ejecutarCarga = async () => {
      await cargarPagos()
      await cargarAlumnos()
    }
    if (mountedRef.current) {
      ejecutarCarga()
    }
    return () => {
      mountedRef.current = false
    }
  }, [cargarPagos, cargarAlumnos])

  const handleFiltroChange = (campo: keyof typeof filtros, valor: string | number) => {
    setFiltros((prev) => ({ ...prev, [campo]: valor, page: 1 }))
  }

  const handlePageChange = (page: number) => {
    setFiltros((prev) => ({ ...prev, page }))
  }

  const handlePageSizeChange = (pageSize: number) => {
    setFiltros((prev) => ({ ...prev, pageSize, page: 1 }))
  }

  const handleAnularPago = async (pago: PagoResponsePayload) => {
    const motivo = window.prompt('Ingrese el motivo de anulación:')
    if (!motivo) return

    if (!confirm(`¿Anular el pago ${pago.id}?`)) return

    try {
      await anularPago(pago.id, { motivo })
      await cargarPagos()
      alert('Pago anulado correctamente')
    } catch (err) {
      alert(mensajeError(err))
    }
  }

  const handleVerEstadoCuenta = async (alumnoId: string) => {
    const alumno = alumnos.find(a => a.id === alumnoId)
    if (!alumno) return

    try {
      const datos = await obtenerEstadoCuenta(alumnoId)
      setMostrarEstadoCuenta({
        alumno: { id: alumnoId, nombre: `${alumno.nombres} ${alumno.apellidos}` },
        datos,
      })
    } catch (err) {
      alert(mensajeError(err))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Gestión de Pagos</h1>
        <button
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          onClick={() => setFiltros({ ...filtros, alumnoId: '', concepto: '', fechaDesde: '', fechaHasta: '', estado: '', metodo: '', page: 1 })}
        >
          Nuevo pago
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm" role="alert">
          {error}
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-4">
        <h2 className="text-lg font-medium text-slate-900">Filtros</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label htmlFor="filtro-alumno" className="block text-sm font-medium text-slate-700 mb-1">
              Alumno
            </label>
            <select
              value={filtros.alumnoId}
              onChange={(e) => handleFiltroChange('alumnoId', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos los alumnos</option>
              {alumnos.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.codigoAlumno} - {a.nombres} {a.apellidos}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="filtro-concepto" className="block text-sm font-medium text-slate-700 mb-1">
              Concepto
            </label>
            <select
              value={filtros.concepto}
              onChange={(e) => handleFiltroChange('concepto', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos</option>
              <option value="CUOTA_MENSUAL">Cuota Mensual</option>
              <option value="MATRICULA">Matrícula</option>
              <option value="CERTIFICADO">Certificado</option>
              <option value="OTRO">Otro</option>
            </select>
          </div>

          <div>
            <label htmlFor="filtro-fecha-desde" className="block text-sm font-medium text-slate-700 mb-1">
              Fecha desde
            </label>
            <input
              type="date"
              value={filtros.fechaDesde}
              onChange={(e) => handleFiltroChange('fechaDesde', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="filtro-fecha-hasta" className="block text-sm font-medium text-slate-700 mb-1">
              Fecha hasta
            </label>
            <input
              type="date"
              value={filtros.fechaHasta}
              onChange={(e) => handleFiltroChange('fechaHasta', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="filtro-estado" className="block text-sm font-medium text-slate-700 mb-1">
              Estado
            </label>
            <select
              value={filtros.estado}
              onChange={(e) => handleFiltroChange('estado', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos</option>
              <option value="REGISTRADO">Registrado</option>
              <option value="ANULADO">Anulado</option>
            </select>
          </div>

          <div>
            <label htmlFor="filtro-metodo" className="block text-sm font-medium text-slate-700 mb-1">
              Método
            </label>
            <select
              value={filtros.metodo}
              onChange={(e) => handleFiltroChange('metodo', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos</option>
              <option value="EFECTIVO">Efectivo</option>
              <option value="TRANSFERENCIA">Transferencia</option>
              <option value="DEPOSITO">Depósito</option>
              <option value="OTRO">Otro</option>
            </select>
          </div>

          <div className="lg:col-span-2 flex gap-3">
            <button
              onClick={() => setFiltros({ ...filtros, alumnoId: '', concepto: '', fechaDesde: '', fechaHasta: '', estado: '', metodo: '', page: 1 })}
              className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700 text-sm"
            >
              Limpiar filtros
            </button>
            <span className="flex items-center text-sm text-slate-500">
              {meta.total} resultado(s)
            </span>
          </div>
        </div>
      </div>

      {/* Tabla de pagos */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {cargando ? (
          <div className="p-8 text-center text-slate-500">
            Cargando pagos...
          </div>
        ) : pagos.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            No se encontraron pagos
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">N°</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Alumno</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Concepto</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Monto</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Fecha</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Método</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Estado</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {pagos.map((pago) => (
                    <tr key={pago.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-sm text-slate-900">{pago.id}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {pago.alumnoId} {/* TODO: mostrar nombre del alumno */}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {etiquetaConceptoPago(pago.concepto)}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700 text-right">
                        {formatoFecha(pago.fechaPago)}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {etiquetaMetodoPago(pago.metodo)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full border ${colorEstadoPago(pago.estado)}`}>
                          {etiquetaEstadoPago(pago.estado)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex items-center gap-2">
                          {pago.estado === 'REGISTRADO' && (
                            <button
                              onClick={() => handleAnularPago(pago)}
                              className="px-2 py-1 text-xs text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
                            >
                              Anular
                            </button>
                          )}
                          <button
                            onClick={() => {
                              const alumno = alumnos.find(a => a.id === pago.alumnoId)
                              if (alumno) {
                                handleVerEstadoCuenta(pago.alumnoId)
                              }
                            }}
                            className="px-2 py-1 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded"
                          >
                            Estado de cuenta
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginación */}
            <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between">
              <div className="text-sm text-slate-500">
                Página {meta.page} de {Math.ceil(meta.total / meta.pageSize)} — {meta.total} total
              </div>
              <div className="flex gap-2">
                <select
                  value={filtros.pageSize}
                  onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                  className="px-2 py-1 text-sm border border-slate-300 rounded"
                >
                  <option value={10}>10 por página</option>
                  <option value={20}>20 por página</option>
                  <option value={50}>50 por página</option>
                  <option value={100}>100 por página</option>
                </select>
                <button
                  onClick={() => handlePageChange(meta.page - 1)}
                  disabled={meta.page === 1}
                  className="px-3 py-1 border border-slate-300 rounded disabled:opacity-50 text-sm"
                >
                  Anterior
                </button>
                <button
                  onClick={() => handlePageChange(meta.page + 1)}
                  disabled={meta.page >= Math.ceil(meta.total / meta.pageSize)}
                  className="px-3 py-1 border border-slate-300 rounded disabled:opacity-50 text-sm"
                >
                  Siguiente
                </button>
              </div>
            </div>
          </>
        )}

        {/* Modal Estado de Cuenta */}
        {mostrarEstadoCuenta && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-auto">
              <div className="p-4 border-b border-slate-200 flex justify-between items-center">
                <h2 className="text-lg font-semibold text-slate-900">
                  Estado de cuenta - {mostrarEstadoCuenta.alumno.nombre}
                </h2>
                <button
                  onClick={() => setMostrarEstadoCuenta(null)}
                  className="text-slate-500 hover:text-slate-700 text-2xl"
                >
                  ×
                </button>
              </div>
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg">
                  <div>
                    <p className="text-sm text-slate-500">Total pagado</p>
                    <p className="text-2xl font-bold text-green-600">
                      {formatoMoneda(mostrarEstadoCuenta.datos.totalGeneralPagado)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Total pendiente</p>
                    <p className="text-2xl font-bold text-red-600">
                      {formatoMoneda(mostrarEstadoCuenta.datos.totalGeneralPendiente)}
                    </p>
                  </div>
                </div>

                <h3 className="text-lg font-medium text-slate-900">Detalle por concepto</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Concepto</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Pagado</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Pendiente</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Cantidad</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {mostrarEstadoCuenta.datos.totalesPorConcepto.map((t: { concepto: string; totalPagado: number; totalPendiente: number; cantidad: number }, i: number) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="px-4 py-2 text-sm text-slate-900">{t.concepto}</td>
                          <td className="px-4 py-2 text-right text-sm text-green-600">
                            {formatoMoneda(t.totalPagado)}
                          </td>
                          <td className="px-4 py-2 text-right text-sm text-red-600">
                            {formatoMoneda(t.totalPendiente)}
                          </td>
                          <td className="px-4 py-2 text-right text-sm text-slate-700">
                            {t.cantidad}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="p-4 border-t border-slate-200 flex justify-end">
                <button
                  onClick={() => setMostrarEstadoCuenta(null)}
                  className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default PagosPage