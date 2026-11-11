/** Adjunto devuelto por la API (RF-COM-006). */
export interface AdjuntoResponse {
  id: string
  nombreOriginal: string
  url: string
  tipoMime: string
  tamanoBytes: number
  createdAt: string
}