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
import { INSTITUCION_ID } from '../constants.js'

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'resumen de calificaciones por período',
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
          numeroDocumento: String(65_000_000 + secuencia),
        },
      })
    }

    async function crearUsuarioConRoles(roles: RoleCode[]) {
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

      return usuario
    }

    async function tokenDe(roles: RoleCode[]) {
      const usuario = await crearUsuarioConRoles(roles)
      const { token } = await signAccessToken(usuario.id)

      return token
    }

    interface Contexto {
      periodoId: string
      cursoId: string
      alumnoId: string
    }

    async function crearContexto(): Promise<Contexto> {
      const anio = await prisma.anioAcademico.create({
        data: {
          institucionId: INSTITUCION_ID,
          nombre: '2026',
          fechaInicio: new Date('2026-03-01'),
          fechaFin: new Date('2026-12-15'),
          estado: 'ACTIVO',
        },
      })
      const nivel = await prisma.nivel.create({
        data: { institucionId: INSTITUCION_ID, nombre: 'Primaria', orden: 1 },
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
      const periodo = await prisma.periodoAcademico.create({
        data: {
          anioId: anio.id,
          nombre: 'Bimestre 1',
          orden: 1,
          fechaInicio: new Date('2026-03-01'),
          fechaFin: new Date('2026-05-31'),
          estado: 'ACTIVO',
        },
      })
      const persona = await crearPersona()
      const alumno = await prisma.alumno.create({
        data: { personaId: persona.id, codigoAlumno: 'AL-1' },
      })

      await prisma.matricula.create({
        data: {
          alumnoId: alumno.id,
          seccionId: seccion.id,
          anioId: anio.id,
          estado: 'APROBADA',
        },
      })

      return {
        periodoId: periodo.id,
        cursoId: curso.id,
        alumnoId: alumno.id,
      }
    }

    function get(ruta: string, token?: string) {
      const peticion = request(app.server).get(ruta)

      return token ? peticion.set('Authorization', `Bearer ${token}`) : peticion
    }

    function ruta(periodoId: string): string {
      return `/api/v1/periodos/${periodoId}/calificaciones/resumen`
    }

    it('exige autenticación', async () => {
      const contexto = await crearContexto()

      await get(ruta(contexto.periodoId)).expect(401)
    })

    it('rechaza a un usuario sin permiso de lectura', async () => {
      const contexto = await crearContexto()
      const token = await tokenDe([])

      await get(ruta(contexto.periodoId), token).expect(403)
    })

    it('devuelve false cuando el período no tiene registros', async () => {
      const contexto = await crearContexto()
      const token = await tokenDe(['DIRECTOR'])

      const respuesta = await get(ruta(contexto.periodoId), token).expect(200)

      expect(respuesta.body).toEqual({
        totalCalificaciones: 0,
        totalNotasFinales: 0,
        tieneCalificaciones: false,
      })
    })

    it('devuelve true cuando existe una calificación', async () => {
      const contexto = await crearContexto()
      const token = await tokenDe(['DIRECTOR'])
      await prisma.calificacion.create({
        data: {
          alumnoId: contexto.alumnoId,
          cursoId: contexto.cursoId,
          periodoId: contexto.periodoId,
          valor: 'A',
        },
      })

      const respuesta = await get(ruta(contexto.periodoId), token).expect(200)

      expect(respuesta.body).toEqual({
        totalCalificaciones: 1,
        totalNotasFinales: 0,
        tieneCalificaciones: true,
      })
    })

    it('devuelve true cuando solo existe una nota final', async () => {
      const contexto = await crearContexto()
      const token = await tokenDe(['DIRECTOR'])
      await prisma.notaFinalPeriodo.create({
        data: {
          alumnoId: contexto.alumnoId,
          cursoId: contexto.cursoId,
          periodoId: contexto.periodoId,
          valor: 'AD',
        },
      })

      const respuesta = await get(ruta(contexto.periodoId), token).expect(200)

      expect(respuesta.body).toEqual({
        totalCalificaciones: 0,
        totalNotasFinales: 1,
        tieneCalificaciones: true,
      })
    })

    it('devuelve 404 si el período no existe', async () => {
      await crearContexto()
      const token = await tokenDe(['DIRECTOR'])

      await get(
        ruta('00000000-0000-4000-8000-000000000099'),
        token,
      ).expect(404)
    })

    it('valida el formato del identificador del período', async () => {
      const token = await tokenDe(['DIRECTOR'])

      await get(ruta('no-es-uuid'), token).expect(400)
    })
  },
)
