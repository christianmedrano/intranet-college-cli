/** Pantalla inicial provisional; el panel real se define en su feature. */
export function HomePage() {
  return (
    <section aria-labelledby="home-title" className="space-y-2">
      <h1 id="home-title" className="text-2xl font-semibold">
        Panel
      </h1>
      <p className="text-slate-600">Bienvenido a la intranet escolar.</p>
    </section>
  )
}
