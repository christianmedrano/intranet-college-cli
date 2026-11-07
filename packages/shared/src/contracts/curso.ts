/**
 * Curso expuesto por la API (RF-CORE-011).
 *
 * `area` es `null` cuando el curso no declara un área curricular.
 */
export interface CursoResponse {
  id: string
  nivelId: string
  nombre: string
  area: string | null
  orden: number
}
