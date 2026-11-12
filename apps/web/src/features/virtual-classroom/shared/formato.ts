/**
 * Formatea una fecha ISO a formato local (dd/mm/yyyy).
 */
export function formatoFecha(fechaISO: string): string {
  const fecha = new Date(fechaISO)
  return fecha.toLocaleDateString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

/**
 * Formatea una fecha ISO a formato local con hora (dd/mm/yyyy HH:MM).
 */
export function formatoFechaHora(fechaISO: string): string {
  const fecha = new Date(fechaISO)
  return fecha.toLocaleString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

/**
 * Trunca un texto a una longitud máxima añadiendo puntos suspensivos.
 */
export function truncarTexto(texto: string, max: number): string {
  if (texto.length <= max) return texto
  return `${texto.slice(0, max - 3)}...`
}

/**
 * Genera un mensaje de error amigable a partir de un error de la API.
 */
export function mensajeError(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return 'Ocurrió un error inesperado.'
}

/**
 * Formatea el tamaño de archivo a texto legible (KB, MB).
 */
export function formatoTamanio(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}