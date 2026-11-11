import type { FastifyRequest } from 'fastify'
import {
  permissionsForRoles,
  roleCodes,
  type Permission,
  type RoleCode,
} from '@intranet/shared'
import { AppError } from './errors.js'

/** Identidad ya autenticada que consume el guard de permisos (T012). */
export interface AuthActor {
  id: string
  roles: RoleCode[]
  /** Institución a la que pertenece el usuario (para multi-institución futuro). */
  institucionId: string
  /**
   * `true` mientras el usuario siga con el PIN temporal (RF-CORE-017).
   *
   * Mientras esté activo solo se permiten los endpoints de autenticación; el
   * guard de permisos bloquea el resto de recursos.
   */
  debeCambiarPassword: boolean
}

declare module 'fastify' {
  interface FastifyRequest {
    authUser?: AuthActor
  }
}

/**
 * Permisos efectivos de un conjunto de roles.
 * Delega en `packages/shared` para que web y api coincidan.
 */
export function getEffectivePermissions(
  roles: readonly RoleCode[],
): Permission[] {
  return permissionsForRoles(roles)
}

/**
 * Normaliza códigos de rol leídos de la base.
 *
 * Descarta los desconocidos y los duplicados. Un rol que no está en el catálogo
 * se ignora a propósito: nunca debe otorgar permisos por accidente.
 *
 * @param codigos Códigos tal como están almacenados.
 * @returns Roles del catálogo, en su orden canónico.
 */
export function normalizeRoleCodes(codigos: readonly string[]): RoleCode[] {
  const presentes = new Set(codigos)

  return roleCodes.filter((codigo) => presentes.has(codigo))
}

/** Indica si el conjunto de roles otorga el permiso solicitado. */
export function hasPermission(
  roles: readonly RoleCode[],
  permission: Permission,
): boolean {
  return permissionsForRoles(roles).includes(permission)
}

/**
 * Crea un `preHandler` que exige un permiso concreto.
 *
 * Rechaza con 401 si no hay identidad, con 403 si el usuario aún debe cambiar
 * su contraseña temporal (RF-CORE-017) y con 403 si el permiso no está
 * otorgado. Requiere que un guard previo haya hidratado `request.authUser`.
 *
 * @param permission Permiso del catálogo compartido.
 */
export function requirePermission(permission: Permission) {
  return async function permissionGuard(
    request: FastifyRequest,
  ): Promise<void> {
    if (!request.authUser) {
      throw new AppError('UNAUTHORIZED')
    }

    if (request.authUser.debeCambiarPassword) {
      throw new AppError(
        'FORBIDDEN',
        'Debes cambiar tu contraseña antes de continuar.',
      )
    }

    if (!hasPermission(request.authUser.roles, permission)) {
      throw new AppError('FORBIDDEN')
    }
  }
}

/**
 * Crea un `preHandler` que exige al menos uno de los permisos indicados.
 *
 * Se usa en rutas cuya operación admite permisos alternativos según el estado
 * del recurso; por ejemplo, editar una calificación exige `gestionar` con el
 * período abierto y `corregir` con el período cerrado. El servicio sigue
 * decidiendo cuál corresponde; este guard solo exige que el actor tenga alguno
 * de los dos y evita revelar el estado del período a quien no puede operar.
 *
 * @param permissions Permisos alternativos del catálogo compartido.
 */
export function requireAnyPermission(permissions: readonly Permission[]) {
  return async function anyPermissionGuard(
    request: FastifyRequest,
  ): Promise<void> {
    const actor = request.authUser

    if (!actor) {
      throw new AppError('UNAUTHORIZED')
    }

    if (actor.debeCambiarPassword) {
      throw new AppError(
        'FORBIDDEN',
        'Debes cambiar tu contraseña antes de continuar.',
      )
    }

    if (
      !permissions.some((permission) =>
        hasPermission(actor.roles, permission),
      )
    ) {
      throw new AppError('FORBIDDEN')
    }
  }
}
