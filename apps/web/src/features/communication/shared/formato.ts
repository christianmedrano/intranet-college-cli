import type { AnuncioEstado } from '@intranet/shared'

/**
 * Traduce un estado de anuncio a texto legible.
 */
export function etiquetaEstadoAnuncio(estado: AnuncioEstado): string {
  const etiquetas: Record<AnuncioEstado, string> = {
    BORRADOR: 'Borrador',
    PUBLICADO: 'Publicado',
    EXPIRADO: 'Expirado',
    ARCHIVADO: 'Archivado',
  }
  return etiquetas[estado] ?? estado
}

/**
 * Traduce un estado de justificación a texto legible.
 */
export function etiquetaEstadoJustificacion(estado: string): string {
  const etiquetas: Record<string, string> = {
    SOLICITADA: 'Solicitada',
    APROBADA: 'Aprobada',
    RECHAZADA: 'Rechazada',
  }
  return etiquetas[estado] ?? estado
}

/**
 * Formatea una fecha ISO a formato local (dd/mm/yyyy).
 */
export function formatoFechaCorta(fechaISO: string): string {
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