import { useEffect, useState } from 'react'
import {
  TIPO_CERTIFICADO_VALUES,
  ESTADO_CERTIFICADO_VALUES,
  tipoCertificadoSchema,
  estadoCertificadoSchema,
  type CertificadoResponsePayload,
  type EstadoCertificado,
  type PaginatedCertificadosPayload,
  type PlantillaCertificadoResponsePayload,
  type TipoCertificado,
} from '@intranet/shared'
import { useAuth } from '../../auth/useAuth'
import {
  colorEstadoCertificado,
  etiquetaEstadoCertificado,
  etiquetaTipoCertificado,
  formatoFecha,
  mensajeError,
} from '../shared/formato'
import { listarAlumnosCatalogo, listarAniosCatalogo } from '../matriculas/catalogos'
import type { AlumnoOpcion, CatalogoOpcion } from '../matriculas/MatriculaForm'
import {
  listarCertificados,
  aprobarCertificado,
  rechazarCertificado,
  descargarCertificado,
  listarPlantillas,
} from './api'
import { CertificadoForm } from './CertificadoForm'

interface Filtros {
  page: number
  pageSize: number
  tipo: TipoCertificado | ''
  alumnoId: string
  anioId: string
  estado: EstadoCertificado | ''
}

interface ResultadoListado {
  clave: string
  data: CertificadoResponsePayload[]
  meta: PaginatedCertificadosPayload['meta']
  error: string | null
}

type Modal = 'emitir' | 'solicitar' | null

const FILTROS_INICIALES: Filtros = {
  page: 1,
  pageSize: 20,
  tipo: '',
  alumnoId: '',
  anioId: '',
  estado: '',
}

/**
 * El listado devuelve `tipo` y `estado` como string; se validan contra los
 * enums para trabajar con los tipos estrictos del contrato.
 */
function aCertificadoTipado(
  certificado: PaginatedCertificadosPayload['data'][number],
): CertificadoResponsePayload | null {
  const tipo = tipoCertificadoSchema.safeParse(certificado.tipo)
  const estado = estadoCertificadoSchema.safeParse(certificado.estado)

  if (!tipo.success || !estado.success) return null

  return { ...certificado, tipo: tipo.data, estado: estado.data }
}

/** Valida el `tipo` string del listado de plantillas contra el enum. */
function aPlantillaTipada(
  plantilla: { tipo: string } & Omit<PlantillaCertificadoResponsePayload, 'tipo'>,
): PlantillaCertificadoResponsePayload | null {
  const tipo = tipoCertificadoSchema.safeParse(plantilla.tipo)

  if (!tipo.success) return null

  return { ...plantilla, tipo: tipo.data }
}

/**
 * Pantalla de certificados y constancias (RF-ADM-011 a RF-ADM-013).
 *
 * El Director emite, aprueba, rechaza y descarga; el apoderado o alumno
 * solicita. El backend revalida el alcance y los permisos.
 */
export function CertificadosPage() {
  const { usuario } = useAuth()

  const permisos = usuario?.permissions ?? []
  const puedeEmitir = permisos.includes('administrative.certificados.emitir')
  const puedeSolicitar = permisos.includes('administrative.certificados.solicitar')
  const puedeDescargar = permisos.includes('administrative.certificados.descargar')

  const [filtros, setFiltros] = useState<Filtros>(FILTROS_INICIALES)
  const [recarga, setRecarga] = useState(0)
  const [resultado, setResultado] = useState<ResultadoListado | null>(null)
  const [alumnos, setAlumnos] = useState<AlumnoOpcion[]>([])
  const [anios, setAnios] = useState<CatalogoOpcion[]>([])
  const [plantillas, setPlantillas] = useState<PlantillaCertificadoResponsePayload[]>([])
  const [modal, setModal] = useState<Modal>(null)
  const [errorAccion, setErrorAccion] = useState<string | null>(null)
  const [mensajeExito, setMensajeExito] = useState<string | null>(null)

  const puedeLeer = puedeEmitir || puedeSolicitar || puedeDescargar

  const clave = `${JSON.stringify(filtros)}|${recarga}`
  const cargando = puedeLeer && resultado?.clave !== clave
  const errorCarga = resultado?.clave === clave ? resultado.error : null
  const certificados = resultado?.clave === clave ? resultado.data : []
  const meta = resultado?.clave === clave ? resultado.meta : { page: 1, pageSize: 20, total: 0 }

  useEffect(() => {
    if (!puedeLeer) return

    let activo = true

    listarCertificados({
      page: filtros.page,
      pageSize: filtros.pageSize,
      ...(filtros.tipo ? { tipo: filtros.tipo } : {}),
      ...(filtros.alumnoId ? { alumnoId: filtros.alumnoId } : {}),
      ...(filtros.anioId ? { anioId: filtros.anioId } : {}),
      ...(filtros.estado ? { estado: filtros.estado } : {}),
    })
      .then((respuesta) => {
        if (!activo) return

        const data = respuesta.data
          .map(aCertificadoTipado)
          .filter((certificado): certificado is CertificadoResponsePayload => certificado !== null)

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
  }, [clave, filtros, puedeLeer])

  useEffect(() => {
    let activo = true

    Promise.all([
      listarAlumnosCatalogo(),
      listarAniosCatalogo(),
      listarPlantillas({ page: 1, pageSize: 100 }),
    ])
      .then(([listaAlumnos, listaAnios, listaPlantillas]) => {
        if (!activo) return

        setAlumnos(listaAlumnos)
        setAnios(listaAnios)
        setPlantillas(
          listaPlantillas.data
            .map(aPlantillaTipada)
            .filter((plantilla): plantilla is PlantillaCertificadoResponsePayload => plantilla !== null),
        )
      })
      .catch(() => {
        // Sin catálogos los filtros quedan vacíos; la tabla sigue operativa.
      })

    return () => {
      activo = false
    }
  }, [])

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

  function cambiarEstado(valor: string) {
    const estado = ESTADO_CERTIFICADO_VALUES.find((opcion) => opcion === valor) ?? ''
    setFiltros((previos) => ({ ...previos, estado, page: 1 }))
  }

  async function manejarAprobar(certificado: CertificadoResponsePayload) {
    setErrorAccion(null)

    if (!window.confirm(`¿Aprobar y emitir el certificado ${certificado.numero}?`)) return

    try {
      await aprobarCertificado(certificado.id)
      setMensajeExito('Certificado aprobado correctamente')
      setRecarga((actual) => actual + 1)
    } catch (error) {
      setErrorAccion(mensajeError(error))
    }
  }

  async function manejarRechazar(certificado: CertificadoResponsePayload) {
    setErrorAccion(null)

    const motivo = window.prompt('Motivo del rechazo:')
    if (!motivo) return

    try {
      await rechazarCertificado(certificado.id, { motivo })
      setMensajeExito('Certificado rechazado correctamente')
      setRecarga((actual) => actual + 1)
    } catch (error) {
      setErrorAccion(mensajeError(error))
    }
  }

  async function manejarDescargar(certificado: CertificadoResponsePayload) {
    setErrorAccion(null)

    try {
      const descarga = await descargarCertificado(certificado.id)
      setMensajeExito(descarga.message)
      window.open(descarga.downloadUrl, '_blank', 'noopener')
    } catch (error) {
      setErrorAccion(mensajeError(error))
    }
  }

  function manejarGuardado(mensaje?: string) {
    setModal(null)
    setMensajeExito(mensaje ?? 'Certificado guardado correctamente')
    setRecarga((actual) => actual + 1)
  }

  function nombreAlumno(alumnoId: string): string {
    const alumno = alumnos.find((item) => item.id === alumnoId)
    return alumno
      ? `${alumno.codigoAlumno} - ${alumno.nombres} ${alumno.apellidos}`
      : alumnoId
  }

  function nombreAnio(anioId: string): string {
    return anios.find((anio) => anio.id === anioId)?.nombre ?? anioId
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Certificados y Constancias</h1>
        <div className="flex gap-2">
          {puedeSolicitar && (
            <button
              type="button"
              onClick={() => setModal('solicitar')}
              className="px-4 py-2 border border-blue-600 text-blue-700 rounded-lg hover:bg-blue-50 text-sm font-medium"
            >
              Solicitar certificado
            </button>
          )}
          {puedeEmitir && (
            <button
              type="button"
              onClick={() => setModal('emitir')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
            >
              Emitir certificado
            </button>
          )}
        </div>
      </div>

      {!puedeLeer && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm" role="alert">
          No tiene permiso para consultar certificados.
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
      <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-4">
        <h2 className="text-lg font-medium text-slate-900">Filtros</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label htmlFor="certificado-filtro-tipo" className="block text-sm font-medium text-slate-700 mb-1">
              Tipo
            </label>
            <select
              id="certificado-filtro-tipo"
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

          <div>
            <label htmlFor="certificado-filtro-alumno" className="block text-sm font-medium text-slate-700 mb-1">
              Alumno
            </label>
            <select
              id="certificado-filtro-alumno"
              value={filtros.alumnoId}
              onChange={(e) => cambiarFiltro('alumnoId', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos</option>
              {alumnos.map((alumno) => (
                <option key={alumno.id} value={alumno.id}>
                  {alumno.codigoAlumno} - {alumno.nombres} {alumno.apellidos}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="certificado-filtro-anio" className="block text-sm font-medium text-slate-700 mb-1">
              Año académico
            </label>
            <select
              id="certificado-filtro-anio"
              value={filtros.anioId}
              onChange={(e) => cambiarFiltro('anioId', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos</option>
              {anios.map((anio) => (
                <option key={anio.id} value={anio.id}>{anio.nombre}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="certificado-filtro-estado" className="block text-sm font-medium text-slate-700 mb-1">
              Estado
            </label>
            <select
              id="certificado-filtro-estado"
              value={filtros.estado}
              onChange={(e) => cambiarEstado(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos</option>
              {ESTADO_CERTIFICADO_VALUES.map((estado) => (
                <option key={estado} value={estado}>{etiquetaEstadoCertificado(estado)}</option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-4 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setFiltros(FILTROS_INICIALES)}
              className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700 text-sm"
            >
              Limpiar filtros
            </button>
            <span className="text-sm text-slate-500">{meta.total} resultado(s)</span>
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {cargando ? (
          <div className="p-8 text-center text-slate-500">Cargando certificados...</div>
        ) : certificados.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No se encontraron certificados</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Número</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Tipo</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Alumno</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Año</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Estado</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Solicitud</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {certificados.map((certificado) => (
                    <tr key={certificado.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-sm text-slate-900">{certificado.numero}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {etiquetaTipoCertificado(certificado.tipo)}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {nombreAlumno(certificado.alumnoId)}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {nombreAnio(certificado.anioId)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full border ${colorEstadoCertificado(certificado.estado)}`}>
                          {etiquetaEstadoCertificado(certificado.estado)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {formatoFecha(certificado.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex items-center gap-2">
                          {puedeEmitir && certificado.estado === 'SOLICITADO' && (
                            <>
                              <button
                                type="button"
                                onClick={() => manejarAprobar(certificado)}
                                className="px-2 py-1 text-xs text-green-600 hover:text-green-800 hover:bg-green-50 rounded"
                              >
                                Aprobar
                              </button>
                              <button
                                type="button"
                                onClick={() => manejarRechazar(certificado)}
                                className="px-2 py-1 text-xs text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
                              >
                                Rechazar
                              </button>
                            </>
                          )}
                          {puedeDescargar && certificado.estado === 'EMITIDO' && (
                            <button
                              type="button"
                              onClick={() => manejarDescargar(certificado)}
                              className="px-2 py-1 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded"
                            >
                              Descargar
                            </button>
                          )}
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

      {/* Modal de certificado */}
      {modal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-auto">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-slate-900">
                {modal === 'emitir' ? 'Emitir certificado' : 'Solicitar certificado'}
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
              <CertificadoForm
                modo={modal}
                alumnos={alumnos}
                anios={anios}
                plantillas={plantillas}
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

export default CertificadosPage
