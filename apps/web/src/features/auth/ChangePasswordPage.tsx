import {
  changePasswordSchema,
  type ChangePasswordInput,
} from '@intranet/shared'
import { useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { ApiClientError } from '../../shared/api/client'
import { useAuth } from './useAuth'

const VALORES_INICIALES: ChangePasswordInput = {
  currentPassword: '',
  newPassword: '',
}

function mensajeError(error: unknown): string {
  if (error instanceof ApiClientError) {
    return error.details.length > 0 ? error.details.join(' ') : error.message
  }

  return 'Ocurrió un error inesperado. Inténtalo de nuevo.'
}

/**
 * Pantalla de cambio de contraseña (RF-CORE-017).
 *
 * Cubre el cambio obligatorio tras el primer acceso con PIN temporal y el
 * cambio voluntario. Al completarse, la API revoca todas las sesiones, así que
 * la pantalla vuelve al inicio de sesión.
 */
export function ChangePasswordPage() {
  const navegar = useNavigate()
  const { usuario, cambiarPassword } = useAuth()
  const [valores, setValores] = useState<ChangePasswordInput>(VALORES_INICIALES)
  const [errores, setErrores] = useState<Record<string, string | undefined>>({})
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  function cambiar(evento: ChangeEvent<HTMLInputElement>) {
    const { name, value } = evento.target

    setValores((actuales) => ({ ...actuales, [name]: value }))
    setErrores((actuales) => ({ ...actuales, [name]: undefined }))
  }

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setErrorGeneral(null)

    const validacion = changePasswordSchema.safeParse(valores)

    if (!validacion.success) {
      const nuevos: Record<string, string | undefined> = {}

      for (const issue of validacion.error.issues) {
        const campo = issue.path[0]

        if (typeof campo === 'string' && !nuevos[campo]) {
          nuevos[campo] = issue.message
        }
      }

      setErrores(nuevos)
      return
    }

    setErrores({})
    setEnviando(true)

    try {
      await cambiarPassword(validacion.data)
      navegar('/login', { replace: true })
    } catch (error) {
      setErrorGeneral(mensajeError(error))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <section
      aria-labelledby="change-password-title"
      className="mx-auto w-full max-w-sm"
    >
      <h1 id="change-password-title" className="text-2xl font-semibold">
        Cambiar contraseña
      </h1>

      {usuario?.debeCambiarPassword ? (
        <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Estás usando una contraseña temporal. Define una contraseña definitiva
          para continuar.
        </p>
      ) : (
        <p className="mt-2 text-sm text-slate-600">
          Actualiza tu contraseña de acceso.
        </p>
      )}

      {errorGeneral ? (
        <div
          role="alert"
          className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {errorGeneral}
        </div>
      ) : null}

      <form className="mt-6 space-y-4" noValidate onSubmit={enviar}>
        <div>
          <label
            htmlFor="currentPassword"
            className="block text-sm font-medium text-slate-700"
          >
            Contraseña actual
          </label>
          <input
            id="currentPassword"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            autoFocus
            value={valores.currentPassword}
            onChange={cambiar}
            aria-invalid={Boolean(errores.currentPassword)}
            aria-describedby={
              errores.currentPassword ? 'currentPassword-error' : undefined
            }
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          />
          {errores.currentPassword ? (
            <p
              id="currentPassword-error"
              role="alert"
              className="mt-1 text-sm text-red-700"
            >
              {errores.currentPassword}
            </p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor="newPassword"
            className="block text-sm font-medium text-slate-700"
          >
            Nueva contraseña
          </label>
          <input
            id="newPassword"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            value={valores.newPassword}
            onChange={cambiar}
            aria-invalid={Boolean(errores.newPassword)}
            aria-describedby={
              errores.newPassword ? 'newPassword-error' : 'newPassword-hint'
            }
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          />
          {errores.newPassword ? (
            <p
              id="newPassword-error"
              role="alert"
              className="mt-1 text-sm text-red-700"
            >
              {errores.newPassword}
            </p>
          ) : (
            <p id="newPassword-hint" className="mt-1 text-sm text-slate-500">
              Mínimo 10 caracteres y distinta a tu usuario, correo o documento.
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={enviando}
          className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {enviando ? 'Guardando…' : 'Cambiar contraseña'}
        </button>
      </form>
    </section>
  )
}
