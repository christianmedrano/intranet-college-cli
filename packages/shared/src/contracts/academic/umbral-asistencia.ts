/**
 * Umbral de inasistencias de un año (RF-ACAD-008).
 *
 * `faltasParaAlerta` es `null` cuando el año no tiene umbral configurado; en
 * ese caso no se generan alertas (RN-ACAD-014).
 */
export interface UmbralAsistenciaResponse {
  anioId: string
  faltasParaAlerta: number | null
}
