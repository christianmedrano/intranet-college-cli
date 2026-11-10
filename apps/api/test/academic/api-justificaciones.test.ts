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
  'API de justificaciones',
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
          numeroDocumento: String(71_000_000 + secuencia),
        },
      })
    }

    interface ActorToken {
      usuarioId: string
      personaId: string
      token: string
    }

    async function crearActorConToken(
      roles: RoleCode[],
      personaId?: string,
    ): Promise<ActorToken> {
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

      const { token } = await signAccessToken(usuario.id)

      return { usuarioId: usuario.id, personaId: idPersona, token }
    }

    interface Escenario {
      asistenciaId: string
      alumnoId: string
      apoderado: ActorToken
      tutor: ActorToken
      noTutor: ActorToken
      director: ActorToken
      alumno: ActorToken
      apoderadoAjeno: ActorToken
      sinRoles: ActorToken
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
      const seccion = await prisma.seccion.create({
        data: { gradoId: grado.id, anioId: anio.id, nombre: 'A' },
      })
      const curso = await prisma.curso.create({
        data: { nivelId: nivel.id, nombre: 'Matemática', orden: 1 },
      })

      const personaAlumno = await crearPersona()
      const alumno = await prisma.alumno.create({
        data: { personaId: personaAlumno.id, codigoAlumno: 'AL-1' },
      })
      await prisma.matricula.create({
        data: {
          alumnoId: alumno.id,
          seccionId: seccion.id,
          anioId: anio.id,
          estado: 'APROBADA',
        },
      })
      const asistencia = await prisma.asistencia.create({
        data: {
          alumnoId: alumno.id,
          fecha: aFechaUTC(FECHA),
          estado: 'FALTA_INJUSTIFICADA',
        },
      })

      const apoderado = await crearActorConToken(['APODERADO'])
      const registroApoderado = await prisma.apoderado.create({
        data: { personaId: apoderado.personaId },
      })
      await prisma.apoderadoAlumno.create({
        data: {
          apoderadoId: registroApoderado.id,
          alumnoId: alumno.id,
          parentesco: 'Madre',
          esPrincipal: true,
        },
      })

      async function crearDocente(esTutor: boolean): Promise<ActorToken> {
        const actor = await crearActorConToken(['DOCENTE'])
        const docente = await prisma.docente.create({
          data: {
            personaId: actor.personaId,
            codigoDocente: `DOC-${secuencia}`,
          },
        })
        await prisma.asignacionDocente.create({
          data: {
            docenteId: docente.id,
            cursoId: curso.id,
            seccionId: seccion.id,
            anioId: anio.id,
            esTutor,
          },
        })

        return actor
      }

      const tutor = await crearDocente(true)
      const noTutor = await crearDocente(false)
      const director = await crearActorConToken(['DIRECTOR'])
      const alumnoActor = await crearActorConToken(
        ['ALUMNO'],
        personaAlumno.id,
      )
      const apoderadoAjeno = await crearActorConToken(['APODERADO'])
      const sinRoles = await crearActorConToken([])

      return {
        asistenciaId: asistencia.id,
        alumnoId: alumno.id,
        apoderado,
        tutor,
        noTutor,
        director,
        alumno: alumnoActor,
        apoderadoAjeno,
        sinRoles,
      }
    }

    function solicitar(token: string | undefined, asistenciaId: string) {
      const peticion = request(app.server)
        .post(`/api/v1/asistencias/${asistenciaId}/justificaciones`)
        .send({ motivo: 'Cita médica' })

      return token ? peticion.set('Authorization', `Bearer ${token}`) : peticion
    }

    it('exige autenticación en el listado', async () => {
      await crearEscenario()

      await request(app.server).get('/api/v1/justificaciones').expect(401)
    })

    it('el apoderado vinculado solicita con 201', async () => {
      const escenario = await crearEscenario()

      const respuesta = await solicitar(
        escenario.apoderado.token,
        escenario.asistenciaId,
      ).expect(201)

      expect(respuesta.body).toMatchObject({
        asistenciaId: escenario.asistenciaId,
        estado: 'SOLICITADA',
      })
    })

    it('rechaza al apoderado ajeno con 403', async () => {
      const escenario = await crearEscenario()

      await solicitar(
        escenario.apoderadoAjeno.token,
        escenario.asistenciaId,
      ).expect(403)
    })

    it('el docente tutor ve las solicitudes de su sección', async () => {
      const escenario = await crearEscenario()
      await solicitar(escenario.apoderado.token, escenario.asistenciaId)

      const respuesta = await request(app.server)
        .get('/api/v1/justificaciones')
        .set('Authorization', `Bearer ${escenario.tutor.token}`)
        .expect(200)

      expect(respuesta.body.meta.total).toBe(1)
    })

    it('el alumno ve solo sus solicitudes y el ajeno no ve nada', async () => {
      const escenario = await crearEscenario()
      await solicitar(escenario.apoderado.token, escenario.asistenciaId)

      const propia = await request(app.server)
        .get('/api/v1/justificaciones')
        .set('Authorization', `Bearer ${escenario.alumno.token}`)
        .expect(200)
      expect(propia.body.meta.total).toBe(1)

      const ajena = await request(app.server)
        .get('/api/v1/justificaciones')
        .set('Authorization', `Bearer ${escenario.apoderadoAjeno.token}`)
        .expect(200)
      expect(ajena.body.meta.total).toBe(0)
    })

    it('rechaza a un usuario sin permiso de lectura', async () => {
      const escenario = await crearEscenario()

      await request(app.server)
        .get('/api/v1/justificaciones')
        .set('Authorization', `Bearer ${escenario.sinRoles.token}`)
        .expect(403)
    })

    it('el tutor aprueba y la asistencia pasa a justificada', async () => {
      const escenario = await crearEscenario()
      const solicitud = await solicitar(
        escenario.apoderado.token,
        escenario.asistenciaId,
      ).expect(201)

      const aprobada = await request(app.server)
        .post(`/api/v1/justificaciones/${solicitud.body.id}/aprobar`)
        .set('Authorization', `Bearer ${escenario.tutor.token}`)
        .send({ comentario: 'Documento presentado' })
        .expect(200)

      expect(aprobada.body.estado).toBe('APROBADA')

      const asistencia = await prisma.asistencia.findUniqueOrThrow({
        where: { id: escenario.asistenciaId },
      })
      expect(asistencia.estado).toBe('FALTA_JUSTIFICADA')
    })

    it('rechaza al docente no tutor con 403', async () => {
      const escenario = await crearEscenario()
      const solicitud = await solicitar(
        escenario.apoderado.token,
        escenario.asistenciaId,
      ).expect(201)

      await request(app.server)
        .post(`/api/v1/justificaciones/${solicitud.body.id}/aprobar`)
        .set('Authorization', `Bearer ${escenario.noTutor.token}`)
        .send({})
        .expect(403)
    })

    it('rechaza con motivo y exige su presencia', async () => {
      const escenario = await crearEscenario()
      const solicitud = await solicitar(
        escenario.apoderado.token,
        escenario.asistenciaId,
      ).expect(201)

      await request(app.server)
        .post(`/api/v1/justificaciones/${solicitud.body.id}/rechazar`)
        .set('Authorization', `Bearer ${escenario.tutor.token}`)
        .send({})
        .expect(400)

      const rechazada = await request(app.server)
        .post(`/api/v1/justificaciones/${solicitud.body.id}/rechazar`)
        .set('Authorization', `Bearer ${escenario.tutor.token}`)
        .send({ motivo: 'Sin documentos' })
        .expect(200)

      expect(rechazada.body.estado).toBe('RECHAZADA')

      const asistencia = await prisma.asistencia.findUniqueOrThrow({
        where: { id: escenario.asistenciaId },
      })
      expect(asistencia.estado).toBe('FALTA_INJUSTIFICADA')
    })

    it('no permite resolver dos veces con 409', async () => {
      const escenario = await crearEscenario()
      const solicitud = await solicitar(
        escenario.apoderado.token,
        escenario.asistenciaId,
      ).expect(201)

      await request(app.server)
        .post(`/api/v1/justificaciones/${solicitud.body.id}/aprobar`)
        .set('Authorization', `Bearer ${escenario.director.token}`)
        .send({})
        .expect(200)

      await request(app.server)
        .post(`/api/v1/justificaciones/${solicitud.body.id}/rechazar`)
        .set('Authorization', `Bearer ${escenario.director.token}`)
        .send({ motivo: 'Tarde' })
        .expect(409)
    })
  },
)
