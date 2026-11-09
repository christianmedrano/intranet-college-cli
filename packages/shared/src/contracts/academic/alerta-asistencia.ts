/**
 * Alerta de inasistencias consultable (RF-ACAD-009, RN-ACAD-016).
 *
 * Es única por alumno y año; se recalcula al registrar asistencia, aprobar una
 * justificación o cambiar el umbral.
 */
export interface AlertaAsistenciaResponse {
  id: string
  alumnoId: string
  anioId: string
  faltasInjustificadas: number
  umbral: number
  generadaEn: string
  actualizadaEn: string
}
