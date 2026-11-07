import type { EstadoPeriodoAcademico } from '../schemas/periodo-academico.js'

/**
 * Período académico expuesto por la API (RF-CORE-009).
 *
 * Las fechas viajan como `YYYY-MM-DD` porque en el modelo son `DATE`. `orden`
 * es el criterio de presentación; el nombre no está atado a bimestres ni
 * trimestres (RN-CORE-003).
 */
export interface PeriodoAcademicoResponse {
  id: string
  anioId: string
  nombre: string
  orden: number
  fechaInicio: string
  fechaFin: string
  estado: EstadoPeriodoAcademico
}
