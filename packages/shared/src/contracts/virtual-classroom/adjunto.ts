/**
 * Adjunto devuelto por la API para material virtual (RF-VIR-005).
 *
 * `url` es una URL de descarga directa (con token temporal o firmada).
 */
export interface AdjuntoVirtualResponse {
  id: string
  materialId: string
  nombreOriginal: string
  url: string
  tipoMime: string
  tamanoBytes: number
  createdAt: string
}