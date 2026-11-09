import { z } from 'zod'

/**
 * Fecha escolar sin hora, en formato ISO `YYYY-MM-DD` (RN-ACAD-024).
 *
 * Se compara como cadena porque el formato ordena igual que el calendario.
 */
export const fechaEscolarSchema = z.iso.date(
  'La fecha debe tener el formato AAAA-MM-DD',
)

/** Observación libre de un registro académico. */
export const observacionSchema = z
  .string()
  .trim()
  .max(500, 'La observación es demasiado larga')

/** Motivo obligatorio de una corrección o rechazo (RN-ACAD-010). */
export const motivoObligatorioSchema = z
  .string()
  .trim()
  .min(1, 'El motivo es obligatorio')
  .max(500, 'El motivo es demasiado largo')

/** Hora `HH:MM` en formato de 24 horas (RN-ACAD-019). */
export const horaSchema = z
  .string()
  .regex(
    /^([01]\d|2[0-3]):[0-5]\d$/,
    'La hora debe tener el formato HH:MM',
  )
