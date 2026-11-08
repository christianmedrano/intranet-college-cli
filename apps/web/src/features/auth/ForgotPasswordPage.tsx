import {
  forgotPasswordResponseSchema,
  forgotPasswordSchema,
} from '@intranet/shared'
import { useState, type ChangeEvent, type FormEvent } from 'react'
import { Link } from 'react-router'
import {
  ApiClientError,
  apiRequest,
} from '../../shared/api/client'

/** Mensaje neutro: no revela si el correo está registrado (RF-CORE-007). */
const MENSAJE_NEUTRO =
  'Si el correo está registrado, la administración podrá entregarte el enlace de recuperación.'

function mensajeGeneral(error: unknown): string {
  if (error instanceof ApiClientError) {
    return error.message
  }

  return 'Ocurrió un error inesperado. Inténtalo de nuevo.'
}

/**
 * Pantalla de solicitud de recuperación de contraseña (RF-CORE-007).
 *
 * Responde siempre con el mismo mensaje, exista o no la cuenta, para no
 * filtrar qué correos están registrados.
 */
export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)

  function cambiar(evento: ChangeEvent<HTMLInputElement>) {
    setEmail(evento.target.value)
    setError(null)
  }

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setErrorGeneral(null)

    const validacion = forgotPasswordSchema.safeParse({ email })

    if (!validacion.success) {
      setError(validacion.error.issues[0]?.message ?? 'El correo no es válido.')
      return
    }

    setEnviando(true)

    try {
      await apiRequest(
        '/auth/forgot-password',
        forgotPasswordResponseSchema,
        {
          method: 'POST',
          body: validacion.data,
          sinRefresh: true,
        },
      )
      setEnviado(true)
    } catch (errorSolicitud) {
      setErrorGeneral(mensajeGeneral(errorSolicitud))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <section
      aria-labelledby="forgot-title"
      className="mx-auto w-full max-w-sm"
    >
      <h1 id="forgot-title" className="text-2xl font-semibold">
        Recuperar contraseña
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        Ingresa el correo de tu cuenta. La administración del colegio te
        entregará un enlace de un solo uso.
      </p>

      {enviado ? (
        <div
          role="status"
          className="mt-6 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
        >
          {MENSAJE_NEUTRO}
        </div>
      ) : (
        <>
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
                htmlFor="email"
                className="block text-sm font-medium text-slate-700"
              >
                Correo electrónico
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={cambiar}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? 'email-error' : undefined}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
              />
              {error ? (
                <p
                  id="email-error"
                  role="alert"
                  className="mt-1 text-sm text-red-700"
                >
                  {error}
                </p>
              ) : null}
            </div>

            <button
              type="submit"
              disabled={enviando}
              className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {enviando ? 'Enviando…' : 'Enviar solicitud'}
            </button>
          </form>
        </>
      )}

      <p className="mt-6 text-center text-sm">
        <Link
          to="/login"
          className="font-medium text-slate-900 underline underline-offset-4"
        >
          Volver al inicio de sesión
        </Link>
      </p>
    </section>
  )
}
