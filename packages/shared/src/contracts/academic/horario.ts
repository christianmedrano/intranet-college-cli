import type { DiaSemana } from '../../domain/academic.js'

/**
 * Bloque de horario semanal (RF-ACAD-010).
 *
 * `horaInicio` y `horaFin` viajan como `HH:MM`, sin zona horaria, para no
 * introducir conversiones (RN-ACAD-019).
 */
export interface HorarioResponse {
  id: string
  anioId: string
  seccionId: string
  cursoId: string
  docenteId: string | null
  diaSemana: DiaSemana
  horaInicio: string
  horaFin: string
  createdAt: string
  updatedAt: string
}
