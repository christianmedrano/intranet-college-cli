/**
 * Sección expuesta por la API (RF-CORE-010).
 *
 * `capacidad` es `null` cuando la institución no fija un aforo.
 */
export interface SeccionResponse {
  id: string
  gradoId: string
  anioId: string
  nombre: string
  capacidad: number | null
}
