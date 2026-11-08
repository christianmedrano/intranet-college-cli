import type { RoleCode } from '@intranet/shared'
import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '../../features/auth/useAuth'

interface RequireAuthProps {
  /**
   * Roles admitidos. Si se omite, basta con tener sesión.
   *
   * Cuando el usuario no tiene ninguno, se le redirige al panel; las
   * landings por rol se definirán cuando existan sus módulos.
   */
  roles?: readonly RoleCode[]
}

/**
 * Guard de rutas del frontend (RF-CORE-005).
 *
 * El backend siempre revalida el token y los permisos: este guard solo evita
 * renderizar pantallas privadas y mejora la experiencia de navegación.
 */
export function RequireAuth({ roles }: RequireAuthProps) {
  const { usuario, cargando } = useAuth()
  const ubicacion = useLocation()

  if (cargando) {
    return (
      <p role="status" className="text-sm text-slate-600">
        Cargando sesión…
      </p>
    )
  }

  if (!usuario) {
    return (
      <Navigate to="/login" replace state={{ desde: ubicacion.pathname }} />
    )
  }

  if (roles && !roles.some((rol) => usuario.roles.includes(rol))) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
