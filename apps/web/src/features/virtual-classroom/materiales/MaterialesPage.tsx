import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import { useSearchParams } from 'react-router'
import { useAuth } from '../../auth/useAuth'
import { MaterialForm } from './MaterialForm'
import { MaterialDetalle } from './MaterialDetalle'
import {
  listarMateriales,
  obtenerMaterial,
  eliminarMaterial,
  type MaterialResponsePayload,
} from './api'
import {
  listarCursosCatalogo,
  listarSeccionesCatalogo,
  listarPeriodosCatalogo,
} from '../catalogo/api'
import { mensajeError, formatoFecha } from '../shared'

type Accion =
  | { tipo: 'crear' }
  | { tipo: 'editar'; material: MaterialResponsePayload }
  | { tipo: 'ver'; material: MaterialResponsePayload }
  | null

interface Filtros {
  cursoId: string
  seccionId: string
  periodoId: string
}

const FILTROS_VACIOS: Filtros = { cursoId: '', seccionId: '', periodoId: '' }

/** Tamaño de página del listado (RF-VIR-004). */
const TAMANO_PAGINA = 20

/** Opción de un selector del formulario de materiales. */
interface OpcionMaterial {
  id: string
  nombre: string
}

/** Construye opciones únicas a partir de los identificadores observados. */
function opcionesUnicas(valores: string[]): OpcionMaterial[] {
  return [...new Set(valores)].map((id) => ({ id, nombre: id }))
}

export function MaterialesPage() {
  const { usuario } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const anioId = searchParams.get('anioId')

  const [errorAnio, setErrorAnio] = useState<string | undefined>()
  const [materiales, setMateriales] = useState<MaterialResponsePayload[]>([])
  const [resultado, setResultado] = useState<{
    anioId: string
    error: string | null
    meta: { page: number; pageSize: number; total: number } | null
  } | null>(null)
  const [mensajeExito, setMensajeExito] = useState<string | null>(null)
  const [accion, setAccion] = useState<Accion>(null)
  const [recarga, setRecarga] = useState(0)
  const [pagina, setPagina] = useState(1)
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_VACIOS)
  const [filtrosAplicados, setFiltrosAplicados] =
    useState<Filtros>(FILTROS_VACIOS)
  const refExito = useRef<HTMLParagraphElement>(null)
  const refAnio = useRef<HTMLInputElement>(null)

  const cargando = Boolean(anioId) && resultado?.anioId !== anioId
  const errorCarga = resultado?.anioId === anioId ? resultado.error : null
  const meta = resultado?.anioId === anioId ? resultado.meta : null

  const permisos = usuario?.permissions ?? []
  const puedeLeer = permisos.includes('virtual.leer')
  const puedeGestionar = permisos.includes('virtual.gestionar')
  const puedeEliminar = permisos.includes('virtual.eliminar')

  // Catálogo académico para los selectores del formulario.
  const [catalogoCursos, setCatalogoCursos] = useState<OpcionMaterial[]>([])
  const [catalogoSecciones, setCatalogoSecciones] = useState<OpcionMaterial[]>([])
  const [catalogoPeriodos, setCatalogoPeriodos] = useState<OpcionMaterial[]>([])

  // Fallback: identificadores observados en el listado (para cuando no hay catálogo).
  const opcionesCursosFallback = useMemo(
    () => opcionesUnicas(materiales.map((material) => material.cursoId)),
    [materiales],
  )
  const opcionesSeccionesFallback = useMemo(
    () => opcionesUnicas(materiales.map((material) => material.seccionId)),
    [materiales],
  )
  const opcionesPeriodosFallback = useMemo(
    () => opcionesUnicas(materiales.map((material) => material.periodoId)),
    [materiales],
  )

  // Usar catálogo si está disponible, si no fallback a IDs observados.
  const opcionesCursos = catalogoCursos.length > 0 ? catalogoCursos : opcionesCursosFallback
  const opcionesSecciones =
    catalogoSecciones.length > 0 ? catalogoSecciones : opcionesSeccionesFallback
  const opcionesPeriodos =
    catalogoPeriodos.length > 0 ? catalogoPeriodos : opcionesPeriodosFallback

  // Cargar catálogo académico cuando se tiene anioId.
  useEffect(() => {
    if (!anioId) return

    let activo = true

    async function cargarCatalogo() {
      // anioId es string aquí porque el efecto solo se ejecuta si anioId es truthy
      const anioIdSeguro = anioId!

      try {
        const [cursos, secciones, periodos] = await Promise.all([
          listarCursosCatalogo(),
          listarSeccionesCatalogo({ anioId: anioIdSeguro }),
          listarPeriodosCatalogo({ anioId: anioIdSeguro }),
        ])

        if (!activo) return

        setCatalogoCursos(cursos)
        setCatalogoSecciones(secciones)
        setCatalogoPeriodos(periodos)
      } catch (error) {
        // Silenciar errores de catálogo; se usará fallback.
        console.warn('No se pudo cargar el catálogo académico:', error)
      }
    }

    cargarCatalogo()

    return () => {
      activo = false
    }
  }, [anioId])

  useEffect(() => {
    if (!anioId) return

    let activo = true

    listarMateriales(anioId, {
      page: pagina,
      pageSize: TAMANO_PAGINA,
      ...(filtrosAplicados.cursoId
        ? { cursoId: filtrosAplicados.cursoId }
        : {}),
      ...(filtrosAplicados.seccionId
        ? { seccionId: filtrosAplicados.seccionId }
        : {}),
      ...(filtrosAplicados.periodoId
        ? { periodoId: filtrosAplicados.periodoId }
        : {}),
    })
      .then((lista) => {
        if (!activo) return
        setMateriales(lista.data)
        setResultado({
          anioId,
          error: null,
          meta: lista.meta,
        })
      })
      .catch((error: unknown) => {
        if (activo) {
          setResultado({ anioId, error: mensajeError(error), meta: null })
        }
      })

    return () => {
      activo = false
    }
  }, [anioId, recarga, pagina, filtrosAplicados])

  useEffect(() => {
    if (mensajeExito) refExito.current?.focus()
  }, [mensajeExito])

  function consultarAnio(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const valor = refAnio.current?.value.trim() ?? ''

    if (valor.length === 0) {
      setErrorAnio('Indica el identificador del año académico.')
      return
    }

    const siguientes = new URLSearchParams(searchParams)
    siguientes.set('anioId', valor)
    setSearchParams(siguientes)
    setAccion(null)
    setMensajeExito(null)
    setPagina(1)
    setFiltros(FILTROS_VACIOS)
    setFiltrosAplicados(FILTROS_VACIOS)
  }

  function aplicarFiltros(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setPagina(1)
    setFiltrosAplicados(filtros)
  }

  function limpiarFiltros() {
    setFiltros(FILTROS_VACIOS)
    setFiltrosAplicados(FILTROS_VACIOS)
    setPagina(1)
  }

  function cambiarFiltro(campo: keyof Filtros, valor: string) {
    setFiltros((actual) => ({ ...actual, [campo]: valor }))
  }

  async function abrirVer(material: MaterialResponsePayload) {
    try {
      const detalle = await obtenerMaterial(material.id, anioId ?? '')
      setAccion({ tipo: 'ver', material: detalle })
    } catch (error) {
      setErrorAnio(mensajeError(error))
    }
  }

  async function abrirEditar(material: MaterialResponsePayload) {
    try {
      const detalle = await obtenerMaterial(material.id, anioId ?? '')
      setAccion({ tipo: 'editar', material: detalle })
    } catch (error) {
      setErrorAnio(mensajeError(error))
    }
  }

  async function eliminar(materialId: string) {
    if (
      !window.confirm(
        '¿Eliminar este material? Se marcará como eliminado (baja lógica).',
      )
    ) {
      return
    }

    try {
      await eliminarMaterial(materialId)
      setAccion(null)
      setMensajeExito('Material eliminado correctamente.')
      setRecarga((actual) => actual + 1)
    } catch (error) {
      setErrorAnio(mensajeError(error))
    }
  }

  function alExito(mensaje?: string) {
    setAccion(null)
    setMensajeExito(mensaje ?? null)
    setRecarga((actual) => actual + 1)
  }

  function alCancelar() {
    setAccion(null)
  }

  const hayFiltrosActivos =
    filtrosAplicados.cursoId.length > 0 ||
    filtrosAplicados.seccionId.length > 0 ||
    filtrosAplicados.periodoId.length > 0

  return (
    <section aria-labelledby="materiales-title" className="space-y-6">
      <div>
        <h1 id="materiales-title" className="text-2xl font-semibold">
          Aula Virtual
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Repositorio de materiales pedagógicos por curso, sección y período.
        </p>
      </div>

      <form
        aria-label="Consultar año académico"
        className="rounded-md border border-slate-200 bg-white p-4"
        noValidate
        onSubmit={consultarAnio}
      >
        <label
          htmlFor="anio-id"
          className="block text-sm font-medium text-slate-700"
        >
          Identificador del año académico
        </label>
        <div className="mt-1 flex flex-wrap gap-2">
          <input
            id="anio-id"
            key={anioId ?? 'sin-anio'}
            ref={refAnio}
            name="anioId"
            type="text"
            defaultValue={anioId ?? ''}
            onChange={() => setErrorAnio(undefined)}
            aria-invalid={Boolean(errorAnio)}
            aria-describedby={errorAnio ? 'anio-id-error' : 'anio-id-hint'}
            className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          />
          <button
            type="submit"
            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          >
            Consultar
          </button>
        </div>
        {errorAnio ? (
          <p
            id="anio-id-error"
            role="alert"
            className="mt-1 text-sm text-red-700"
          >
            {errorAnio}
          </p>
        ) : (
          <p id="anio-id-hint" className="mt-1 text-sm text-slate-500">
            Corresponde al año lectivo cuyos materiales deseas consultar.
          </p>
        )}
      </form>

      {!puedeLeer ? (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          No tienes permiso para consultar materiales.
        </div>
      ) : null}

      {mensajeExito ? (
        <p
          ref={refExito}
          role="status"
          tabIndex={-1}
          className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800"
        >
          {mensajeExito}
        </p>
      ) : null}

      {!anioId ? (
        <p className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
          Indica el año académico para consultar los materiales.
        </p>
      ) : null}

      {anioId && puedeLeer ? (
        <form
          aria-label="Filtrar materiales"
          className="rounded-md border border-slate-200 bg-white p-4"
          noValidate
          onSubmit={aplicarFiltros}
        >
          <h2 className="text-base font-medium text-slate-800">Filtros</h2>
          <div className="mt-2 grid gap-3 md:grid-cols-3">
            <div>
              <label
                htmlFor="filtro-curso"
                className="block text-sm font-medium text-slate-700"
              >
                Curso
              </label>
              <input
                id="filtro-curso"
                type="text"
                list="filtro-cursos"
                value={filtros.cursoId}
                onChange={(evento) =>
                  cambiarFiltro('cursoId', evento.target.value.trim())
                }
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
              />
              <datalist id="filtro-cursos">
                {opcionesCursos.map((opcion) => (
                  <option key={opcion.id} value={opcion.id}>
                    {opcion.nombre}
                  </option>
                ))}
              </datalist>
            </div>
            <div>
              <label
                htmlFor="filtro-seccion"
                className="block text-sm font-medium text-slate-700"
              >
                Sección
              </label>
              <input
                id="filtro-seccion"
                type="text"
                list="filtro-secciones"
                value={filtros.seccionId}
                onChange={(evento) =>
                  cambiarFiltro('seccionId', evento.target.value.trim())
                }
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
              />
              <datalist id="filtro-secciones">
                {opcionesSecciones.map((opcion) => (
                  <option key={opcion.id} value={opcion.id}>
                    {opcion.nombre}
                  </option>
                ))}
              </datalist>
            </div>
            <div>
              <label
                htmlFor="filtro-periodo"
                className="block text-sm font-medium text-slate-700"
              >
                Período
              </label>
              <input
                id="filtro-periodo"
                type="text"
                list="filtro-periodos"
                value={filtros.periodoId}
                onChange={(evento) =>
                  cambiarFiltro('periodoId', evento.target.value.trim())
                }
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
              />
              <datalist id="filtro-periodos">
                {opcionesPeriodos.map((opcion) => (
                  <option key={opcion.id} value={opcion.id}>
                    {opcion.nombre}
                  </option>
                ))}
              </datalist>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="submit"
              className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            >
              Aplicar filtros
            </button>
            <button
              type="button"
              onClick={limpiarFiltros}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            >
              Limpiar filtros
            </button>
          </div>
        </form>
      ) : null}

      {anioId && cargando ? (
        <p role="status" className="text-sm text-slate-600">
          Cargando materiales…
        </p>
      ) : null}

      {anioId && errorCarga ? (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {errorCarga}
        </div>
      ) : null}

      {anioId && !cargando && !errorCarga && puedeLeer ? (
        <section aria-labelledby="lista-materiales-title">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="lista-materiales-title" className="text-xl font-semibold">
              Materiales del año
              {meta ? (
                <span className="ml-2 text-sm font-normal text-slate-500">
                  ({meta.total} total)
                </span>
              ) : null}
            </h2>
            {puedeGestionar && !accion ? (
              <button
                type="button"
                onClick={() => setAccion({ tipo: 'crear' })}
                className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
              >
                Nuevo material
              </button>
            ) : null}
          </div>

          {accion && accion.tipo === 'crear' ? (
            <div className="mt-3 rounded-md border border-slate-200 bg-white p-4">
              <h3 id="material-form-title" className="text-lg font-medium">
                Nuevo material
              </h3>
              <MaterialForm
                anioId={anioId}
                cursos={opcionesCursos}
                secciones={opcionesSecciones}
                periodos={opcionesPeriodos}
                onGuardado={alExito}
                onCancelar={alCancelar}
              />
            </div>
          ) : null}

          {accion && (accion.tipo === 'editar' || accion.tipo === 'ver') ? (
            <div className="mt-3 rounded-md border border-slate-200 bg-white p-4">
              <h3 id="material-form-title" className="text-lg font-medium">
                {accion.tipo === 'editar'
                  ? 'Editar material'
                  : 'Detalle del material'}
              </h3>
              {accion.tipo === 'editar' ? (
                <MaterialForm
                  materialId={accion.material.id}
                  anioId={anioId}
                  cursos={opcionesCursos}
                  secciones={opcionesSecciones}
                  periodos={opcionesPeriodos}
                  onGuardado={alExito}
                  onCancelar={alCancelar}
                />
              ) : (
                <MaterialDetalle
                  material={accion.material}
                  anioId={anioId}
                  onEditar={() => abrirEditar(accion.material)}
                  onCerrar={alCancelar}
                  puedeEliminar={puedeEliminar}
                  onEliminar={() => eliminar(accion.material.id)}
                />
              )}
            </div>
          ) : null}

          {materiales.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600">
              {hayFiltrosActivos
                ? 'No hay materiales que coincidan con los filtros.'
                : 'No hay materiales registrados en este año.'}
            </p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <caption className="sr-only">
                  Materiales registrados en el año
                </caption>
                <thead>
                  <tr className="border-b border-slate-200">
                    <th scope="col" className="px-2 py-2 font-medium">
                      Título
                    </th>
                    <th scope="col" className="px-2 py-2 font-medium">
                      Curso / Sección / Período
                    </th>
                    <th scope="col" className="px-2 py-2 font-medium">
                      Docente
                    </th>
                    <th scope="col" className="px-2 py-2 font-medium">
                      Archivo
                    </th>
                    <th scope="col" className="px-2 py-2 font-medium">
                      Fecha
                    </th>
                    <th scope="col" className="px-2 py-2 font-medium">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {materiales.map((fila) => (
                    <tr key={fila.id} className="border-b border-slate-100">
                      <th scope="row" className="px-2 py-2 font-medium">
                        {fila.titulo}
                        {fila.descripcion ? (
                          <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                            {fila.descripcion}
                          </p>
                        ) : null}
                      </th>
                      <td className="px-2 py-2">
                        <div className="space-y-1 text-xs">
                          <code className="break-all">{fila.cursoId}</code>
                          <code className="break-all">{fila.seccionId}</code>
                          <code className="break-all">{fila.periodoId}</code>
                        </div>
                      </td>
                      <td className="px-2 py-2">
                        <code className="break-all text-xs">
                          {fila.docenteId}
                        </code>
                      </td>
                      <td className="px-2 py-2 text-sm">
                        <div className="flex items-center gap-1">
                          <span className="text-slate-700">
                            {fila.archivoNombre}
                          </span>
                          <span className="text-slate-400">
                            ({fila.archivoMime})
                          </span>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-sm text-slate-600">
                        {formatoFecha(fila.createdAt)}
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => abrirVer(fila)}
                            aria-label={`Ver detalle del material ${fila.titulo}`}
                            className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                          >
                            Ver
                          </button>
                          {puedeGestionar ? (
                            <button
                              type="button"
                              onClick={() => abrirEditar(fila)}
                              aria-label={`Editar material ${fila.titulo}`}
                              className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                            >
                              Editar
                            </button>
                          ) : null}
                          {puedeEliminar ? (
                            <button
                              type="button"
                              onClick={() => eliminar(fila.id)}
                              aria-label={`Eliminar material ${fila.titulo}`}
                              className="rounded-md border border-red-300 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
                            >
                              Eliminar
                            </button>
                          ) : null}
                          {!puedeGestionar && !puedeEliminar ? (
                            <span className="text-xs text-slate-500">
                              Solo consulta
                            </span>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {meta && meta.total > meta.pageSize ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-slate-600">
                Página {meta.page} de{' '}
                {Math.max(1, Math.ceil(meta.total / meta.pageSize))}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPagina((actual) => Math.max(1, actual - 1))}
                  disabled={meta.page <= 1}
                  className="rounded-md border border-slate-300 px-3 py-1 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Anterior
                </button>
                <button
                  type="button"
                  onClick={() => setPagina((actual) => actual + 1)}
                  disabled={meta.page * meta.pageSize >= meta.total}
                  className="rounded-md border border-slate-300 px-3 py-1 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Siguiente
                </button>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
    </section>
  )
}
