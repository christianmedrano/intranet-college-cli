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

/** Fecha escolar en `America/Lima`, desplazada los días indicados. */
function fechaEnLima(desplazamientoDias = 0): string {
  const fecha = new Date(Date.now() + desplazamientoDias * 86_400_000)

  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(fecha)
}

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'API de registro de asistencias',
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
          numeroDocumento: String(69_000_000 + secuencia),
        },
      })
    }

    async function crearActor(roles: RoleCode[]) {
      secuencia += 1
      const persona = await crearPersona()
      const usuario = await prisma.usuario.create({
        data: {
          personaId: persona.id,
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

      return { usuario, token }
    }

    interface Contexto {
      seccionId: string
      anioId: string
      nivelId: string
      alumnoAId: string
      alumnoBId: string
      alumnoSinMatriculaId: string
    }

    async function crearContexto(): Promise<Contexto> {
      const institucion = await prisma.institucion.create({
        data: { nombre: 'IE de Pruebas' },
      })
      const anio = await prisma.anioAcademico.create({
        data: {
          institucionId: institucion.id,
          nombre: 'Escolar',
          fechaInicio: new Date('2020-01-01'),
          fechaFin: new Date('2099-12-31'),
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

      async function crearAlumno(codigo: string) {
        const persona = await crearPersona()

        return prisma.alumno.create({
          data: { personaId: persona.id, codigoAlumno: codigo },
        })
      }

      const alumnoA = await crearAlumno('AL-A')
      const alumnoB = await crearAlumno('AL-B')
      const alumnoSinMatricula = await crearAlumno('AL-C')

      for (const alumno of [alumnoA, alumnoB]) {
        await prisma.matricula.create({
          data: {
            alumnoId: alumno.id,
            seccionId: seccion.id,
            anioId: anio.id,
            estado: 'APROBADA',
          },
        })
      }

      return {
        seccionId: seccion.id,
        anioId: anio.id,
        nivelId: nivel.id,
        alumnoAId: alumnoA.id,
        alumnoBId: alumnoB.id,
        alumnoSinMatriculaId: alumnoSinMatricula.id,
      }
    }

    async function crearDocenteAsignado(
      contexto: Contexto,
      roles: RoleCode[] = ['DOCENTE'],
      asignar = true,
    ) {
      const actor = await crearActor(roles)

      if (!asignar) {
        return actor
      }

      const usuario = await prisma.usuario.findUniqueOrThrow({
        where: { id: actor.usuario.id },
        select: { personaId: true },
      })
      const curso = await prisma.curso.create({
        data: {
          nivelId: contexto.nivelId,
          nombre: `Curso ${secuencia}`,
          orden: secuencia,
        },
      })
      const docente = await prisma.docente.create({
        data: {
          personaId: usuario.personaId,
          codigoDocente: `DOC-${secuencia}`,
        },
      })
      await prisma.asignacionDocente.create({
        data: {
          docenteId: docente.id,
          cursoId: curso.id,
          seccionId: contexto.seccionId,
          anioId: contexto.anioId,
        },
      })

      return actor
    }

    function enviarLote(token: string | undefined, cuerpo: unknown) {
      const peticion = request(app.server)
        .post('/api/v1/asistencias/lote')
        .send(cuerpo)

      return token ? peticion.set('Authorization', `Bearer ${token}`) : peticion
    }

    it('exige autenticación', async () => {
      const contexto = await crearContexto()

      await enviarLote(undefined, {
        seccionId: contexto.seccionId,
        fecha: FECHA,
        registros: [{ alumnoId: contexto.alumnoAId, estado: 'PRESENTE' }],
      }).expect(401)
    })

    it('rechaza a un rol sin permiso de gestión', async () => {
      const contexto = await crearContexto()
      const apoderado = await crearActor(['APODERADO'])

      await enviarLote(apoderado.token, {
        seccionId: contexto.seccionId,
        fecha: FECHA,
        registros: [{ alumnoId: contexto.alumnoAId, estado: 'PRESENTE' }],
      }).expect(403)
    })

    it('registra el lote con 201 y auditoría', async () => {
      const contexto = await crearContexto()
      const docente = await crearDocenteAsignado(contexto)

      const respuesta = await enviarLote(docente.token, {
        seccionId: contexto.seccionId,
        fecha: FECHA,
        registros: [
          { alumnoId: contexto.alumnoAId, estado: 'PRESENTE' },
          { alumnoId: contexto.alumnoBId, estado: 'TARDE' },
        ],
      }).expect(201)

      expect(respuesta.body.registros).toHaveLength(2)

      const auditorias = await prisma.auditoria.findMany({
        where: { entidad: 'ASISTENCIA', accion: 'CREAR' },
      })
      expect(auditorias).toHaveLength(2)
    })

    it('devuelve 409 al duplicar la fecha de un alumno', async () => {
      const contexto = await crearContexto()
      const docente = await crearDocenteAsignado(contexto)

      await prisma.asistencia.create({
        data: {
          alumnoId: contexto.alumnoAId,
          fecha: aFechaUTC(FECHA),
          estado: 'PRESENTE',
        },
      })

      await enviarLote(docente.token, {
        seccionId: contexto.seccionId,
        fecha: FECHA,
        registros: [{ alumnoId: contexto.alumnoAId, estado: 'PRESENTE' }],
      }).expect(409)
    })

    it('rechaza una fecha futura con 400', async () => {
      const contexto = await crearContexto()
      const docente = await crearDocenteAsignado(contexto)

      await enviarLote(docente.token, {
        seccionId: contexto.seccionId,
        fecha: fechaEnLima(1),
        registros: [{ alumnoId: contexto.alumnoAId, estado: 'PRESENTE' }],
      }).expect(400)
    })

    it('rechaza un alumno sin matrícula aprobada con 409', async () => {
      const contexto = await crearContexto()
      const docente = await crearDocenteAsignado(contexto)

      await enviarLote(docente.token, {
        seccionId: contexto.seccionId,
        fecha: FECHA,
        registros: [
          { alumnoId: contexto.alumnoAId, estado: 'PRESENTE' },
          { alumnoId: contexto.alumnoSinMatriculaId, estado: 'PRESENTE' },
        ],
      }).expect(409)

      await expect(
        prisma.asistencia.count({ where: { alumnoId: contexto.alumnoAId } }),
      ).resolves.toBe(0)
    })

    it('rechaza al docente sin asignación en la sección con 403', async () => {
      const contexto = await crearContexto()
      const docente = await crearDocenteAsignado(contexto, ['DOCENTE'], false)

      await enviarLote(docente.token, {
        seccionId: contexto.seccionId,
        fecha: FECHA,
        registros: [{ alumnoId: contexto.alumnoAId, estado: 'PRESENTE' }],
      }).expect(403)
    })

    it('valida el cuerpo del lote', async () => {
      const contexto = await crearContexto()
      const docente = await crearDocenteAsignado(contexto)

      await enviarLote(docente.token, {
        seccionId: contexto.seccionId,
        fecha: FECHA,
        registros: [],
      }).expect(400)
    })
  },
)
