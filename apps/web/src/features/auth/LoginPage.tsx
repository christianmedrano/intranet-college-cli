import { loginSchema, type LoginInput } from '@intranet/shared'
import { useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { ApiClientError } from '../../shared/api/client'
import { useAuth } from './useAuth'

const VALORES_INICIALES: LoginInput = { identifier: '', password: '' }

function mensajeGeneral(error: unknown): string {
  if (error instanceof ApiClientError) {
    return error.message
  }

  return 'Ocurrió un error inesperado. Inténtalo de nuevo.'
}

/**
 * Pantalla de inicio de sesión (RF-CORE-004).
 *
 * Valida con el mismo schema que la API, anuncia los errores con `role="alert"`
 * y mantiene el foco en un formulario con etiquetas explícitas.
 */
export function LoginPage() {
  const navegar = useNavigate()
  const { iniciarSesion } = useAuth()
  const [valores, setValores] = useState<LoginInput>(VALORES_INICIALES)
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

    const validacion = loginSchema.safeParse(valores)

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
      const perfil = await iniciarSesion(validacion.data)

      navegar(perfil.debeCambiarPassword ? '/cambiar-password' : '/', {
        replace: true,
      })
    } catch (error) {
      setErrorGeneral(mensajeGeneral(error))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <section aria-labelledby="login-title" className="mx-auto w-full max-w-sm">
      <h1 id="login-title" className="text-2xl font-semibold">
        Iniciar sesión
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        Accede con tu usuario, correo o número de documento.
      </p>

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
            htmlFor="identifier"
            className="block text-sm font-medium text-slate-700"
          >
            Identificador
          </label>
          <input
            id="identifier"
            name="identifier"
            type="text"
            autoComplete="username"
            autoFocus
            value={valores.identifier}
            onChange={cambiar}
            aria-invalid={Boolean(errores.identifier)}
            aria-describedby={
              errores.identifier ? 'identifier-error' : undefined
            }
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          />
          {errores.identifier ? (
            <p
              id="identifier-error"
              role="alert"
              className="mt-1 text-sm text-red-700"
            >
              {errores.identifier}
            </p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-slate-700"
          >
            Contraseña
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={valores.password}
            onChange={cambiar}
            aria-invalid={Boolean(errores.password)}
            aria-describedby={errores.password ? 'password-error' : undefined}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          />
          {errores.password ? (
            <p
              id="password-error"
              role="alert"
              className="mt-1 text-sm text-red-700"
            >
              {errores.password}
            </p>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={enviando}
          className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {enviando ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>

      <p className="mt-4 text-center text-sm">
        <Link
          to="/recuperar-password"
          className="font-medium text-slate-900 underline underline-offset-4"
        >
          ¿Olvidaste tu contraseña?
        </Link>
      </p>
    </section>
  )
}
