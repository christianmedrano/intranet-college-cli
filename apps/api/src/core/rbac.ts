import type { FastifyRequest } from 'fastify'
import {
  permissionsForRoles,
  type Permission,
  type RoleCode,
} from '@intranet/shared'
import { AppError } from './errors.js'

/** Identidad ya autenticada que consume el guard de permisos (T012). */
export interface AuthActor {
  id: string
  roles: RoleCode[]
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
 * Rechaza con 401 si no hay identidad y con 403 si el permiso no está
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

    if (!hasPermission(request.authUser.roles, permission)) {
      throw new AppError('FORBIDDEN')
    }
  }
}
