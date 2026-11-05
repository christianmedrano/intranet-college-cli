import { z } from 'zod'

/** Roles del sistema. Fuente normativa: `docs/rbac-matrix.md`. */
export const roleCodes = [
  'SUPER_ADMIN',
  'DIRECTOR',
  'DOCENTE',
  'APODERADO',
  'ALUMNO',
] as const

export type RoleCode = (typeof roleCodes)[number]

export const roleCodeSchema = z.enum(roleCodes)

/**
 * Catálogo de permisos del módulo core.
 *
 * Es la única fuente de verdad: un permiso que no esté aquí no compila.
 * Los módulos restantes agregan los suyos en su propia feature.
 */
export const permissionCodes = [
  'core.institucion.editar',
  'core.usuarios.gestionar',
  'core.estructura.gestionar',
  'core.matriculas.gestionar',
  'core.auditoria.leer',
  'core.perfil.leer',
] as const

export type Permission = (typeof permissionCodes)[number]

export const permissionSchema = z.enum(permissionCodes)

/**
 * Permisos otorgados por cada rol según la matriz RBAC.
 *
 * La matriz es un máximo: una feature puede exigir además el vínculo con el
 * recurso (por ejemplo, apoderado–alumno), pero nunca ampliar este conjunto.
 */
export const rolePermissions: Readonly<
  Record<RoleCode, readonly Permission[]>
> = {
  SUPER_ADMIN: [
    'core.institucion.editar',
    'core.usuarios.gestionar',
    'core.estructura.gestionar',
    'core.matriculas.gestionar',
    'core.auditoria.leer',
    'core.perfil.leer',
  ],
  DIRECTOR: [
    'core.institucion.editar',
    'core.usuarios.gestionar',
    'core.estructura.gestionar',
    'core.matriculas.gestionar',
    'core.auditoria.leer',
    'core.perfil.leer',
  ],
  DOCENTE: ['core.perfil.leer'],
  APODERADO: ['core.perfil.leer'],
  ALUMNO: ['core.perfil.leer'],
}

/**
 * Calcula los permisos efectivos de un usuario.
 *
 * Un usuario puede tener varios roles y sus permisos se unen (RN-CORE-010).
 * El resultado no contiene duplicados y respeta el orden del catálogo.
 *
 * @param roles Roles activos del usuario.
 * @returns Permisos efectivos, sin duplicados.
 */
export function permissionsForRoles(
  roles: readonly RoleCode[],
): Permission[] {
  const granted = new Set<Permission>()

  for (const role of roles) {
    for (const permission of rolePermissions[role]) {
      granted.add(permission)
    }
  }

  return permissionCodes.filter((permission) => granted.has(permission))
}
