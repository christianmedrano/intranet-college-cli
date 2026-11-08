import type {
  ChangePasswordInput,
  LoginInput,
  MeResponse,
} from '@intranet/shared'
import { createContext } from 'react'

/** Estado y acciones de la sesión expuestos a la aplicación. */
export interface AuthContextValue {
  usuario: MeResponse | null
  /** `true` mientras se intenta restaurar la sesión al cargar la app. */
  cargando: boolean
  /**
   * Inicia sesión y devuelve el perfil cargado.
   *
   * El perfil permite decidir la ruta posterior (por ejemplo, el cambio
   * obligatorio de contraseña) sin depender de un estado que aún no se ha
   * propagado.
   */
  iniciarSesion: (input: LoginInput) => Promise<MeResponse>
  /**
   * Cambia la contraseña del usuario autenticado. Al completarse, las sesiones
   * quedan revocadas y el contexto se limpia.
   */
  cambiarPassword: (input: ChangePasswordInput) => Promise<void>
  cerrarSesion: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
