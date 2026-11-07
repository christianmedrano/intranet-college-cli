import type { EstadoAnioAcademico } from '../schemas/anio-academico.js'

/**
 * Año académico expuesto por la API (RF-CORE-008).
 *
 * Las fechas viajan como `YYYY-MM-DD`, sin hora, porque en el modelo son
 * `DATE`. Se omiten las marcas de auditoría y el borrado lógico.
 */
export interface AnioAcademicoResponse {
  id: string
  nombre: string
  fechaInicio: string
  fechaFin: string
  estado: EstadoAnioAcademico
}
