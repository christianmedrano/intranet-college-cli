/**
 * Grado de estudios expuesto por la API (RF-CORE-010).
 *
 * `nivelId` permite al cliente agrupar los grados por nivel sin consultar la
 * relación completa.
 */
export interface GradoResponse {
  id: string
  nivelId: string
  nombre: string
  orden: number
}
