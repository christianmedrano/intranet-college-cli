import { useContext } from 'react'
import { AuthContext, type AuthContextValue } from './auth-context'

/**
 * Accede al estado de sesión.
 *
 * @throws Error si se usa fuera de `<AuthProvider>`.
 */
export function useAuth(): AuthContextValue {
  const contexto = useContext(AuthContext)

  if (!contexto) {
    throw new Error('useAuth debe usarse dentro de <AuthProvider>.')
  }

  return contexto
}
