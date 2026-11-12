import {
  TIPOS_MIME_PERMITIDOS,
  TAMANO_MAXIMO_BYTES,
  esTipoMimePermitido,
  esTamanoValido,
  type AdjuntoVirtualResponse,
} from '@intranet/shared'
import { formatoTamanio } from './formato'

/** Extiende la respuesta de adjunto con helpers para UI. */
export interface AdjuntoVirtualUI extends AdjuntoVirtualResponse {
  /** Preview para imágenes (object URL) */
  preview?: string | null
  /** Indica si es una imagen */
  esImagen: boolean
  /** Tamaño formateado */
  tamanioFormateado: string
}

/** Convierte una respuesta de API a formato UI. */
export function adjuntoAUI(adjunto: AdjuntoVirtualResponse): AdjuntoVirtualUI {
  return {
    ...adjunto,
    esImagen: adjunto.tipoMime.startsWith('image/'),
    tamanioFormateado: formatoTamanio(adjunto.tamanoBytes),
  }
}



/** Valida un archivo contra las restricciones de Aula Virtual. */
export function validarArchivoVirtual(archivo: File): string | null {
  if (!esTipoMimePermitido(archivo.type)) {
    return `Tipo de archivo no permitido: ${archivo.type}. Permitidos: PDF, DOCX, XLSX, PPTX, JPEG, PNG, WEBP`
  }
  if (!esTamanoValido(archivo.size)) {
    return `Archivo demasiado grande (${(archivo.size / 1024 / 1024).toFixed(1)} MB). Máximo: ${TAMANO_MAXIMO_BYTES / 1024 / 1024} MB`
  }
  return null
}

/** Genera un preview (object URL) para imágenes. */
export function generarPreview(archivo: File): string | null {
  if (archivo.type.startsWith('image/')) {
    return URL.createObjectURL(archivo)
  }
  return null
}

/** Revoca un preview generado anteriormente. */
export function revocarPreview(preview: string | null): void {
  if (preview) URL.revokeObjectURL(preview)
}

/** Tipos MIME permitidos para Aula Virtual (para atributo accept en input file). */
export const ACCEPT_VIRTUAL = TIPOS_MIME_PERMITIDOS.join(',')

/** Tamaño máximo en bytes (10 MB por defecto). */
export const MAX_TAMANO_VIRTUAL = TAMANO_MAXIMO_BYTES

/** Tipos MIME permitidos como lista legible. */
export const TIPOS_PERMITIDOS_LEGIBLES = TIPOS_MIME_PERMITIDOS.map((t) =>
  t.split('/')[1]?.toUpperCase() ?? t,
).join(', ')