import { Link, Outlet, useNavigate } from 'react-router'
import { useAuth } from '../../features/auth/useAuth'

/**
 * Layout base de la intranet: cabecera, contenido y pie.
 *
 * Las rutas hijas se renderizan en el `Outlet` dentro de `<main>`, de modo que
 * todas las pantallas comparten la misma estructura accesible.
 *
 * La cabecera muestra al usuario autenticado y permite cerrar la sesión
 * (RF-CORE-005, RF-CORE-006). Solo se exponen nombres y apellidos: el número de
 * documento es dato personal y no se muestra.
 */
export function AppLayout() {
  const { usuario, cerrarSesion } = useAuth()
  const navigate = useNavigate()

  async function handleCerrarSesion() {
    await cerrarSesion()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-4">
          <Link to="/" className="text-lg font-semibold">
            Intranet Escolar
          </Link>
          {usuario ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-700">
                {usuario.persona.nombres} {usuario.persona.apellidos}
              </span>
              <button
                type="button"
                onClick={() => void handleCerrarSesion()}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
              >
                Cerrar sesión
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            >
              Iniciar sesión
            </Link>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 px-4 py-4 text-center text-sm text-slate-500">
        Intranet Escolar
      </footer>
    </div>
  )
}
