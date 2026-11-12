import {
  permissionCodes,
  permissionsForRoles,
  roleCodes,
  rolePermissions,
  type Permission,
  type RoleCode,
} from '@intranet/shared'
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { registerErrorHandler } from '../../src/core/errors.js'
import {
  getEffectivePermissions,
  hasPermission,
  normalizeRoleCodes,
  requirePermission,
} from '../../src/core/rbac.js'

/**
 * Matriz normativa de `docs/rbac-matrix.md`, escrita de forma explícita para
 * que un cambio accidental en el catálogo rompa estas pruebas.
 */
const MATRIZ: Readonly<Record<RoleCode, readonly Permission[]>> = {
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
  ],
  ALUMNO: [
    'core.perfil.leer',
    'academic.calificaciones.leer',
    'academic.asistencias.leer',
    'academic.horarios.leer',
    'communication.anuncios.leer',
    'virtual.leer',
  ],
}

describe('matriz RBAC', () => {
  for (const role of roleCodes) {
    it(`otorga a ${role} exactamente los permisos documentados`, () => {
      expect(permissionsForRoles([role])).toEqual(MATRIZ[role])
      expect(getEffectivePermissions([role])).toEqual(MATRIZ[role])
    })
  }

  it('une los permisos de varios roles sin duplicados', () => {
    const union = permissionsForRoles(['DOCENTE', 'APODERADO'])

    expect(union).toEqual(
      permissionCodes.filter(
        (permission) =>
          MATRIZ.DOCENTE.includes(permission) ||
          MATRIZ.APODERADO.includes(permission),
      ),
    )
    expect(union).toHaveLength(new Set(union).size)
  })

  it('la unión nunca supera el máximo de los roles implicados', () => {
    expect(permissionsForRoles(['DIRECTOR', 'DOCENTE'])).toEqual(
      permissionCodes.filter(
        (permission) =>
          MATRIZ.DIRECTOR.includes(permission) ||
          MATRIZ.DOCENTE.includes(permission),
      ),
    )
    expect(permissionsForRoles(['ALUMNO', 'APODERADO'])).toEqual(
      permissionCodes.filter(
        (permission) =>
          MATRIZ.ALUMNO.includes(permission) ||
          MATRIZ.APODERADO.includes(permission),
      ),
    )
  })

  it('responde por permiso concreto', () => {
    expect(hasPermission(['DIRECTOR'], 'core.usuarios.gestionar')).toBe(true)
    expect(hasPermission(['DOCENTE'], 'core.usuarios.gestionar')).toBe(false)
    expect(hasPermission([], 'core.perfil.leer')).toBe(false)
    expect(
      hasPermission(['DOCENTE'], 'academic.calificaciones.gestionar'),
    ).toBe(true)
    expect(
      hasPermission(['DIRECTOR'], 'academic.calificaciones.gestionar'),
    ).toBe(false)
    expect(
      hasPermission(['APODERADO'], 'academic.asistencias.justificar'),
    ).toBe(false)
    expect(hasPermission(['SUPER_ADMIN'], 'academic.asistencias.leer')).toBe(
      false,
    )
  })

  it('descarta roles desconocidos y normaliza el orden', () => {
    expect(normalizeRoleCodes(['DOCENTE', 'HACKER', 'DOCENTE'])).toEqual([
      'DOCENTE',
    ])
    expect(normalizeRoleCodes(['ALUMNO', 'SUPER_ADMIN'])).toEqual([
      'SUPER_ADMIN',
      'ALUMNO',
    ])
  })

  it('el catálogo de permisos coincide con la matriz documentada', () => {
    const permisosDeLaMatriz = new Set(
      Object.values(MATRIZ).flatMap((permisos) => permisos),
    )

    expect([...permisosDeLaMatriz].sort()).toEqual([...permissionCodes].sort())
  })

  it('no admite permisos fuera del catálogo', () => {
    // Comprobación en tiempo de compilación: un literal ajeno al catálogo
    // no es asignable a `Permission`.
    type PermisoInexistente = Extract<'core.inexistente', Permission>
    const esAjeno: PermisoInexistente extends never ? true : false = true

    expect(esAjeno).toBe(true)
  })
})

describe('requirePermission por HTTP', () => {
  let app: FastifyInstance

  /**
   * Simula el guard de autenticación: hidrata `authUser` desde una cabecera.
   * Sin cabecera deja la petición sin identidad para probar el 401.
   *
   * Debe ser `async`: Fastify v5 solo da por terminado un hook cuando recibe
   * una promesa o un `done`. Un hook síncrono de un argumento deja la petición
   * colgada y `inject` nunca resuelve.
   */
  async function fakeAuth(request: FastifyRequest): Promise<void> {
    const cabecera = request.headers['x-test-roles']

    if (typeof cabecera !== 'string' || cabecera.trim() === '') {
      return
    }

    request.authUser = {
      id: '00000000-0000-4000-8000-000000000001',
      roles: normalizeRoleCodes(cabecera.split(',').map((rol) => rol.trim())),
    }
  }

  function indiceDe(permission: Permission): number {
    return permissionCodes.indexOf(permission)
  }

  beforeAll(async () => {
    app = Fastify()
    registerErrorHandler(app)

    permissionCodes.forEach((permission, indice) => {
      app.get(
        `/protegido/${indice}`,
        { preHandler: [fakeAuth, requirePermission(permission)] },
        async () => ({ ok: true }),
      )
    })

    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  for (const role of roleCodes) {
    it(`aplica la matriz a ${role} en casos permitidos y prohibidos`, async () => {
      for (const [indice, permission] of permissionCodes.entries()) {
        const respuesta = await app.inject({
          method: 'GET',
          url: `/protegido/${indice}`,
          headers: { 'x-test-roles': role },
        })

        const permitido = rolePermissions[role].includes(permission)

        expect(respuesta.statusCode, `${role} → ${permission}`).toBe(
          permitido ? 200 : 403,
        )
      }
    })
  }

  it('devuelve 401 si no hay identidad', async () => {
    const respuesta = await app.inject({
      method: 'GET',
      url: '/protegido/0',
    })

    expect(respuesta.statusCode).toBe(401)
    expect(respuesta.json()).toMatchObject({
      error: { code: 'UNAUTHORIZED' },
    })
  })

  it('devuelve 403 con un rol desconocido', async () => {
    const respuesta = await app.inject({
      method: 'GET',
      url: `/protegido/${indiceDe('core.perfil.leer')}`,
      headers: { 'x-test-roles': 'SUPER_ADMIN_FALSO' },
    })

    expect(respuesta.statusCode).toBe(403)
    expect(respuesta.json()).toMatchObject({ error: { code: 'FORBIDDEN' } })
  })

  it('acumula permisos cuando el usuario tiene varios roles', async () => {
    const usuarios = await app.inject({
      method: 'GET',
      url: `/protegido/${indiceDe('core.usuarios.gestionar')}`,
      headers: { 'x-test-roles': 'DOCENTE,DIRECTOR' },
    })

    const auditoria = await app.inject({
      method: 'GET',
      url: `/protegido/${indiceDe('core.auditoria.leer')}`,
      headers: { 'x-test-roles': 'DOCENTE,DIRECTOR' },
    })

    expect(usuarios.statusCode).toBe(200)
    expect(auditoria.statusCode).toBe(200)
  })
})