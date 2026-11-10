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
  'consulta de calificaciones y notas finales',
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
          numeroDocumento: String(64_000_000 + secuencia),
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
      periodoId: string
      cursoMatematicasId: string
      cursoComunicacionId: string
      calificacionMatematicasId: string
      calificacionComunicacionId: string
      calificacionAlumnoBId: string
      notaFinalMatematicasId: string
      notaFinalAlumnoBId: string
      alumnoAId: string
      director: string
      docente: string
      apoderado: string
      alumno: string
      mixto: string
      superAdmin: string
      superAdminUsuarioId: string
      sinRoles: string
    }

    async function crearEscenario(): Promise<Escenario> {
      const institucion = await prisma.institucion.create({
        data: { nombre: 'IE de Pruebas' },
      })
      const anio = await prisma.anioAcademico.create({
        data: {
          institucionId: institucion.id,
          nombre: '2026',
          fechaInicio: new Date('2026-03-01'),
          fechaFin: new Date('2026-12-15'),
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
      const matematicas = await prisma.curso.create({
        data: { nivelId: nivel.id, nombre: 'Matemática', orden: 1 },
      })
      const comunicacion = await prisma.curso.create({
        data: { nivelId: nivel.id, nombre: 'Comunicación', orden: 2 },
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

      const personaAlumnoA = await crearPersona()
      const alumnoA = await prisma.alumno.create({
        data: { personaId: personaAlumnoA.id, codigoAlumno: 'AL-A' },
      })
      const personaAlumnoB = await crearPersona()
      const alumnoB = await prisma.alumno.create({
        data: { personaId: personaAlumnoB.id, codigoAlumno: 'AL-B' },
      })

      for (const [alumnoId, seccionId] of [
        [alumnoA.id, seccionA.id],
        [alumnoB.id, seccionB.id],
      ] as const) {
        await prisma.matricula.create({
          data: { alumnoId, seccionId, anioId: anio.id, estado: 'APROBADA' },
        })
      }

      const calificacionMatematicas = await prisma.calificacion.create({
        data: {
          alumnoId: alumnoA.id,
          cursoId: matematicas.id,
          periodoId: periodo.id,
          valor: 'AD',
        },
      })
      const calificacionComunicacion = await prisma.calificacion.create({
        data: {
          alumnoId: alumnoA.id,
          cursoId: comunicacion.id,
          periodoId: periodo.id,
          valor: 'A',
        },
      })
      const calificacionAlumnoB = await prisma.calificacion.create({
        data: {
          alumnoId: alumnoB.id,
          cursoId: comunicacion.id,
          periodoId: periodo.id,
          valor: 'B',
        },
      })

      const notaFinalMatematicas = await prisma.notaFinalPeriodo.create({
        data: {
          alumnoId: alumnoA.id,
          cursoId: matematicas.id,
          periodoId: periodo.id,
          valor: 'AD',
        },
      })
      const notaFinalAlumnoB = await prisma.notaFinalPeriodo.create({
        data: {
          alumnoId: alumnoB.id,
          cursoId: comunicacion.id,
          periodoId: periodo.id,
          valor: 'B',
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
          cursoId: matematicas.id,
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
        personaAlumnoA.id,
      )

      // Usuario con doble rol: docente de Matemática A y apoderado del
      // alumno B. Su listado debe ser la unión de ambos alcances.
      const personaMixta = await crearPersona()
      const usuarioMixto = await crearUsuarioConRoles(
        ['DOCENTE', 'APODERADO'],
        personaMixta.id,
      )
      const docenteMixto = await prisma.docente.create({
        data: { personaId: personaMixta.id, codigoDocente: 'DOC-3' },
      })
      await prisma.asignacionDocente.create({
        data: {
          docenteId: docenteMixto.id,
          cursoId: matematicas.id,
          seccionId: seccionA.id,
          anioId: anio.id,
        },
      })
      const apoderadoMixto = await prisma.apoderado.create({
        data: { personaId: personaMixta.id },
      })
      await prisma.apoderadoAlumno.create({
        data: {
          apoderadoId: apoderadoMixto.id,
          alumnoId: alumnoB.id,
          parentesco: 'Padre',
          esPrincipal: true,
        },
      })

      const director = await tokenDe(['DIRECTOR'])
      const superAdmin = await tokenDe(['SUPER_ADMIN'])
      const sinRoles = await tokenDe([])

      return {
        periodoId: periodo.id,
        cursoMatematicasId: matematicas.id,
        cursoComunicacionId: comunicacion.id,
        calificacionMatematicasId: calificacionMatematicas.id,
        calificacionComunicacionId: calificacionComunicacion.id,
        calificacionAlumnoBId: calificacionAlumnoB.id,
        notaFinalMatematicasId: notaFinalMatematicas.id,
        notaFinalAlumnoBId: notaFinalAlumnoB.id,
        alumnoAId: alumnoA.id,
        director: director.token,
        docente: (await signAccessToken(usuarioDocente.id)).token,
        apoderado: (await signAccessToken(usuarioApoderado.id)).token,
        alumno: (await signAccessToken(usuarioAlumno.id)).token,
        mixto: (await signAccessToken(usuarioMixto.id)).token,
        superAdmin: superAdmin.token,
        superAdminUsuarioId: superAdmin.usuario.id,
        sinRoles: sinRoles.token,
      }
    }

    function get(ruta: string, token?: string) {
      const peticion = request(app.server).get(ruta)

      return token ? peticion.set('Authorization', `Bearer ${token}`) : peticion
    }

    it('exige autenticación en ambos listados', async () => {
      const escenario = await crearEscenario()

      await get(
        `/api/v1/periodos/${escenario.periodoId}/calificaciones`,
      ).expect(401)
      await get(
        `/api/v1/periodos/${escenario.periodoId}/notas-finales`,
      ).expect(401)
    })

    it('rechaza a un usuario sin roles', async () => {
      const escenario = await crearEscenario()

      await get(
        `/api/v1/periodos/${escenario.periodoId}/calificaciones`,
        escenario.sinRoles,
      ).expect(403)
    })

    it('el Director ve todas las calificaciones del período', async () => {
      const escenario = await crearEscenario()

      const respuesta = await get(
        `/api/v1/periodos/${escenario.periodoId}/calificaciones`,
        escenario.director,
      ).expect(200)

      expect(respuesta.body.meta.total).toBe(3)
      expect(respuesta.body.data).toHaveLength(3)

      const ids = respuesta.body.data.map(
        (fila: { id: string }) => fila.id,
      )
      expect(ids).toEqual(
        expect.arrayContaining([
          escenario.calificacionMatematicasId,
          escenario.calificacionComunicacionId,
          escenario.calificacionAlumnoBId,
        ]),
      )
    })

    it('el docente solo ve sus cursos y secciones asignados', async () => {
      const escenario = await crearEscenario()

      const respuesta = await get(
        `/api/v1/periodos/${escenario.periodoId}/calificaciones`,
        escenario.docente,
      ).expect(200)

      expect(respuesta.body.meta.total).toBe(1)
      expect(respuesta.body.data[0].id).toBe(
        escenario.calificacionMatematicasId,
      )
    })

    it('el docente recibe 403 al filtrar por un curso no asignado', async () => {
      const escenario = await crearEscenario()

      await get(
        `/api/v1/periodos/${escenario.periodoId}/calificaciones?cursoId=${escenario.cursoComunicacionId}`,
        escenario.docente,
      ).expect(403)
    })

    it('el apoderado solo ve las calificaciones de sus alumnos vinculados', async () => {
      const escenario = await crearEscenario()

      const respuesta = await get(
        `/api/v1/periodos/${escenario.periodoId}/calificaciones`,
        escenario.apoderado,
      ).expect(200)

      expect(respuesta.body.meta.total).toBe(2)
      const ids = respuesta.body.data.map(
        (fila: { id: string }) => fila.id,
      )
      expect(ids).toEqual(
        expect.arrayContaining([
          escenario.calificacionMatematicasId,
          escenario.calificacionComunicacionId,
        ]),
      )
      expect(ids).not.toContain(escenario.calificacionAlumnoBId)
    })

    it('el alumno solo ve sus propias calificaciones', async () => {
      const escenario = await crearEscenario()

      const respuesta = await get(
        `/api/v1/periodos/${escenario.periodoId}/calificaciones`,
        escenario.alumno,
      ).expect(200)

      expect(respuesta.body.meta.total).toBe(2)
      expect(
        respuesta.body.data.every(
          (fila: { alumnoId: string }) =>
            fila.alumnoId === escenario.alumnoAId,
        ),
      ).toBe(true)
      const ids = respuesta.body.data.map(
        (fila: { id: string }) => fila.id,
      )
      expect(ids).not.toContain(escenario.calificacionAlumnoBId)
    })

    it('une los alcances cuando el usuario tiene varios roles', async () => {
      const escenario = await crearEscenario()

      const respuesta = await get(
        `/api/v1/periodos/${escenario.periodoId}/calificaciones`,
        escenario.mixto,
      ).expect(200)

      expect(respuesta.body.meta.total).toBe(2)
      const ids = respuesta.body.data.map((fila: { id: string }) => fila.id)
      expect(ids).toEqual(
        expect.arrayContaining([
          escenario.calificacionMatematicasId,
          escenario.calificacionAlumnoBId,
        ]),
      )
    })

    it('el SuperAdmin ve todo y su acceso queda auditado', async () => {
      const escenario = await crearEscenario()

      const respuesta = await get(
        `/api/v1/periodos/${escenario.periodoId}/calificaciones`,
        escenario.superAdmin,
      ).expect(200)

      expect(respuesta.body.meta.total).toBe(3)

      const auditoria = await prisma.auditoria.findFirstOrThrow({
        where: {
          accion: 'ACCEDER',
          entidad: 'CALIFICACION',
          entidadId: escenario.periodoId,
        },
      })
      expect(auditoria.usuarioId).toBe(escenario.superAdminUsuarioId)
      expect(auditoria.ip).toBeDefined()
    })

    it('devuelve 404 si el período no existe', async () => {
      const escenario = await crearEscenario()

      await get(
        `/api/v1/periodos/00000000-0000-4000-8000-000000000099/calificaciones`,
        escenario.director,
      ).expect(404)
    })

    it('aplica el mismo alcance al listado de notas finales', async () => {
      const escenario = await crearEscenario()

      const director = await get(
        `/api/v1/periodos/${escenario.periodoId}/notas-finales`,
        escenario.director,
      ).expect(200)
      expect(director.body.meta.total).toBe(2)

      const docente = await get(
        `/api/v1/periodos/${escenario.periodoId}/notas-finales`,
        escenario.docente,
      ).expect(200)
      expect(docente.body.meta.total).toBe(1)
      expect(docente.body.data[0].id).toBe(escenario.notaFinalMatematicasId)

      const ajeno = await get(
        `/api/v1/periodos/${escenario.periodoId}/notas-finales?cursoId=${escenario.cursoComunicacionId}`,
        escenario.docente,
      ).expect(403)
      expect(ajeno.body.error.code).toBe('FORBIDDEN')
    })
  },
)
