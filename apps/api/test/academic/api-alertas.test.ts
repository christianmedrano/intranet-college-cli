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
  'API de umbral y alertas',
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
          numeroDocumento: String(73_000_000 + secuencia),
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
      otroAnioId: string
      alumnoId: string
      alertaId: string
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
      const otroAnio = await prisma.anioAcademico.create({
        data: {
          institucionId: institucion.id,
          nombre: '2025',
          fechaInicio: new Date('2025-03-01'),
          fechaFin: new Date('2025-12-15'),
          estado: 'PLANIFICADO',
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

      const alerta = await prisma.alertaAsistencia.create({
        data: {
          alumnoId: alumno.id,
          anioId: anio.id,
          faltasInjustificadas: 3,
          umbral: 3,
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

      const tutor = await crearActorConToken(['DOCENTE'])
      const docente = await prisma.docente.create({
        data: {
          personaId: tutor.personaId,
          codigoDocente: `DOC-${secuencia}`,
        },
      })
      await prisma.asignacionDocente.create({
        data: {
          docenteId: docente.id,
          cursoId: curso.id,
          seccionId: seccion.id,
          anioId: anio.id,
          esTutor: true,
        },
      })

      return {
        anioId: anio.id,
        otroAnioId: otroAnio.id,
        alumnoId: alumno.id,
        alertaId: alerta.id,
        apoderado,
        apoderadoAjeno: await crearActorConToken(['APODERADO']),
        alumno: await crearActorConToken(['ALUMNO'], personaAlumno.id),
        tutor,
        director: await crearActorConToken(['DIRECTOR']),
        sinRoles: await crearActorConToken([]),
      }
    }

    function getAlertas(token?: string) {
      const peticion = request(app.server).get('/api/v1/alertas-asistencia')

      return token ? peticion.set('Authorization', `Bearer ${token}`) : peticion
    }

    it('exige autenticación para consultar alertas', async () => {
      await crearEscenario()

      await getAlertas().expect(401)
    })

    it('el Director lee y configura el umbral, y queda auditado', async () => {
      const escenario = await crearEscenario()
      const ruta = `/api/v1/anios-academicos/${escenario.anioId}/umbral-asistencia`

      const vacio = await request(app.server)
        .get(ruta)
        .set('Authorization', `Bearer ${escenario.director.token}`)
        .expect(200)
      expect(vacio.body).toEqual({
        anioId: escenario.anioId,
        faltasParaAlerta: null,
      })

      const guardado = await request(app.server)
        .put(ruta)
        .set('Authorization', `Bearer ${escenario.director.token}`)
        .send({ faltasParaAlerta: 3 })
        .expect(200)
      expect(guardado.body).toEqual({
        anioId: escenario.anioId,
        faltasParaAlerta: 3,
      })

      const auditoria = await prisma.auditoria.findFirstOrThrow({
        where: { entidad: 'UMBRAL_ASISTENCIA', entidadId: escenario.anioId },
      })
      expect(auditoria.accion).toBe('CREAR')
    })

    it('rechaza un umbral no positivo con 400', async () => {
      const escenario = await crearEscenario()

      await request(app.server)
        .put(`/api/v1/anios-academicos/${escenario.anioId}/umbral-asistencia`)
        .set('Authorization', `Bearer ${escenario.director.token}`)
        .send({ faltasParaAlerta: 0 })
        .expect(400)

      await request(app.server)
        .put(`/api/v1/anios-academicos/${escenario.anioId}/umbral-asistencia`)
        .set('Authorization', `Bearer ${escenario.director.token}`)
        .send({ faltasParaAlerta: -1 })
        .expect(400)
    })

    it('el docente no configura el umbral y recibe 403', async () => {
      const escenario = await crearEscenario()
      const ruta = `/api/v1/anios-academicos/${escenario.anioId}/umbral-asistencia`

      await request(app.server)
        .get(ruta)
        .set('Authorization', `Bearer ${escenario.tutor.token}`)
        .expect(403)

      await request(app.server)
        .put(ruta)
        .set('Authorization', `Bearer ${escenario.tutor.token}`)
        .send({ faltasParaAlerta: 3 })
        .expect(403)
    })

    it('devuelve 404 si el año no existe', async () => {
      const escenario = await crearEscenario()

      await request(app.server)
        .get(
          '/api/v1/anios-academicos/00000000-0000-4000-8000-000000000099/umbral-asistencia',
        )
        .set('Authorization', `Bearer ${escenario.director.token}`)
        .expect(404)
    })

    it('el Director y el tutor de la sección ven la alerta', async () => {
      const escenario = await crearEscenario()

      const director = await getAlertas(escenario.director.token).expect(200)
      expect(director.body.meta.total).toBe(1)
      expect(director.body.data[0]).toMatchObject({
        id: escenario.alertaId,
        faltasInjustificadas: 3,
        umbral: 3,
      })

      const tutor = await getAlertas(escenario.tutor.token).expect(200)
      expect(tutor.body.meta.total).toBe(1)
    })

    it('el apoderado y el alumno ven solo sus alertas', async () => {
      const escenario = await crearEscenario()

      const apoderado = await getAlertas(escenario.apoderado.token).expect(200)
      expect(apoderado.body.meta.total).toBe(1)

      const alumno = await getAlertas(escenario.alumno.token).expect(200)
      expect(alumno.body.meta.total).toBe(1)

      const ajeno = await getAlertas(escenario.apoderadoAjeno.token).expect(200)
      expect(ajeno.body.meta.total).toBe(0)
    })

    it('un filtro por alumno ajeno devuelve 403', async () => {
      const escenario = await crearEscenario()

      await request(app.server)
        .get('/api/v1/alertas-asistencia')
        .query({ alumnoId: escenario.alumnoId })
        .set('Authorization', `Bearer ${escenario.apoderadoAjeno.token}`)
        .expect(403)
    })

    it('un docente no puede filtrar por un año sin asignación', async () => {
      const escenario = await crearEscenario()

      await request(app.server)
        .get('/api/v1/alertas-asistencia')
        .query({ anioId: escenario.otroAnioId })
        .set('Authorization', `Bearer ${escenario.tutor.token}`)
        .expect(403)
    })

    it('un usuario sin permiso de lectura recibe 403', async () => {
      const escenario = await crearEscenario()

      await getAlertas(escenario.sinRoles.token).expect(403)
    })
  },
)
