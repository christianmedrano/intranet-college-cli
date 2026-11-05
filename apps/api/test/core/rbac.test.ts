import Fastify, { type FastifyInstance } from 'fastify'
import {
  permissionsForRoles,
  roleCodes,
  type Permission,
  type RoleCode,
} from '@intranet/shared'
import { afterEach, describe, expect, it } from 'vitest'
import { registerErrorHandler } from '../../src/core/errors.js'
import { hasPermission, requirePermission } from '../../src/core/rbac.js'

const ROLE_SET = new Set<string>(roleCodes)

function toRole(value: string): RoleCode | undefined {
  return ROLE_SET.has(value) ? roleCodes.find((role) => role === value) : undefined
}

let app: FastifyInstance | undefined

function buildGuardedApp(): FastifyInstance {
  const instance = Fastify()
  registerErrorHandler(instance)

  instance.addHook('onRequest', async (request) => {
    const header = request.headers['x-test-role']
    if (typeof header === 'string') {
      const role = toRole(header)
      if (role) {
        request.authUser = { id: 'usuario-prueba', roles: [role] }
      }
    }
  })

  instance.get(
    '/auditoria',
    { preHandler: requirePermission('core.auditoria.leer') },
    async () => ({ ok: true }),
  )

  app = instance
  return instance
}

afterEach(async () => {
  await app?.close()
  app = undefined
})

describe('catálogo de permisos', () => {
  it('no admite permisos fuera del catálogo', () => {
    // Comprobación en tiempo de compilación: un literal ajeno al catálogo
    // no es asignable a `Permission`.
    type PermisoInexistente = Extract<'core.inexistente', Permission>
    const esAjeno: PermisoInexistente extends never ? true : false = true

    expect(esAjeno).toBe(true)
  })

  it('el SuperAdmin tiene todos los permisos de core', () => {
    expect(permissionsForRoles(['SUPER_ADMIN'])).toEqual([
      'core.institucion.editar',
      'core.usuarios.gestionar',
      'core.estructura.gestionar',
      'core.matriculas.gestionar',
      'core.auditoria.leer',
      'core.perfil.leer',
    ])
  })

  it('un docente solo puede consultar su perfil en core', () => {
    expect(permissionsForRoles(['DOCENTE'])).toEqual(['core.perfil.leer'])
    expect(hasPermission(['DOCENTE'], 'core.usuarios.gestionar')).toBe(false)
  })

  it('une los permisos de varios roles sin duplicados', () => {
    const permisos = permissionsForRoles(['DOCENTE', 'DIRECTOR'])

    expect(permisos).toEqual(permissionsForRoles(['DIRECTOR']))
    expect(permisos.filter((p) => p === 'core.perfil.leer')).toHaveLength(1)
  })
})

describe('guard requirePermission', () => {
  it('devuelve 401 si no hay identidad autenticada', async () => {
    const response = await buildGuardedApp().inject({
      method: 'GET',
      url: '/auditoria',
    })

    expect(response.statusCode).toBe(401)
    expect(response.json()).toMatchObject({
      error: { code: 'UNAUTHORIZED' },
    })
  })

  it('devuelve 403 si el rol no tiene el permiso', async () => {
    const response = await buildGuardedApp().inject({
      method: 'GET',
      url: '/auditoria',
      headers: { 'x-test-role': 'DOCENTE' },
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toMatchObject({ error: { code: 'FORBIDDEN' } })
  })

  it('permite el acceso cuando el rol tiene el permiso', async () => {
    const response = await buildGuardedApp().inject({
      method: 'GET',
      url: '/auditoria',
      headers: { 'x-test-role': 'SUPER_ADMIN' },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ ok: true })
  })
})
