import { useEffect, useState } from 'react'
import {
  TIPO_CERTIFICADO_VALUES,
  tipoCertificadoSchema,
  type PaginatedPlantillasPayload,
  type PlantillaCertificadoResponsePayload,
  type TipoCertificado,
} from '@intranet/shared'
import { useAuth } from '../../auth/useAuth'
import {
  etiquetaTipoCertificado,
  formatoFechaHora,
  mensajeError,
} from '../shared/formato'
import { listarPlantillas, eliminarPlantilla } from './api'
import { PlantillaForm } from './PlantillaForm'

interface Filtros {
  page: number
  pageSize: number
  tipo: TipoCertificado | ''
}

interface ResultadoListado {
  clave: string
  data: PlantillaCertificadoResponsePayload[]
  meta: { page: number; pageSize: number; total: number }
  error: string | null
}

type Modal =
  | { modo: 'crear' }
  | { modo: 'editar'; plantilla: PlantillaCertificadoResponsePayload }
  | null

const FILTROS_INICIALES: Filtros = { page: 1, pageSize: 20, tipo: '' }

/**
 * El listado devuelve `tipo` como string; se valida contra el enum para
 * trabajar con el tipo estricto del contrato.
 */
function aPlantillaTipada(
  plantilla: PaginatedPlantillasPayload['data'][number],
): PlantillaCertificadoResponsePayload | null {
  const tipo = tipoCertificadoSchema.safeParse(plantilla.tipo)

  if (!tipo.success) return null

  return { ...plantilla, tipo: tipo.data }
}

/**
 * Pantalla de configuración de plantillas de certificado (RF-ADM-014).
 *
 * Lista las plantillas con su versión y permite crear, editar y eliminar.
 * Solo el Director y el SuperAdmin pueden gestionarlas.
 */
export function PlantillasPage() {
  const { usuario } = useAuth()

  const permisos = usuario?.permissions ?? []
  const puedeGestionar = permisos.includes('administrative.certificados.emitir')

  const [filtros, setFiltros] = useState<Filtros>(FILTROS_INICIALES)
  const [recarga, setRecarga] = useState(0)
  const [resultado, setResultado] = useState<ResultadoListado | null>(null)
  const [modal, setModal] = useState<Modal>(null)
  const [errorAccion, setErrorAccion] = useState<string | null>(null)
  const [mensajeExito, setMensajeExito] = useState<string | null>(null)

  const clave = `${JSON.stringify(filtros)}|${recarga}`
  const cargando = puedeGestionar && resultado?.clave !== clave
  const errorCarga = resultado?.clave === clave ? resultado.error : null
  const plantillas = resultado?.clave === clave ? resultado.data : []
  const meta = resultado?.clave === clave ? resultado.meta : { page: 1, pageSize: 20, total: 0 }

  useEffect(() => {
    if (!puedeGestionar) return

    let activo = true

    listarPlantillas({
      page: filtros.page,
      pageSize: filtros.pageSize,
      ...(filtros.tipo ? { tipo: filtros.tipo } : {}),
    })
      .then((respuesta) => {
        if (!activo) return

        const data = respuesta.data
          .map(aPlantillaTipada)
          .filter((plantilla): plantilla is PlantillaCertificadoResponsePayload => plantilla !== null)

        setResultado({ clave, data, meta: respuesta.meta, error: null })
      })
      .catch((error: unknown) => {
        if (activo) {
          setResultado({ clave, data: [], meta: { page: 1, pageSize: 20, total: 0 }, error: mensajeError(error) })
        }
      })

    return () => {
      activo = false
    }
  }, [clave, filtros, puedeGestionar])

  function cambiarFiltro(campo: keyof Filtros, valor: string | number) {
    setFiltros((previos) => {
      const siguientes = { ...previos, [campo]: valor }

      if (campo !== 'page') siguientes.page = 1

      return siguientes
    })
  }

  function cambiarTipo(valor: string) {
    const tipo = TIPO_CERTIFICADO_VALUES.find((opcion) => opcion === valor) ?? ''
    setFiltros((previos) => ({ ...previos, tipo, page: 1 }))
  }

  async function manejarEliminar(plantilla: PlantillaCertificadoResponsePayload) {
    setErrorAccion(null)

    if (!window.confirm(`¿Eliminar la plantilla "${plantilla.nombre}"?`)) return

    try {
      await eliminarPlantilla(plantilla.id)
      setMensajeExito('Plantilla eliminada correctamente')
      setRecarga((actual) => actual + 1)
    } catch (error) {
      setErrorAccion(mensajeError(error))
    }
  }

  function manejarGuardado(mensaje?: string) {
    setModal(null)
    setMensajeExito(mensaje ?? 'Plantilla guardada correctamente')
    setRecarga((actual) => actual + 1)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Plantillas de Certificados</h1>
        {puedeGestionar && (
          <button
            type="button"
            onClick={() => setModal({ modo: 'crear' })}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            Nueva plantilla
          </button>
        )}
      </div>

      {!puedeGestionar && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm" role="alert">
          No tiene permiso para gestionar plantillas de certificados.
        </div>
      )}

      {mensajeExito && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm" role="status">
          {mensajeExito}
        </div>
      )}

      {(errorCarga || errorAccion) && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm" role="alert">
          {errorAccion ?? errorCarga}
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="plantilla-filtro-tipo" className="block text-sm font-medium text-slate-700 mb-1">
              Tipo de certificado
            </label>
            <select
              id="plantilla-filtro-tipo"
              value={filtros.tipo}
              onChange={(e) => cambiarTipo(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos</option>
              {TIPO_CERTIFICADO_VALUES.map((tipo) => (
                <option key={tipo} value={tipo}>{etiquetaTipoCertificado(tipo)}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <span className="text-sm text-slate-500">{meta.total} plantilla(s)</span>
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {cargando ? (
          <div className="p-8 text-center text-slate-500">Cargando plantillas...</div>
        ) : plantillas.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No se encontraron plantillas</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Tipo</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Nombre</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Versión</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Activa</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Actualizada</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {plantillas.map((plantilla) => (
                    <tr key={plantilla.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {etiquetaTipoCertificado(plantilla.tipo)}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-900">{plantilla.nombre}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">v{plantilla.version}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full border ${
                          plantilla.activa
                            ? 'bg-green-100 text-green-700 border-green-200'
                            : 'bg-slate-100 text-slate-500 border-slate-200'
                        }`}>
                          {plantilla.activa ? 'Activa' : 'Inactiva'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {formatoFechaHora(plantilla.updatedAt)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {puedeGestionar && (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setModal({ modo: 'editar', plantilla })}
                              className="px-2 py-1 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => manejarEliminar(plantilla)}
                              className="px-2 py-1 text-xs text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
                            >
                              Eliminar
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginación */}
            <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between">
              <div className="text-sm text-slate-500">
                Página {meta.page} de {Math.max(1, Math.ceil(meta.total / meta.pageSize))} — {meta.total} total
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => cambiarFiltro('page', Math.max(1, filtros.page - 1))}
                  disabled={filtros.page <= 1}
                  className="px-3 py-1 border border-slate-300 rounded disabled:opacity-50 text-sm"
                >
                  Anterior
                </button>
                <button
                  type="button"
                  onClick={() => cambiarFiltro('page', filtros.page + 1)}
                  disabled={filtros.page >= Math.ceil(meta.total / meta.pageSize)}
                  className="px-3 py-1 border border-slate-300 rounded disabled:opacity-50 text-sm"
                >
                  Siguiente
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Modal de plantilla */}
      {modal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-auto">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-slate-900">
                {modal.modo === 'crear' ? 'Nueva plantilla' : 'Editar plantilla'}
              </h2>
              <button
                type="button"
                onClick={() => setModal(null)}
                className="text-slate-500 hover:text-slate-700 text-2xl"
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>
            <div className="p-4">
              <PlantillaForm
                plantilla={modal.modo === 'editar' ? modal.plantilla : undefined}
                onGuardado={manejarGuardado}
                onCancelar={() => setModal(null)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default PlantillasPage
