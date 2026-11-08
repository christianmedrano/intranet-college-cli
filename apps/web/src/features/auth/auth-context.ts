import { createContext } from 'react'
import type { LoginInput, MeResponse } from '@intranet/shared'

/** Estado y acciones de la sesión expuestos a la aplicación. */
export interface AuthContextValue {
  usuario: MeResponse | null
  /** `true` mientras se intenta restaurar la sesión al cargar la app. */
  cargando: boolean
  iniciarSesion: (input: LoginInput) => Promise<void>
  cerrarSesion: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
