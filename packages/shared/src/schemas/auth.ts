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

/**
 * Solicitud de recuperación de contraseña (RF-CORE-007).
 *
 * Solo se pide el correo: el servicio responde siempre igual para no revelar
 * qué cuentas existen.
 */
export const forgotPasswordSchema = z.object({
  email: z
    .email('El correo no es válido')
    .trim()
    .max(150, 'El correo es demasiado largo'),
})

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>

/**
 * Restablecimiento con token de un solo uso (RF-CORE-007).
 *
 * La longitud mínima se valida aquí; la comparación con el identificador y el
 * documento (RN-CORE-017) requiere datos del usuario y la hace el servicio.
 */
export const resetPasswordSchema = z.object({
  token: z
    .string()
    .trim()
    .min(1, 'El token es obligatorio')
    .max(200, 'El token no es válido'),
  password: z
    .string()
    .min(10, 'La contraseña debe tener al menos 10 caracteres')
    .max(200, 'La contraseña es demasiado larga'),
})

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
