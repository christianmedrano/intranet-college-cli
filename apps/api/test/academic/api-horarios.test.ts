import type { RoleCode } from '@intranet/shared'
import type { FastifyInstance } from 'fastify'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../../src/app.js'
import { signAccessToken } from '../../src/core/auth/tokens.js'
import {
  createTestPrisma,
  limpiarBaseDePruebas,
} from '../helpers/test-db.js'

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'API de horarios',
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
          numeroDocumento: String(75_000_000 + secuencia),
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
      anioId: string
      seccionAId: string
      seccionBId: string
      seccionCId: string
      cursoId: string
      cursoSecundariaId: string
      docenteId: string
      horarioAId: string
      horarioBId: string
      alumnoId: string
      apoderado: ActorToken
      apoderadoAjeno: ActorToken
      alumno: ActorToken
      tutor: ActorToken
      director: ActorToken
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
      const primaria = await prisma.nivel.create({
        data: { institucionId: institucion.id, nombre: 'Primaria', orden: 1 },
      })
      const secundaria = await prisma.nivel.create({
        data: { institucionId: institucion.id, nombre: 'Secundaria', orden: 2 },
      })
      const grado = await prisma.grado.create({
        data: { nivelId: primaria.id, nombre: 'Primero', orden: 1 },
      })
      const seccionA = await prisma.seccion.create({
        data: { gradoId: grado.id, anioId: anio.id, nombre: 'A' },
      })
      const seccionB = await prisma.seccion.create({
        data: { gradoId: grado.id, anioId: anio.id, nombre: 'B' },
      })
      const seccionC = await prisma.seccion.create({
        data: { gradoId: grado.id, anioId: anio.id, nombre: 'C' },
      })
      const curso = await prisma.curso.create({
        data: { nivelId: primaria.id, nombre: 'Matemática', orden: 1 },
      })
      const cursoSecundaria = await prisma.curso.create({
        data: { nivelId: secundaria.id, nombre: 'Física', orden: 1 },
      })

      const tutor = await crearActorConToken(['DOCENTE'])
      const docente = await prisma.docente.create({
        data: {
          personaId: tutor.personaId,
          codigoDocente: `DOC-${secuencia}`,
        },
      })

      for (const seccionId of [seccionA.id, seccionB.id]) {
        await prisma.asignacionDocente.create({
          data: {
            docenteId: docente.id,
            cursoId: curso.id,
            seccionId,
            anioId: anio.id,
          },
        })
      }

      const personaAlumno = await crearPersona()
      const alumno = await prisma.alumno.create({
        data: { personaId: personaAlumno.id, codigoAlumno: 'AL-1' },
      })
      await prisma.matricula.create({
        data: {
          alumnoId: alumno.id,
          seccionId: seccionA.id,
          anioId: anio.id,
          estado: 'APROBADA',
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

      const horarioA = await prisma.horario.create({
        data: {
          anioId: anio.id,
          seccionId: seccionA.id,
          cursoId: curso.id,
          docenteId: docente.id,
          diaSemana: 1,
          horaInicio: '09:00',
          horaFin: '10:00',
        },
      })
      const horarioB = await prisma.horario.create({
        data: {
          anioId: anio.id,
          seccionId: seccionB.id,
          cursoId: curso.id,
          diaSemana: 1,
          horaInicio: '09:00',
          horaFin: '10:00',
        },
      })

      return {
        anioId: anio.id,
        seccionAId: seccionA.id,
        seccionBId: seccionB.id,
        seccionCId: seccionC.id,
        cursoId: curso.id,
        cursoSecundariaId: cursoSecundaria.id,
        docenteId: docente.id,
        horarioAId: horarioA.id,
        horarioBId: horarioB.id,
        alumnoId: alumno.id,
        apoderado,
        apoderadoAjeno: await crearActorConToken(['APODERADO']),
        alumno: await crearActorConToken(['ALUMNO'], personaAlumno.id),
        tutor,
        director: await crearActorConToken(['DIRECTOR']),
        sinRoles: await crearActorConToken([]),
      }
    }

    function getHorarios(token?: string, anioId?: string) {
      const peticion = request(app.server).get('/api/v1/horarios')

      if (anioId) {
        peticion.query({ anioId })
      }

      return token ? peticion.set('Authorization', `Bearer ${token}`) : peticion
    }

    it('exige autenticación y año en la consulta', async () => {
      const escenario = await crearEscenario()

      await getHorarios(undefined, escenario.anioId).expect(401)
      await getHorarios(escenario.director.token).expect(400)
    })

    it('el Director crea un bloque con 201 y queda auditado', async () => {
      const escenario = await crearEscenario()

      const respuesta = await request(app.server)
        .post('/api/v1/horarios')
        .set('Authorization', `Bearer ${escenario.director.token}`)
        .send({
          anioId: escenario.anioId,
          seccionId: escenario.seccionCId,
          cursoId: escenario.cursoId,
          diaSemana: 2,
          horaInicio: '08:00',
          horaFin: '09:00',
        })
        .expect(201)

      expect(respuesta.body).toMatchObject({
        seccionId: escenario.seccionCId,
        diaSemana: 2,
      })

      const auditoria = await prisma.auditoria.findFirstOrThrow({
        where: {
          entidad: 'HORARIO',
          entidadId: respuesta.body.id,
          accion: 'CREAR',
        },
      })
      expect(auditoria.usuarioId).toBe(escenario.director.usuarioId)
    })

    it('rechaza un solapamiento con 409 y un curso de otro nivel con 400', async () => {
      const escenario = await crearEscenario()

      await request(app.server)
        .post('/api/v1/horarios')
        .set('Authorization', `Bearer ${escenario.director.token}`)
        .send({
          anioId: escenario.anioId,
          seccionId: escenario.seccionAId,
          cursoId: escenario.cursoId,
          diaSemana: 1,
          horaInicio: '09:30',
          horaFin: '10:30',
        })
        .expect(409)

      await request(app.server)
        .post('/api/v1/horarios')
        .set('Authorization', `Bearer ${escenario.director.token}`)
        .send({
          anioId: escenario.anioId,
          seccionId: escenario.seccionCId,
          cursoId: escenario.cursoSecundariaId,
          diaSemana: 3,
          horaInicio: '08:00',
          horaFin: '09:00',
        })
        .expect(400)
    })

    it('el docente no gestiona horarios y recibe 403', async () => {
      const escenario = await crearEscenario()

      await request(app.server)
        .post('/api/v1/horarios')
        .set('Authorization', `Bearer ${escenario.tutor.token}`)
        .send({
          anioId: escenario.anioId,
          seccionId: escenario.seccionAId,
          cursoId: escenario.cursoId,
          diaSemana: 2,
          horaInicio: '08:00',
          horaFin: '09:00',
        })
        .expect(403)
    })

    it('actualiza parcialmente y devuelve 404 si no existe', async () => {
      const escenario = await crearEscenario()

      const actualizado = await request(app.server)
        .patch(`/api/v1/horarios/${escenario.horarioBId}`)
        .set('Authorization', `Bearer ${escenario.director.token}`)
        .send({ horaInicio: '10:00', horaFin: '11:00' })
        .expect(200)

      expect(actualizado.body).toMatchObject({
        horaInicio: '10:00',
        horaFin: '11:00',
      })

      await request(app.server)
        .patch(
          '/api/v1/horarios/00000000-0000-4000-8000-000000000099',
        )
        .set('Authorization', `Bearer ${escenario.director.token}`)
        .send({ horaInicio: '08:00' })
        .expect(404)
    })

    it('elimina lógicamente con 204 y deja de listarse', async () => {
      const escenario = await crearEscenario()

      await request(app.server)
        .delete(`/api/v1/horarios/${escenario.horarioBId}`)
        .set('Authorization', `Bearer ${escenario.director.token}`)
        .expect(204)

      const fila = await prisma.horario.findUniqueOrThrow({
        where: { id: escenario.horarioBId },
      })
      expect(fila.deletedAt).not.toBeNull()

      const listado = await getHorarios(
        escenario.director.token,
        escenario.anioId,
      ).expect(200)
      expect(listado.body.meta.total).toBe(1)
    })

    it('el Director y el docente asignado ven los bloques del año', async () => {
      const escenario = await crearEscenario()

      const director = await getHorarios(
        escenario.director.token,
        escenario.anioId,
      ).expect(200)
      expect(director.body.meta.total).toBe(2)

      const docente = await getHorarios(
        escenario.tutor.token,
        escenario.anioId,
      ).expect(200)
      expect(docente.body.meta.total).toBe(2)
    })

    it('el alumno y el apoderado ven solo la sección vinculada', async () => {
      const escenario = await crearEscenario()

      const alumno = await getHorarios(
        escenario.alumno.token,
        escenario.anioId,
      ).expect(200)
      expect(alumno.body.meta.total).toBe(1)
      expect(alumno.body.data[0].seccionId).toBe(escenario.seccionAId)

      const apoderado = await getHorarios(
        escenario.apoderado.token,
        escenario.anioId,
      ).expect(200)
      expect(apoderado.body.meta.total).toBe(1)

      const ajeno = await getHorarios(
        escenario.apoderadoAjeno.token,
        escenario.anioId,
      ).expect(200)
      expect(ajeno.body.meta.total).toBe(0)
    })

    it('el docente no puede filtrar por una sección sin asignación', async () => {
      const escenario = await crearEscenario()

      await request(app.server)
        .get('/api/v1/horarios')
        .query({ anioId: escenario.anioId, seccionId: escenario.seccionCId })
        .set('Authorization', `Bearer ${escenario.tutor.token}`)
        .expect(403)
    })

    it('un usuario sin permiso de lectura recibe 403', async () => {
      const escenario = await crearEscenario()

      await getHorarios(escenario.sinRoles.token, escenario.anioId).expect(403)
    })
  },
)
