import { z } from 'zod'

/**
 * Credenciales de acceso.
 *
 * `identifier` acepta nombre de usuario, correo o número de documento
 * (RN-CORE-015). No se valida su formato a propósito: la resolución y la
 * detección de ambigüedad son responsabilidad del servicio, que debe responder
 * sin revelar cuál de los datos falló.
 */
export const loginSchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(1, 'El identificador es obligatorio')
    .max(150, 'El identificador es demasiado largo'),
  password: z
    .string()
    .min(1, 'La contraseña es obligatoria')
    .max(200, 'La contraseña es demasiado larga'),
})

export type LoginInput = z.infer<typeof loginSchema>
