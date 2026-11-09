import { z } from 'zod'
import { roleCodeSchema, roleCodes } from '../domain/permissions.js'
import { uuidSchema } from './base.js'

const usernameSchema = z
  .string()
  .trim()
  .min(1, 'El nombre de usuario no puede estar vacío')
  .max(60, 'El nombre de usuario es demasiado largo')
  .nullable()
  .optional()

const emailSchema = z
  .email('El correo no es válido')
  .trim()
  .max(150, 'El correo es demasiado largo')
  .nullable()
  .optional()

const rolesSchema = z
  .array(roleCodeSchema)
  .min(1, 'Debe asignar al menos un rol')
  .max(roleCodes.length, 'Demasiados roles para un solo usuario')

/**
 * Alta de una cuenta de acceso para una persona ya registrada (RF-CORE-002).
 *
 * La persona se crea en su módulo (`/alumnos`, `/docentes`, `/apoderados`) o
 * existe previamente; esta operación solo crea la cuenta. El PIN temporal se
 * genera en el servidor y se devuelve una única vez.
 */
export const crearUsuarioSchema = z.object({
  personaId: uuidSchema,
  username: usernameSchema,
  email: emailSchema,
  roles: rolesSchema,
})

export type CrearUsuarioInput = z.infer<typeof crearUsuarioSchema>

/**
 * Actualización parcial de la cuenta (RF-CORE-002).
 *
 * `activo: false` es la baja lógica: la cuenta queda deshabilitada y puede
 * reactivarse. Los roles enviados reemplazan al conjunto anterior; la persona
 * vinculada no se modifica.
 */
export const actualizarUsuarioSchema = z
  .object({
    username: usernameSchema,
    email: emailSchema,
    activo: z.boolean().optional(),
    roles: rolesSchema.optional(),
  })
  .refine((datos) => Object.keys(datos).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar',
  })

export type ActualizarUsuarioInput = z.infer<typeof actualizarUsuarioSchema>
