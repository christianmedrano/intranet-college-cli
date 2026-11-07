import { AppError } from '../../../core/errors.js'

/** Convierte `YYYY-MM-DD` a la medianoche UTC que espera `@db.Date`. */
export function aFechaUTC(valor: string): Date {
  return new Date(`${valor}T00:00:00.000Z`)
}

/** Convierte el `DATE` de MySQL a `YYYY-MM-DD` sin desplazamiento de zona. */
export function aFechaISO(valor: Date): string {
  return valor.toISOString().slice(0, 10)
}

/**
 * Rechaza un rango de fechas invertido.
 *
 * Se compara sobre cadenas `YYYY-MM-DD`, que ordenan igual que las fechas.
 *
 * @throws AppError `VALIDATION_ERROR` con un detalle sobre `fechaFin`.
 */
export function assertRangoDeFechas(inicio: string, fin: string): void {
  if (fin < inicio) {
    throw new AppError('VALIDATION_ERROR', undefined, [
      'fechaFin: debe ser igual o posterior a fechaInicio',
    ])
  }
}
