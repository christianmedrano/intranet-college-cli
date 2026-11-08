import {
  loginResponseSchema,
  meResponseSchema,
  type LoginInput,
  type MeResponse,
} from '@intranet/shared'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  apiRequest,
  apiRequestSinContenido,
  refreshAccessToken,
  setAccessToken,
} from '../../shared/api/client'
import { AuthContext, type AuthContextValue } from './auth-context'

interface AuthProviderProps {
  children: ReactNode
}

/**
 * Mantiene la sesión en memoria y la restaura al recargar (RF-CORE-006).
 *
 * Al montar intenta renovar el access token con la cookie `HttpOnly`; si lo
 * consigue, consulta `GET /me`. Un fallo deja la aplicación como anónima sin
 * bloquear el render.
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [usuario, setUsuario] = useState<MeResponse | null>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let vigente = true

    async function restaurarSesion() {
      const renovado = await refreshAccessToken()

      if (!vigente) {
        return
      }

      if (!renovado) {
        setCargando(false)
        return
      }

      try {
        const perfil = await apiRequest('/me', meResponseSchema)

        if (vigente) {
          setUsuario(perfil)
        }
      } catch {
        setAccessToken(null)
      } finally {
        if (vigente) {
          setCargando(false)
        }
      }
    }

    void restaurarSesion()

    return () => {
      vigente = false
    }
  }, [])

  const iniciarSesion = useCallback(async (input: LoginInput) => {
    const sesion = await apiRequest('/auth/login', loginResponseSchema, {
      method: 'POST',
      body: input,
      sinRefresh: true,
    })

    setAccessToken(sesion.accessToken)

    try {
      const perfil = await apiRequest('/me', meResponseSchema)
      setUsuario(perfil)
    } catch (error) {
      setAccessToken(null)
      setUsuario(null)
      throw error
    }
  }, [])

  const cerrarSesion = useCallback(async () => {
    try {
      await apiRequestSinContenido('/auth/logout', {
        method: 'POST',
        sinRefresh: true,
      })
    } finally {
      setAccessToken(null)
      setUsuario(null)
    }
  }, [])

  const valor = useMemo<AuthContextValue>(
    () => ({ usuario, cargando, iniciarSesion, cerrarSesion }),
    [usuario, cargando, iniciarSesion, cerrarSesion],
  )

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>
}
