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
 * Catálogo de permisos del sistema.
 *
 * Es la única fuente de verdad: un permiso que no esté aquí no compila.
 * Los códigos `academic.*` se registran en la versión 2.1.0 de la constitución
 * y en `docs/rbac-matrix.md`.
 */
export const permissionCodes = [
  'core.institucion.editar',
  'core.usuarios.gestionar',
  'core.estructura.gestionar',
  'core.matriculas.gestionar',
  'core.auditoria.leer',
  'core.perfil.leer',
  'academic.calificaciones.gestionar',
  'academic.calificaciones.corregir',
  'academic.calificaciones.leer',
  'academic.asistencias.gestionar',
  'academic.asistencias.leer',
  'academic.asistencias.solicitar',
  'academic.asistencias.justificar',
  'academic.horarios.gestionar',
  'academic.horarios.leer',
  'communication.anuncios.gestionar',
  'communication.anuncios.leer',
  'communication.mensajeria.gestionar',
  'communication.mensajeria.supervisar',
  'virtual.leer',
  'virtual.gestionar',
  'virtual.eliminar',
  // Administrative (ADM-001)
  'administrative.pagos.registrar',
  'administrative.pagos.anular',
  'administrative.pagos.leer',
  'administrative.matriculas.gestionar',
  'administrative.matriculas.leer',
  'administrative.certificados.emitir',
  'administrative.certificados.solicitar',
  'administrative.certificados.descargar',
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
    'academic.calificaciones.leer',
    'academic.horarios.gestionar',
    'academic.horarios.leer',
    'communication.anuncios.gestionar',
    'communication.anuncios.leer',
    'communication.mensajeria.supervisar',
    'virtual.leer',
    'virtual.eliminar',
    // Administrative (ADM-001)
    'administrative.pagos.registrar',
    'administrative.pagos.anular',
    'administrative.pagos.leer',
    'administrative.matriculas.gestionar',
    'administrative.matriculas.leer',
    'administrative.certificados.emitir',
    'administrative.certificados.solicitar',
    'administrative.certificados.descargar',
  ],
  DIRECTOR: [
    'core.institucion.editar',
    'core.usuarios.gestionar',
    'core.estructura.gestionar',
    'core.matriculas.gestionar',
    'core.auditoria.leer',
    'core.perfil.leer',
    'academic.calificaciones.corregir',
    'academic.calificaciones.leer',
    'academic.asistencias.gestionar',
    'academic.asistencias.leer',
    'academic.asistencias.justificar',
    'academic.horarios.gestionar',
    'academic.horarios.leer',
    'communication.anuncios.gestionar',
    'communication.anuncios.leer',
    'virtual.leer',
    'virtual.gestionar',
    'virtual.eliminar',
    // Administrative (ADM-001)
    'administrative.pagos.registrar',
    'administrative.pagos.anular',
    'administrative.pagos.leer',
    'administrative.matriculas.gestionar',
    'administrative.matriculas.leer',
    'administrative.certificados.emitir',
    'administrative.certificados.descargar',
  ],
  DOCENTE: [
    'core.perfil.leer',
    'academic.calificaciones.gestionar',
    'academic.calificaciones.leer',
    'academic.asistencias.gestionar',
    'academic.asistencias.leer',
    'academic.asistencias.justificar',
    'academic.horarios.leer',
    'communication.anuncios.leer',
    'virtual.leer',
    'virtual.gestionar',
    'virtual.eliminar',
  ],
  APODERADO: [
    'core.perfil.leer',
    'academic.calificaciones.leer',
    'academic.asistencias.leer',
    'academic.asistencias.solicitar',
    'academic.horarios.leer',
    'communication.anuncios.leer',
    'communication.mensajeria.gestionar',
    'virtual.leer',
    // Administrative (ADM-001)
    'administrative.pagos.leer',
    'administrative.matriculas.gestionar',
    'administrative.matriculas.leer',
    'administrative.certificados.solicitar',
    'administrative.certificados.descargar',
  ],
  ALUMNO: [
    'core.perfil.leer',
    'academic.calificaciones.leer',
    'academic.asistencias.leer',
    'academic.horarios.leer',
    'communication.anuncios.leer',
    'virtual.leer',
    // Administrative (ADM-001)
    'administrative.pagos.leer',
    'administrative.matriculas.leer',
    'administrative.certificados.solicitar',
    'administrative.certificados.descargar',
  ],
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
