/**
 * Pantalla de inicio de sesión.
 *
 * En esta tarea solo cubre el punto de montaje de la ruta `/login`; el
 * formulario, los estados y la accesibilidad se implementan en T035.
 */
export function LoginPage() {
  return (
    <section
      aria-labelledby="login-title"
      className="mx-auto w-full max-w-sm space-y-2"
    >
      <h1 id="login-title" className="text-2xl font-semibold">
        Iniciar sesión
      </h1>
      <p className="text-slate-600">
        Accede con tu usuario, correo o número de documento.
      </p>
    </section>
  )
}
