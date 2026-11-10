import type { RoleCode } from '@intranet/shared'
import type { FastifyInstance } from 'fastify'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../../src/app.js'
import { signAccessToken } from '../../src/core/auth/tokens.js'
import { aFechaUTC } from '../../src/modules/core/estructura/fechas.js'
import {
  createTestPrisma,
  limpiarBaseDePruebas,
} from '../helpers/test-db.js'

const FECHA = '2024-05-12'

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'consulta y corrección de asistencias',
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
      await limpiarBaseDePruebas(prisma)
      secuencia = 0
    })

    afterAll(async () => {
      await app.close()
      await prisma.$disconnect()
    })

    async function crearPersona() {
      secuencia += 1

      return prisma.persona.create({
        data: {
          nombres: `Persona${secuencia}`,
          apellidos: 'De Prueba',
          tipoDocumento: 'DNI',
          numeroDocumento: String(68_000_000 + secuencia),
        },
      })
    }

    async function crearUsuarioConRoles(
      roles: RoleCode[],
      personaId?: string,
    ) {
      secuencia += 1
      const idPersona = personaId ?? (await crearPersona()).id
      const usuario = await prisma.usuario.create({
        data: {
          personaId: idPersona,
          username: `usuario.${secuencia}`,
          passwordHash: '$argon2id$hash-de-prueba',
          debeCambiarPassword: false,
        },
      })

      for (const codigo of roles) {
        const rol = await prisma.rol.upsert({
          where: { codigo },
          create: { codigo, nombre: codigo },
          update: {},
        })

        await prisma.usuarioRol.create({
          data: { usuarioId: usuario.id, rolId: rol.id },
        })
      }

      return usuario
    }

    async function tokenDe(roles: RoleCode[], personaId?: string) {
      const usuario = await crearUsuarioConRoles(roles, personaId)
      const { token } = await signAccessToken(usuario.id)

      return { usuario, token }
    }

    interface Escenario {
      asistenciaAId: string
      asistenciaBId: string
      seccionBId: string
      alumnoBId: string
      director: string
      docente: string
      apoderado: string
      alumno: string
      superAdmin: string
      sinRoles: string
    }

    async function crearEscenario(): Promise<Escenario> {
      const institucion = await prisma.institucion.create({
        data: { nombre: 'IE de Pruebas' },
      })
      const anio = await prisma.anioAcademico.create({
        data: {
          institucionId: institucion.id,
          nombre: '2024',
          fechaInicio: new Date('2024-03-01'),
          fechaFin: new Date('2024-12-15'),
          estado: 'ACTIVO',
        },
      })
      const nivel = await prisma.nivel.create({
        data: { institucionId: institucion.id, nombre: 'Primaria', orden: 1 },
      })
      const grado = await prisma.grado.create({
        data: { nivelId: nivel.id, nombre: 'Primero', orden: 1 },
      })
      const seccionA = await prisma.seccion.create({
        data: { gradoId: grado.id, anioId: anio.id, nombre: 'A' },
      })
      const seccionB = await prisma.seccion.create({
        data: { gradoId: grado.id, anioId: anio.id, nombre: 'B' },
      })
      const curso = await prisma.curso.create({
        data: { nivelId: nivel.id, nombre: 'Matemática', orden: 1 },
      })

      async function crearAlumno(codigo: string) {
        const persona = await crearPersona()

        return prisma.alumno.create({
          data: { personaId: persona.id, codigoAlumno: codigo },
        })
      }

      const alumnoA = await crearAlumno('AL-A')
      const alumnoB = await crearAlumno('AL-B')

      await prisma.matricula.create({
        data: {
          alumnoId: alumnoA.id,
          seccionId: seccionA.id,
          anioId: anio.id,
          estado: 'APROBADA',
        },
      })
      await prisma.matricula.create({
        data: {
          alumnoId: alumnoB.id,
          seccionId: seccionB.id,
          anioId: anio.id,
          estado: 'APROBADA',
        },
      })

      const asistenciaA = await prisma.asistencia.create({
        data: {
          alumnoId: alumnoA.id,
          fecha: aFechaUTC(FECHA),
          estado: 'PRESENTE',
        },
      })
      const asistenciaB = await prisma.asistencia.create({
        data: {
          alumnoId: alumnoB.id,
          fecha: aFechaUTC(FECHA),
          estado: 'FALTA_INJUSTIFICADA',
        },
      })

      const personaDocente = await crearPersona()
      const usuarioDocente = await crearUsuarioConRoles(
        ['DOCENTE'],
        personaDocente.id,
      )
      const docente = await prisma.docente.create({
        data: { personaId: personaDocente.id, codigoDocente: 'DOC-1' },
      })
      await prisma.asignacionDocente.create({
        data: {
          docenteId: docente.id,
          cursoId: curso.id,
          seccionId: seccionA.id,
          anioId: anio.id,
        },
      })

      const personaApoderado = await crearPersona()
      const usuarioApoderado = await crearUsuarioConRoles(
        ['APODERADO'],
        personaApoderado.id,
      )
      const apoderado = await prisma.apoderado.create({
        data: { personaId: personaApoderado.id },
      })
      await prisma.apoderadoAlumno.create({
        data: {
          apoderadoId: apoderado.id,
          alumnoId: alumnoA.id,
          parentesco: 'Madre',
          esPrincipal: true,
        },
      })

      const usuarioAlumno = await crearUsuarioConRoles(
        ['ALUMNO'],
        (
          await prisma.alumno.findUniqueOrThrow({
            where: { id: alumnoA.id },
            select: { personaId: true },
          })
        ).personaId,
      )

      const director = await tokenDe(['DIRECTOR'])
      const superAdmin = await tokenDe(['SUPER_ADMIN'])
      const sinRoles = await tokenDe([])

      return {
        asistenciaAId: asistenciaA.id,
        asistenciaBId: asistenciaB.id,
        seccionBId: seccionB.id,
        alumnoBId: alumnoB.id,
        director: director.token,
        docente: (await signAccessToken(usuarioDocente.id)).token,
        apoderado: (await signAccessToken(usuarioApoderado.id)).token,
        alumno: (await signAccessToken(usuarioAlumno.id)).token,
        superAdmin: superAdmin.token,
        sinRoles: sinRoles.token,
      }
    }

    function get(ruta: string, token?: string) {
      const peticion = request(app.server).get(ruta)

      return token ? peticion.set('Authorization', `Bearer ${token}`) : peticion
    }

    it('exige autenticación', async () => {
      await crearEscenario()

      await get('/api/v1/asistencias').expect(401)
    })

    it('rechaza a un usuario sin rol con alcance', async () => {
      const escenario = await crearEscenario()

      await get('/api/v1/asistencias', escenario.sinRoles).expect(403)
    })

    it('el Director ve todas las asistencias', async () => {
      const escenario = await crearEscenario()

      const respuesta = await get(
        '/api/v1/asistencias',
        escenario.director,
      ).expect(200)

      expect(respuesta.body.meta.total).toBe(2)
    })

    it('el docente solo ve su sección', async () => {
      const escenario = await crearEscenario()

      const respuesta = await get(
        '/api/v1/asistencias',
        escenario.docente,
      ).expect(200)

      expect(respuesta.body.meta.total).toBe(1)
      expect(respuesta.body.data[0].id).toBe(escenario.asistenciaAId)
    })

    it('el docente recibe 403 al filtrar por una sección no asignada', async () => {
      const escenario = await crearEscenario()

      await get(
        `/api/v1/asistencias?seccionId=${escenario.seccionBId}`,
        escenario.docente,
      ).expect(403)
    })

    it('el apoderado solo ve a sus alumnos y no puede filtrar a otro', async () => {
      const escenario = await crearEscenario()

      const respuesta = await get(
        '/api/v1/asistencias',
        escenario.apoderado,
      ).expect(200)
      expect(respuesta.body.meta.total).toBe(1)
      expect(respuesta.body.data[0].id).toBe(escenario.asistenciaAId)

      await get(
        `/api/v1/asistencias?alumnoId=${escenario.alumnoBId}`,
        escenario.apoderado,
      ).expect(403)
    })

    it('el alumno solo ve su propia asistencia', async () => {
      const escenario = await crearEscenario()

      const respuesta = await get(
        '/api/v1/asistencias',
        escenario.alumno,
      ).expect(200)

      expect(respuesta.body.meta.total).toBe(1)
      expect(respuesta.body.data[0].id).toBe(escenario.asistenciaAId)
    })

    it('el SuperAdmin no tiene permiso de lectura de asistencias', async () => {
      const escenario = await crearEscenario()

      // La matriz RBAC no otorga `academic.asistencias.leer` al SuperAdmin.
      await get('/api/v1/asistencias', escenario.superAdmin).expect(403)
    })

    it('el docente corrige con motivo', async () => {
      const escenario = await crearEscenario()

      const respuesta = await request(app.server)
        .patch(`/api/v1/asistencias/${escenario.asistenciaAId}`)
        .set('Authorization', `Bearer ${escenario.docente}`)
        .send({ estado: 'TARDE', motivo: 'Llegó tarde' })
        .expect(200)

      expect(respuesta.body.estado).toBe('TARDE')
    })

    it('rechaza la corrección sin motivo', async () => {
      const escenario = await crearEscenario()

      await request(app.server)
        .patch(`/api/v1/asistencias/${escenario.asistenciaAId}`)
        .set('Authorization', `Bearer ${escenario.docente}`)
        .send({ estado: 'TARDE' })
        .expect(400)
    })

    it('rechaza la corrección a un rol sin permiso de gestión', async () => {
      const escenario = await crearEscenario()

      await request(app.server)
        .patch(`/api/v1/asistencias/${escenario.asistenciaAId}`)
        .set('Authorization', `Bearer ${escenario.apoderado}`)
        .send({ estado: 'TARDE', motivo: 'Intento' })
        .expect(403)
    })
  },
)
