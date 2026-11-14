import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../../auth/useAuth'
import {
  listarAnuncios,
  eliminarAnuncio,
  type PaginatedAnunciosPayload,
} from './api'
import { AnuncioForm } from './AnuncioForm'
import { mensajeError } from '../shared/formato'
import type { RoleCode } from '@intranet/shared'

type AnuncioEstado = 'BORRADOR' | 'PUBLICADO' | 'EXPIRADO' | 'ARCHIVADO'

const ESTADOS: { value: AnuncioEstado; label: string }[] = [
  { value: 'BORRADOR', label: 'Borrador' },
  { value: 'PUBLICADO', label: 'Publicado' },
  { value: 'EXPIRADO', label: 'Expirado' },
  { value: 'ARCHIVADO', label: 'Archivado' },
]

interface Filtros {
  page: number
  pageSize: number
  tipo: 'INSTITUCIONAL' | 'SECCION' | ''
  estado: AnuncioEstado | ''
  nivelId: string
  gradoId: string
  seccionId: string
  rol: RoleCode | undefined
  desde: string
  hasta: string
}

interface Catalogos {
  niveles: { id: string; nombre: string }[]
  grados: { id: string; nombre: string; nivelId: string }[]
  secciones: { id: string; nombre: string; gradoId: string }[]
}

interface ResultadoListado {
  clave: string
  data: AnuncioResponsePayload[]
  meta: PaginatedAnunciosPayload['meta']
  error: string | null
}

const FILTROS_INICIALES: Filtros = {
  page: 1,
  pageSize: 20,
  tipo: '',
  estado: '',
  nivelId: '',
  gradoId: '',
  seccionId: '',
  rol: undefined,
  desde: '',
  hasta: '',
}

const CATALOGOS_VACIOS: Catalogos = {
  niveles: [],
  grados: [],
  secciones: [],
}

interface AnuncioResponsePayload {
  id: string
  institucionId: string
  autorId: string
  titulo: string
  cuerpo: string
  tipo: 'INSTITUCIONAL' | 'SECCION'
  estado: 'BORRADOR' | 'PUBLICADO' | 'EXPIRADO' | 'ARCHIVADO'
  anioId: string | null
  audienciaNiveles: string[]
  audienciaGrados: string[]
  audienciaSecciones: string[]
  audienciaRoles: string[]
  publicadoEn: string | null
  expiraEn: string | null
  createdAt: string
  updatedAt: string
  adjuntos: { id: string; nombreOriginal: string; url: string; tipoMime: string; tamanoBytes: number }[]
}

export function AnunciosPage() {
  const { usuario } = useAuth()
  const permisos = usuario?.permissions ?? []
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_INICIALES)
  const [catalogos, setCatalogos] = useState<Catalogos>(CATALOGOS_VACIOS)
  const [recarga, setRecarga] = useState(0)
  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [anuncioEditando, setAnuncioEditando] = useState<AnuncioResponsePayload | null>(null)
  const [eliminandoId, setEliminandoId] = useState<string | null>(null)

  const [resultado, setResultado] = useState<ResultadoListado | null>(null)

  const puedeGestionar = permisos.includes('communication.anuncios.gestionar')
  const puedeLeer = permisos.includes('communication.anuncios.leer')

  const clave = `${JSON.stringify(filtros)}|${recarga}`

  // Cargar catálogos
  const cargarCatalogos = useCallback(async () => {
    try {
      const [nivelesRes, gradosRes, seccionesRes] = await Promise.all([
        fetch('/api/v1/niveles?pageSize=100', { credentials: 'include' }),
        fetch('/api/v1/grados?pageSize=100', { credentials: 'include' }),
        fetch('/api/v1/secciones?pageSize=100', { credentials: 'include' }),
      ])

      // Verificar que las respuestas sean exitosas
      if (!nivelesRes.ok || !gradosRes.ok || !seccionesRes.ok) {
        console.warn('Error cargando catálogos:', { niveles: nivelesRes.status, grados: gradosRes.status, secciones: seccionesRes.status })
        return CATALOGOS_VACIOS
      }

      const [niveles, grados, secciones] = await Promise.all([
        nivelesRes.json(),
        gradosRes.json(),
        seccionesRes.json(),
      ])

      return {
        niveles: niveles.data ?? [],
        grados: grados.data ?? [],
        secciones: secciones.data ?? [],
      }
    } catch {
      return CATALOGOS_VACIOS
    }
  }, [])

  useEffect(() => {
    cargarCatalogos().then(setCatalogos)
  }, [cargarCatalogos])

  // Cargar anuncios
  useEffect(() => {
    if (!puedeLeer) return

    let activo = true

    listarAnuncios({
      page: filtros.page,
      pageSize: filtros.pageSize,
      ...(filtros.tipo ? { tipo: filtros.tipo } : {}),
      ...(filtros.estado ? { estado: filtros.estado } : {}),
      ...(filtros.nivelId ? { nivelId: filtros.nivelId } : {}),
      ...(filtros.gradoId ? { gradoId: filtros.gradoId } : {}),
      ...(filtros.seccionId ? { seccionId: filtros.seccionId } : {}),
      ...(filtros.rol ? { rol: filtros.rol } : {}),
      ...(filtros.desde ? { desde: filtros.desde } : {}),
      ...(filtros.hasta ? { hasta: filtros.hasta } : {}),
    })
      .then((respuesta) => {
        if (!activo) return
        setResultado({ clave, data: respuesta.data, meta: respuesta.meta, error: null })
      })
      .catch((err: unknown) => {
        if (activo) {
          setResultado({ clave, data: [], meta: { page: 1, pageSize: 20, total: 0 }, error: mensajeError(err) })
        }
      })

    return () => {
      activo = false
    }
  }, [clave, filtros, puedeLeer])

  const anuncios = resultado?.clave === clave ? resultado.data : []
  const meta = resultado?.clave === clave ? resultado.meta : { page: 1, pageSize: 20, total: 0 }
  const errorCarga = resultado?.clave === clave ? resultado.error : null

  const handleFiltroChange = (campo: keyof Filtros, valor: string | number) => {
    setFiltros((prev) => ({ ...prev, [campo]: valor, page: 1 }))
  }

  const handlePageChange = (page: number) => {
    setFiltros((prev) => ({ ...prev, page }))
  }

  const abrirFormularioCrear = () => {
    setAnuncioEditando(null)
    setMostrarFormulario(true)
  }

  const abrirFormularioEditar = (anuncio: AnuncioResponsePayload) => {
    setAnuncioEditando(anuncio)
    setMostrarFormulario(true)
  }

  const cerrarFormulario = () => {
    setMostrarFormulario(false)
    setAnuncioEditando(null)
  }

  const handleGuardado = (mensaje?: string) => {
    cerrarFormulario()
    setRecarga((r) => r + 1)
    if (mensaje) alert(mensaje)
  }

  const confirmarEliminar = async (id: string) => {
    if (!window.confirm('¿Seguro que quieres archivar este anuncio?')) return
    setEliminandoId(id)
    try {
      await eliminarAnuncio(id)
      setRecarga((r) => r + 1)
    } catch (err) {
      alert(mensajeError(err))
    } finally {
      setEliminandoId(null)
    }
  }

  const gradosFiltrados = catalogos.grados.filter((g) => !filtros.nivelId || g.nivelId === filtros.nivelId)
  const seccionesFiltradas = catalogos.secciones.filter((s) => !filtros.gradoId || s.gradoId === filtros.gradoId)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Anuncios y Comunicados</h1>
        {puedeGestionar && (
          <button
            onClick={abrirFormularioCrear}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            Crear anuncio
          </button>
        )}
      </div>

      {/* Alertas */}
      {errorCarga && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm" role="alert">
          {errorCarga}
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-4">
        <h2 className="text-lg font-medium text-slate-900">Filtros</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label htmlFor="filtro-tipo" className="block text-sm font-medium text-slate-700 mb-1">
              Tipo
            </label>
            <select
              id="filtro-tipo"
              value={filtros.tipo}
              onChange={(e) => handleFiltroChange('tipo', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos</option>
              <option value="INSTITUCIONAL">Institucional</option>
              <option value="SECCION">Sección</option>
            </select>
          </div>
          <div>
            <label htmlFor="filtro-estado" className="block text-sm font-medium text-slate-700 mb-1">
              Estado
            </label>
            <select
              id="filtro-estado"
              value={filtros.estado}
              onChange={(e) => handleFiltroChange('estado', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos</option>
              {ESTADOS.map((e) => (
                <option key={e.value} value={e.value}>{e.label}</option>
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
              onChange={(e) => handleFiltroChange('nivelId', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos</option>
              {catalogos.niveles.map((n) => (
                <option key={n.id} value={n.id}>{n.nombre}</option>
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
              onChange={(e) => handleFiltroChange('gradoId', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={!filtros.nivelId}
            >
              <option value="">Todos</option>
              {gradosFiltrados.map((g) => (
                <option key={g.id} value={g.id}>{g.nombre}</option>
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
              onChange={(e) => handleFiltroChange('seccionId', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={!filtros.gradoId}
            >
              <option value="">Todos</option>
              {seccionesFiltradas.map((s) => (
                <option key={s.id} value={s.id}>{s.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="filtro-rol" className="block text-sm font-medium text-slate-700 mb-1">
              Rol
            </label>
            <select
              id="filtro-rol"
              value={filtros.rol}
              onChange={(e) => handleFiltroChange('rol', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos</option>
              <option value="SUPER_ADMIN">SuperAdmin</option>
              <option value="DIRECTOR">Director</option>
              <option value="DOCENTE">Docente</option>
              <option value="APODERADO">Apoderado</option>
              <option value="ALUMNO">Alumno</option>
            </select>
          </div>
          <div className="lg:col-span-2 flex items-end gap-3">
            <button
              onClick={() => setFiltros(FILTROS_INICIALES)}
              className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700 text-sm"
            >
              Limpiar
            </button>
          </div>
        </div>
      </div>

      {/* Tabla de anuncios */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {anuncios.length === 0 && !errorCarga ? (
          <div className="p-8 text-center text-slate-500">
            No se encontraron anuncios.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Título
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Tipo
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Estado
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Autor
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Publicado
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {anuncios.map((anuncio) => (
                    <tr key={anuncio.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-sm text-slate-900">
                        <div className="font-medium">{anuncio.titulo}</div>
                        <div className="text-xs text-slate-500 truncate max-w-xs">
                          {anuncio.cuerpo}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {anuncio.tipo}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
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
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {anuncio.autorId}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {anuncio.publicadoEn ? new Date(anuncio.publicadoEn).toLocaleString('es-PE') : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => abrirFormularioEditar(anuncio)}
                            className="px-3 py-1 text-xs border border-slate-300 rounded hover:bg-slate-50 text-slate-700"
                          >
                            Editar
                          </button>
                          {anuncio.estado !== 'ARCHIVADO' && (
                            <button
                              onClick={() => confirmarEliminar(anuncio.id)}
                              disabled={eliminandoId === anuncio.id}
                              className="px-3 py-1 text-xs border border-red-300 rounded hover:bg-red-50 text-red-700"
                            >
                              {eliminandoId === anuncio.id ? 'Archivando...' : 'Archivar'}
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
            <div className="border-t border-slate-200 p-4 flex items-center justify-between">
              <span className="text-sm text-slate-500">
                {meta.total} resultado(s) · Página {meta.page} de {Math.ceil(meta.total / meta.pageSize) || 1}
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

        {/* Modal de formulario */}
        {mostrarFormulario && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-auto">
              <div className="p-4 border-b border-slate-200 flex justify-between items-center">
                <h2 className="text-lg font-semibold text-slate-900">
                  {anuncioEditando ? 'Editar anuncio' : 'Crear anuncio'}
                </h2>
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
                <AnuncioForm
                  anuncio={anuncioEditando ?? undefined}
                  onGuardado={handleGuardado}
                  onCancelar={cerrarFormulario}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default AnunciosPage