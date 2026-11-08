import type { ReactNode } from 'react'
import { AuthProvider } from '../features/auth/AuthProvider'

interface AppProvidersProps {
  children: ReactNode
}

/**
 * Composición de los providers globales de la aplicación.
 *
 * El estado de sesión vive en `AuthProvider`; los clientes de datos se
 * añadirán aquí en las siguientes tareas. Un único punto de composición evita
 * que el router conozca detalles de autenticación o de caché.
 */
export function AppProviders({ children }: AppProvidersProps) {
  return <AuthProvider>{children}</AuthProvider>
}
