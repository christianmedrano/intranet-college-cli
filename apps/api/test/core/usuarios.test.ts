import { roleCodes, type RoleCode } from '@intranet/shared'
import type { FastifyInstance } from 'fastify'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../../src/app.js'
import { verifyPassword } from '../../src/core/auth/password.js'
import { signAccessToken } from '../../src/core/auth/tokens.js'
import { createTestPrisma, limpiarBaseDePruebas } from '../helpers/test-db.js'

const HASH_FIJO = '$argon2id$hash-de-prueba'

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'gestión de usuarios (RF-CORE-002)',
  () => {
    let app: FastifyInstance
    let prisma: ReturnType<typeof createTestPrisma>
    let secuencia = 0

    beforeAll(async () => {
      prisma = createTestPrisma()
      app = await buildApp()
      await app.ready()
    })

    beforeEach(async () => {
      secuencia = 0
      await limpiarBaseDePruebas(prisma)

      for (const codigo of roleCodes) {
        await prisma.rol.create({ data: { codigo, nombre: codigo } })
      }
    })

    afterAll(async () => {
      await app.close()
      await prisma.$disconnect()
    })

    function siguiente(): number {
      secuencia += 1

      return secuencia
    }

    async function crearPersona(nombres = 'Ana', apellidos = 'Pérez') {
      const numero = siguiente()

      return prisma.persona.create({
        data: {
          nombres,
          apellidos,
          tipoDocumento: 'DNI',
          numeroDocumento: String(10_000_000 + numero),
        },
      })
    }

    async function rolIdDe(codigo: RoleCode): Promise<string> {
      const rol = await prisma.rol.findUniqueOrThrow({ where: { codigo } })

      return rol.id
    }

    async function crearActor(roles: RoleCode[]) {
      const persona = await crearPersona('Actor', 'Prueba')
      const n = siguiente()

      const usuario = await prisma.usuario.create({
        data: {
          personaId: persona.id,
          username: `actor.${n}`,
          email: `actor.${n}@ejemplo.edu.pe`,
          passwordHash: HASH_FIJO,
          debeCambiarPassword: false,
        },
      })

      for (const codigo of roles) {
        await prisma.usuarioRol.create({
          data: { usuarioId: usuario.id, rolId: await rolIdDe(codigo) },
        })
      }

      const { token } = await signAccessToken(usuario.id)

      return { usuario, token }
    }

    function autorizacion(token: string) {
      return { Authorization: `Bearer ${token}` }
    }

    function crear(
      token: string,
      cuerpo: Record<string, unknown>,
    ) {
      return request(app.server)
        .post('/api/v1/usuarios')
        .set(autorizacion(token))
        .send(cuerpo)
    }

    function actualizar(
      token: string,
      usuarioId: string,
      cuerpo: Record<string, unknown>,
    ) {
      return request(app.server)
        .patch(`/api/v1/usuarios/${usuarioId}`)
        .set(autorizacion(token))
        .send(cuerpo)
    }

    function iniciarSesion(identifier: string, password: string) {
      return request(app.server)
        .post('/api/v1/auth/login')
        .send({ identifier, password })
    }

    it('exige autenticación para listar', async () => {
      const respuesta = await request(app.server).get('/api/v1/usuarios')

      expect(respuesta.status).toBe(401)
      expect(respuesta.body).toMatchObject({ error: { code: 'UNAUTHORIZED' } })
    })

    it('crea la cuenta con PIN temporal y obliga a cambiarlo', async () => {
      const { token } = await crearActor(['SUPER_ADMIN'])
      const persona = await crearPersona('Nuevo', 'Docente')

      const respuesta = await crear(token, {
        personaId: persona.id,
        username: 'nuevo.docente',
        email: 'nuevo.docente@ejemplo.edu.pe',
        roles: ['DOCENTE'],
      })

      expect(respuesta.status).toBe(201)
      expect(respuesta.body).toMatchObject({
        username: 'nuevo.docente',
        email: 'nuevo.docente@ejemplo.edu.pe',
        activo: true,
        debeCambiarPassword: true,
        roles: ['DOCENTE'],
        persona: { id: persona.id },
      })
      expect(respuesta.body.pinTemporal).toMatch(/^\d{8}$/)

      const creado = await prisma.usuario.findUniqueOrThrow({
        where: { id: respuesta.body.id },
      })

      expect(creado.passwordHash.startsWith('$argon2id$')).toBe(true)
      expect(
        await verifyPassword(creado.passwordHash, respuesta.body.pinTemporal),
      ).toBe(true)
      expect(creado.passwordHash).not.toContain(respuesta.body.pinTemporal)

      const sesion = await iniciarSesion(
        'nuevo.docente',
        respuesta.body.pinTemporal,
      )

      expect(sesion.status).toBe(200)

      const perfil = await request(app.server)
        .get('/api/v1/me')
        .set(autorizacion(sesion.body.accessToken))

      expect(perfil.status).toBe(200)
      expect(perfil.body.debeCambiarPassword).toBe(true)

      const bloqueado = await request(app.server)
        .get('/api/v1/auditoria')
        .set(autorizacion(sesion.body.accessToken))

      expect(bloqueado.status).toBe(403)
    })

    it('devuelve 409 cuando el identificador ya está en uso', async () => {
      const { token } = await crearActor(['SUPER_ADMIN'])
      const primeraPersona = await crearPersona()
      const segundaPersona = await crearPersona()

      const primera = await crear(token, {
        personaId: primeraPersona.id,
        username: 'usuario.duplicado',
        roles: ['DOCENTE'],
      })

      expect(primera.status).toBe(201)

      const segunda = await crear(token, {
        personaId: segundaPersona.id,
        username: 'usuario.duplicado',
        roles: ['DOCENTE'],
      })

      expect(segunda.status).toBe(409)
      expect(segunda.body).toMatchObject({ error: { code: 'CONFLICT' } })
    })

    it('devuelve 409 si la persona ya tiene una cuenta', async () => {
      const { token } = await crearActor(['SUPER_ADMIN'])
      const persona = await crearPersona()

      expect(
        (
          await crear(token, {
            personaId: persona.id,
            username: 'primera.cuenta',
            roles: ['DOCENTE'],
          })
        ).status,
      ).toBe(201)

      const repetida = await crear(token, {
        personaId: persona.id,
        username: 'segunda.cuenta',
        roles: ['DOCENTE'],
      })

      expect(repetida.status).toBe(409)
    })

    it('impide al Director crear SuperAdmins o Directores', async () => {
      const { token } = await crearActor(['DIRECTOR'])

      for (const rol of ['SUPER_ADMIN', 'DIRECTOR'] as const) {
        const persona = await crearPersona()
        const respuesta = await crear(token, {
          personaId: persona.id,
          username: `no.permitido.${rol.toLowerCase()}`,
          roles: [rol],
        })

        expect(respuesta.status).toBe(403)
        expect(respuesta.body).toMatchObject({ error: { code: 'FORBIDDEN' } })
      }

      expect(await prisma.usuario.count()).toBe(1)
    })

    it('permite al Director crear Docentes, Apoderados y Alumnos', async () => {
      const { token } = await crearActor(['DIRECTOR'])
      const persona = await crearPersona()

      const respuesta = await crear(token, {
        personaId: persona.id,
        username: 'docente.director',
        roles: ['DOCENTE', 'APODERADO'],
      })

      expect(respuesta.status).toBe(201)
      expect(respuesta.body.roles).toEqual(['DOCENTE', 'APODERADO'])
    })

    it('acota el listado del Director a los roles que gestiona', async () => {
      const superAdmin = await crearActor(['SUPER_ADMIN'])
      const director = await crearActor(['DIRECTOR'])
      const persona = await crearPersona('Docente', 'Visible')

      expect(
        (
          await crear(superAdmin.token, {
            personaId: persona.id,
            username: 'docente.visible',
            roles: ['DOCENTE'],
          })
        ).status,
      ).toBe(201)

      const listadoDirector = await request(app.server)
        .get('/api/v1/usuarios')
        .set(autorizacion(director.token))

      expect(listadoDirector.status).toBe(200)
      expect(listadoDirector.body.meta.total).toBe(1)
      expect(listadoDirector.body.data).toHaveLength(1)
      expect(listadoDirector.body.data[0]).toMatchObject({
        username: 'docente.visible',
        roles: ['DOCENTE'],
      })

      const listadoSuperAdmin = await request(app.server)
        .get('/api/v1/usuarios')
        .set(autorizacion(superAdmin.token))

      expect(listadoSuperAdmin.body.meta.total).toBe(3)
    })

    it('actualiza identificadores, estado y roles, y aplica la baja lógica', async () => {
      const { token } = await crearActor(['SUPER_ADMIN'])
      const persona = await crearPersona()

      const creado = await crear(token, {
        personaId: persona.id,
        username: 'usuario.inicial',
        email: 'inicial@ejemplo.edu.pe',
        roles: ['DOCENTE'],
      })

      const respuesta = await actualizar(token, creado.body.id, {
        username: 'usuario.actualizado',
        email: 'actualizado@ejemplo.edu.pe',
        activo: false,
        roles: ['ALUMNO', 'APODERADO'],
      })

      expect(respuesta.status).toBe(200)
      expect(respuesta.body).toMatchObject({
        username: 'usuario.actualizado',
        email: 'actualizado@ejemplo.edu.pe',
        activo: false,
        roles: ['APODERADO', 'ALUMNO'],
      })

      const desactivado = await iniciarSesion(
        'usuario.actualizado',
        creado.body.pinTemporal,
      )

      expect(desactivado.status).toBe(401)

      const reactivado = await actualizar(token, creado.body.id, {
        activo: true,
      })

      expect(reactivado.status).toBe(200)
      expect(reactivado.body.activo).toBe(true)

      const sesion = await iniciarSesion(
        'usuario.actualizado',
        creado.body.pinTemporal,
      )

      expect(sesion.status).toBe(200)
    })

    it('devuelve 409 al actualizar con un correo en uso', async () => {
      const { token } = await crearActor(['SUPER_ADMIN'])
      const primeraPersona = await crearPersona()
      const segundaPersona = await crearPersona()

      const primera = await crear(token, {
        personaId: primeraPersona.id,
        username: 'primera.persona',
        email: 'ocupado@ejemplo.edu.pe',
        roles: ['DOCENTE'],
      })

      const segunda = await crear(token, {
        personaId: segundaPersona.id,
        username: 'segunda.persona',
        roles: ['DOCENTE'],
      })

      expect(primera.status).toBe(201)
      expect(segunda.status).toBe(201)

      const respuesta = await actualizar(token, segunda.body.id, {
        email: 'ocupado@ejemplo.edu.pe',
      })

      expect(respuesta.status).toBe(409)
      expect(respuesta.body).toMatchObject({ error: { code: 'CONFLICT' } })
    })

    it('impide al Director gestionar cuentas administrativas', async () => {
      const superAdmin = await crearActor(['SUPER_ADMIN'])
      const director = await crearActor(['DIRECTOR'])
      const persona = await crearPersona()

      const cuentaDocente = await crear(superAdmin.token, {
        personaId: persona.id,
        username: 'docente.gestionable',
        roles: ['DOCENTE'],
      })

      expect(
        (
          await actualizar(director.token, cuentaDocente.body.id, {
            activo: false,
          })
        ).status,
      ).toBe(200)

      expect(
        (
          await actualizar(director.token, superAdmin.usuario.id, {
            activo: false,
          })
        ).status,
      ).toBe(403)

      expect(
        (
          await actualizar(director.token, cuentaDocente.body.id, {
            roles: ['DIRECTOR'],
          })
        ).status,
      ).toBe(403)
    })

    it('devuelve 404 al actualizar un usuario inexistente', async () => {
      const { token } = await crearActor(['SUPER_ADMIN'])

      const respuesta = await actualizar(
        token,
        '00000000-0000-4000-8000-000000000000',
        { activo: false },
      )

      expect(respuesta.status).toBe(404)
      expect(respuesta.body).toMatchObject({ error: { code: 'NOT_FOUND' } })
    })

    it('valida el cuerpo de alta y de actualización', async () => {
      const { token } = await crearActor(['SUPER_ADMIN'])
      const persona = await crearPersona()

      const sinRoles = await crear(token, {
        personaId: persona.id,
        roles: [],
      })

      expect(sinRoles.status).toBe(400)
      expect(sinRoles.body).toMatchObject({
        error: { code: 'VALIDATION_ERROR' },
      })

      const sinCampos = await actualizar(token, persona.id, {})

      expect(sinCampos.status).toBe(400)
      expect(sinCampos.body).toMatchObject({
        error: { code: 'VALIDATION_ERROR' },
      })

      const personaInexistente = await crear(token, {
        personaId: '00000000-0000-4000-8000-000000000000',
        roles: ['DOCENTE'],
      })

      expect(personaInexistente.status).toBe(404)
    })

    it('audita el alta y la actualización sin almacenar el PIN', async () => {
      const { token, usuario: actor } = await crearActor(['SUPER_ADMIN'])
      const persona = await crearPersona()

      const creado = await crear(token, {
        personaId: persona.id,
        username: 'usuario.auditado',
        roles: ['DOCENTE'],
      })

      await actualizar(token, creado.body.id, { activo: false })

      const registros = await prisma.auditoria.findMany({
        where: { entidad: 'USUARIO', entidadId: creado.body.id },
        orderBy: { createdAt: 'asc' },
      })

      expect(registros.map((registro) => registro.accion)).toEqual([
        'CREAR',
        'ACTUALIZAR',
      ])
      expect(registros.every((registro) => registro.usuarioId === actor.id)).toBe(
        true,
      )
      expect(JSON.stringify(registros)).not.toContain(creado.body.pinTemporal)
    })
  },
)
