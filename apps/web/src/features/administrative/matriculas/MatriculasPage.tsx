import { useEffect, useState } from 'react'
import type { EstadoMatriculaAdmin } from '@intranet/shared'
import {
  listarMatriculas,
  aprobarMatricula,
  rechazarMatricula,
  retirarMatricula,
  type MatriculaAdminResponsePayload,
  type PaginatedMatriculasAdminPayload,
} from './api'
import { useAuth } from '../../auth/useAuth'
import {
  colorEstadoMatricula,
  etiquetaEstadoMatricula,
  formatoFecha,
  mensajeError,
} from '../shared/formato'
import { MatriculaForm, type AlumnoOpcion, type CatalogoOpcion, type GradoOpcion, type SeccionOpcion } from './MatriculaForm'
import {
  listarAlumnosCatalogo,
  listarAniosCatalogo,
  listarGradosCatalogo,
  listarNivelesCatalogo,
  listarSeccionesCatalogo,
} from './catalogos'

const ESTADOS: { value: EstadoMatriculaAdmin; label: string }[] = [
  { value: 'SOLICITADA', label: 'Solicitada' },
  { value: 'APROBADA', label: 'Aprobada' },
  { value: 'RECHAZADA', label: 'Rechazada' },
  { value: 'RETIRADA', label: 'Retirada' },
  { value: 'ANULADA', label: 'Anulada' },
]

interface Filtros {
  page: number
  pageSize: number
  anioId: string
  nivelId: string
  gradoId: string
  seccionId: string
  estado: EstadoMatriculaAdmin | ''
  alumnoId: string
}

interface Catalogos {
  alumnos: AlumnoOpcion[]
  anios: CatalogoOpcion[]
  niveles: CatalogoOpcion[]
  grados: GradoOpcion[]
  secciones: SeccionOpcion[]
}

interface ResultadoListado {
  clave: string
  data: MatriculaAdminResponsePayload[]
  meta: PaginatedMatriculasAdminPayload['meta']
  error: string | null
}

const FILTROS_INICIALES: Filtros = {
  page: 1,
  pageSize: 20,
  anioId: '',
  nivelId: '',
  gradoId: '',
  seccionId: '',
  estado: '',
  alumnoId: '',
}

const CATALOGOS_VACIOS: Catalogos = {
  alumnos: [],
  anios: [],
  niveles: [],
  grados: [],
  secciones: [],
}

/**
 * Pantalla de gestión de matrículas (RF-ADM-005 a RF-ADM-010).
 *
 * Lista con filtros por año, nivel, grado, sección, estado y alumno. El
 * Director aprueba, rechaza o retira según el estado; el apoderado solicita.
 * El backend revalida siempre el alcance y los permisos.
 */
export function MatriculasPage() {
  const { usuario } = useAuth()

  const permisos = usuario?.permissions ?? []
  const puedeLeer = permisos.includes('administrative.matriculas.leer')
  const puedeGestionar = permisos.includes('administrative.matriculas.gestionar')

  const [filtros, setFiltros] = useState<Filtros>(FILTROS_INICIALES)
  const [recarga, setRecarga] = useState(0)
  const [resultado, setResultado] = useState<ResultadoListado | null>(null)
  const [catalogos, setCatalogos] = useState<Catalogos>(CATALOGOS_VACIOS)
  const [errorAccion, setErrorAccion] = useState<string | null>(null)
  const [mensajeExito, setMensajeExito] = useState<string | null>(null)
  const [mostrarFormulario, setMostrarFormulario] = useState(false)

  const clave = `${JSON.stringify(filtros)}|${recarga}`
  const cargando = puedeLeer && resultado?.clave !== clave
  const errorCarga = resultado?.clave === clave ? resultado.error : null
  const matriculas = resultado?.clave === clave ? resultado.data : []
  const meta = resultado?.clave === clave ? resultado.meta : { page: 1, pageSize: 20, total: 0 }

  useEffect(() => {
    if (!puedeLeer) return

    let activo = true

    listarMatriculas({
      page: filtros.page,
      pageSize: filtros.pageSize,
      ...(filtros.anioId ? { anioId: filtros.anioId } : {}),
      ...(filtros.nivelId ? { nivelId: filtros.nivelId } : {}),
      ...(filtros.gradoId ? { gradoId: filtros.gradoId } : {}),
      ...(filtros.seccionId ? { seccionId: filtros.seccionId } : {}),
      ...(filtros.estado ? { estado: filtros.estado } : {}),
      ...(filtros.alumnoId ? { alumnoId: filtros.alumnoId } : {}),
    })
      .then((respuesta) => {
        if (!activo) return

        setResultado({ clave, data: respuesta.data, meta: respuesta.meta, error: null })
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
      listarNivelesCatalogo(),
      listarGradosCatalogo(),
      listarSeccionesCatalogo(),
    ])
      .then(([alumnos, anios, niveles, grados, secciones]) => {
        if (activo) setCatalogos({ alumnos, anios, niveles, grados, secciones })
      })
      .catch(() => {
        // Sin catálogos los filtros quedan vacíos; la tabla sigue operativa.
      })

    return () => {
      activo = false
    }
  }, [])

  const gradosFiltrados = filtros.nivelId
    ? catalogos.grados.filter((grado) => grado.nivelId === filtros.nivelId)
    : catalogos.grados
  const seccionesFiltradas = filtros.gradoId
    ? catalogos.secciones.filter((seccion) => seccion.gradoId === filtros.gradoId)
    : catalogos.secciones

  function cambiarFiltro(campo: keyof Filtros, valor: string | number) {
    setFiltros((previos) => {
      const siguientes = { ...previos, [campo]: valor }

      if (campo !== 'page') {
        siguientes.page = 1
      }

      if (campo === 'nivelId') {
        siguientes.gradoId = ''
        siguientes.seccionId = ''
      }

      if (campo === 'gradoId') {
        siguientes.seccionId = ''
      }

      return siguientes
    })
  }

  function cambiarEstado(valor: string) {
    const estado = ESTADOS.find((opcion) => opcion.value === valor)?.value ?? ''
    setFiltros((previos) => ({ ...previos, estado, page: 1 }))
  }

  async function ejecutarAccion(
    id: string,
    accion: 'aprobar' | 'rechazar' | 'retirar',
  ) {
    setErrorAccion(null)

    try {
      if (accion === 'aprobar') {
        if (!window.confirm('¿Aprobar esta matrícula?')) return
        await aprobarMatricula(id)
        setMensajeExito('Matrícula aprobada correctamente')
      }

      if (accion === 'rechazar') {
        const motivo = window.prompt('Motivo del rechazo:')
        if (!motivo) return
        await rechazarMatricula(id, { motivo })
        setMensajeExito('Matrícula rechazada correctamente')
      }

      if (accion === 'retirar') {
        const motivo = window.prompt('Motivo del retiro:')
        if (!motivo) return
        await retirarMatricula(id, { motivo })
        setMensajeExito('Matrícula retirada correctamente')
      }

      setRecarga((actual) => actual + 1)
    } catch (error) {
      setErrorAccion(mensajeError(error))
    }
  }

  function nombreAlumno(alumnoId: string): string {
    const alumno = catalogos.alumnos.find((item) => item.id === alumnoId)
    return alumno
      ? `${alumno.codigoAlumno} - ${alumno.nombres} ${alumno.apellidos}`
      : alumnoId
  }

  function nombreAnio(anioId: string): string {
    return catalogos.anios.find((anio) => anio.id === anioId)?.nombre ?? anioId
  }

  function nombreGradoSeccion(seccionId: string): string {
    const seccion = catalogos.secciones.find((item) => item.id === seccionId)
    if (!seccion) return seccionId

    const grado = catalogos.grados.find((item) => item.id === seccion.gradoId)
    return grado ? `${grado.nombre} - ${seccion.nombre}` : seccion.nombre
  }

  function cerrarFormulario() {
    setMostrarFormulario(false)
  }

  function manejarGuardado(mensaje?: string) {
    setMostrarFormulario(false)
    setMensajeExito(mensaje ?? 'Matrícula solicitada correctamente')
    setRecarga((actual) => actual + 1)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Gestión de Matrículas</h1>
        {puedeGestionar && (
          <button
            type="button"
            onClick={() => setMostrarFormulario(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            Nueva matrícula
          </button>
        )}
      </div>

      {!puedeLeer && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm" role="alert">
          No tiene permiso para consultar matrículas.
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
            <label htmlFor="filtro-anio" className="block text-sm font-medium text-slate-700 mb-1">
              Año académico
            </label>
            <select
              id="filtro-anio"
              value={filtros.anioId}
              onChange={(e) => cambiarFiltro('anioId', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos</option>
              {catalogos.anios.map((anio) => (
                <option key={anio.id} value={anio.id}>{anio.nombre}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="filtro-nivel" className="block text-sm font-medium text-slate-700 mb-1">
              Nivel
            </label>
            <select
              id="filtro-nivel"
              value={filtros.nivelId}
              onChange={(e) => cambiarFiltro('nivelId', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos</option>
              {catalogos.niveles.map((nivel) => (
                <option key={nivel.id} value={nivel.id}>{nivel.nombre}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="filtro-grado" className="block text-sm font-medium text-slate-700 mb-1">
              Grado
            </label>
            <select
              id="filtro-grado"
              value={filtros.gradoId}
              onChange={(e) => cambiarFiltro('gradoId', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos</option>
              {gradosFiltrados.map((grado) => (
                <option key={grado.id} value={grado.id}>{grado.nombre}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="filtro-seccion" className="block text-sm font-medium text-slate-700 mb-1">
              Sección
            </label>
            <select
              id="filtro-seccion"
              value={filtros.seccionId}
              onChange={(e) => cambiarFiltro('seccionId', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todas</option>
              {seccionesFiltradas.map((seccion) => (
                <option key={seccion.id} value={seccion.id}>{seccion.nombre}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="filtro-estado" className="block text-sm font-medium text-slate-700 mb-1">
              Estado
            </label>
            <select
              id="filtro-estado"
              value={filtros.estado}
              onChange={(e) => cambiarEstado(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos</option>
              {ESTADOS.map((estado) => (
                <option key={estado.value} value={estado.value}>{estado.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="filtro-alumno" className="block text-sm font-medium text-slate-700 mb-1">
              Alumno
            </label>
            <select
              id="filtro-alumno"
              value={filtros.alumnoId}
              onChange={(e) => cambiarFiltro('alumnoId', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos</option>
              {catalogos.alumnos.map((alumno) => (
                <option key={alumno.id} value={alumno.id}>
                  {alumno.codigoAlumno} - {alumno.nombres} {alumno.apellidos}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-2 flex items-end gap-3">
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
          <div className="p-8 text-center text-slate-500">Cargando matrículas...</div>
        ) : matriculas.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No se encontraron matrículas</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Alumno</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Año</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Grado / Sección</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Estado</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Solicitud</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {matriculas.map((matricula) => (
                    <tr key={matricula.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-sm text-slate-900">
                        {nombreAlumno(matricula.alumnoId)}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {nombreAnio(matricula.anioId)}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {nombreGradoSeccion(matricula.seccionId)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full border ${colorEstadoMatricula(matricula.estado)}`}>
                          {etiquetaEstadoMatricula(matricula.estado)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {formatoFecha(matricula.fechaSolicitud)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex items-center gap-2">
                          {puedeGestionar && matricula.estado === 'SOLICITADA' && (
                            <>
                              <button
                                type="button"
                                onClick={() => ejecutarAccion(matricula.id, 'aprobar')}
                                className="px-2 py-1 text-xs text-green-600 hover:text-green-800 hover:bg-green-50 rounded"
                              >
                                Aprobar
                              </button>
                              <button
                                type="button"
                                onClick={() => ejecutarAccion(matricula.id, 'rechazar')}
                                className="px-2 py-1 text-xs text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
                              >
                                Rechazar
                              </button>
                            </>
                          )}
                          {puedeGestionar && matricula.estado === 'APROBADA' && (
                            <button
                              type="button"
                              onClick={() => ejecutarAccion(matricula.id, 'retirar')}
                              className="px-2 py-1 text-xs text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded"
                            >
                              Retirar
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
                <select
                  value={filtros.pageSize}
                  onChange={(e) => cambiarFiltro('pageSize', Number(e.target.value))}
                  className="px-2 py-1 text-sm border border-slate-300 rounded"
                >
                  <option value={10}>10 por página</option>
                  <option value={20}>20 por página</option>
                  <option value={50}>50 por página</option>
                  <option value={100}>100 por página</option>
                </select>
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

      {/* Modal de solicitud */}
      {mostrarFormulario && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-auto">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-slate-900">Nueva matrícula</h2>
              <button
                type="button"
                onClick={cerrarFormulario}
                className="text-slate-500 hover:text-slate-700 text-2xl"
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>
            <div className="p-4">
              <MatriculaForm
                alumnos={catalogos.alumnos}
                anios={catalogos.anios}
                niveles={catalogos.niveles}
                grados={catalogos.grados}
                secciones={catalogos.secciones}
                onGuardado={manejarGuardado}
                onCancelar={cerrarFormulario}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default MatriculasPage
