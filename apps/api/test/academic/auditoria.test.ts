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

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'auditoría académica',
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

    async function crearPersona(nombres?: string) {
      secuencia += 1

      return prisma.persona.create({
        data: {
          nombres: nombres ?? `Persona${secuencia}`,
          apellidos: 'De Prueba',
          tipoDocumento: 'DNI',
          numeroDocumento: String(76_000_000 + secuencia),
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
      cursoId: string
      seccionId: string
      periodoId: string
      calificacionId: string
      asistenciaId: string
      alumnoId: string
      director: ActorToken
      superAdmin: ActorToken
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
      const periodo = await prisma.periodoAcademico.create({
        data: {
          anioId: anio.id,
          nombre: 'Bimestre 1',
          orden: 1,
          fechaInicio: new Date('2024-03-01'),
          fechaFin: new Date('2024-05-31'),
          estado: 'CERRADO',
        },
      })

      const personaAlumno = await crearPersona('Ana Auditoria')
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

      const calificacion = await prisma.calificacion.create({
        data: {
          alumnoId: alumno.id,
          cursoId: curso.id,
          periodoId: periodo.id,
          valor: 'B',
        },
      })
      await prisma.notaFinalPeriodo.create({
        data: {
          alumnoId: alumno.id,
          cursoId: curso.id,
          periodoId: periodo.id,
          valor: 'B',
        },
      })

      const asistencia = await prisma.asistencia.create({
        data: {
          alumnoId: alumno.id,
          fecha: aFechaUTC('2024-05-02'),
          estado: 'FALTA_INJUSTIFICADA',
        },
      })

      const apoderado = await crearActorConToken(['APODERADO'])
      await prisma.justificacionFalta.create({
        data: {
          asistenciaId: asistencia.id,
          solicitanteUsuarioId: apoderado.usuarioId,
          motivo: 'Cita médica',
        },
      })

      await prisma.alertaAsistencia.create({
        data: {
          alumnoId: alumno.id,
          anioId: anio.id,
          faltasInjustificadas: 1,
          umbral: 1,
        },
      })

      await prisma.horario.create({
        data: {
          anioId: anio.id,
          seccionId: seccion.id,
          cursoId: curso.id,
          diaSemana: 1,
          horaInicio: '09:00',
          horaFin: '10:00',
        },
      })

      return {
        anioId: anio.id,
        cursoId: curso.id,
        seccionId: seccion.id,
        periodoId: periodo.id,
        calificacionId: calificacion.id,
        asistenciaId: asistencia.id,
        alumnoId: alumno.id,
        director: await crearActorConToken(['DIRECTOR']),
        superAdmin: await crearActorConToken(['SUPER_ADMIN', 'DIRECTOR']),
      }
    }

    function get(ruta: string, token: string) {
      return request(app.server)
        .get(ruta)
        .set('Authorization', `Bearer ${token}`)
    }

    it('audita el acceso del SuperAdmin a cada recurso académico sin PII', async () => {
      const escenario = await crearEscenario()
      const token = escenario.superAdmin.token

      await get(
        `/api/v1/periodos/${escenario.periodoId}/calificaciones`,
        token,
      ).expect(200)
      await get(
        `/api/v1/periodos/${escenario.periodoId}/notas-finales`,
        token,
      ).expect(200)
      await get(`/api/v1/asistencias?anioId=${escenario.anioId}`, token).expect(
        200,
      )
      await get('/api/v1/justificaciones', token).expect(200)
      await get(
        `/api/v1/alertas-asistencia?anioId=${escenario.anioId}`,
        token,
      ).expect(200)
      await get(`/api/v1/horarios?anioId=${escenario.anioId}`, token).expect(
        200,
      )

      const accesos = await prisma.auditoria.findMany({
        where: { usuarioId: escenario.superAdmin.usuarioId, accion: 'ACCEDER' },
      })

      expect(new Set(accesos.map((fila) => fila.entidad))).toEqual(
        new Set([
          'CALIFICACION',
          'NOTA_FINAL_PERIODO',
          'ASISTENCIA',
          'JUSTIFICACION_FALTA',
          'ALERTA_ASISTENCIA',
          'HORARIO',
        ]),
      )

      for (const acceso of accesos) {
        expect(acceso.ip).not.toBeNull()
        const texto = JSON.stringify(acceso.datos)
        expect(texto).not.toContain('Ana')
        expect(texto).not.toContain('Auditoria')
        expect(texto).not.toContain('76000')
      }
    })

    it('audita la corrección con valor anterior y nuevo, sin el texto del motivo', async () => {
      const escenario = await crearEscenario()

      await request(app.server)
        .patch(`/api/v1/calificaciones/${escenario.calificacionId}`)
        .set('Authorization', `Bearer ${escenario.director.token}`)
        .send({ valor: 'A', motivo: 'Revisión confidencial del acta' })
        .expect(200)

      const auditoria = await prisma.auditoria.findFirstOrThrow({
        where: {
          entidad: 'CALIFICACION',
          entidadId: escenario.calificacionId,
          accion: 'CORREGIR',
        },
      })

      expect(auditoria.usuarioId).toBe(escenario.director.usuarioId)
      expect(auditoria.datos).toMatchObject({
        valor: { anterior: 'B', nuevo: 'A' },
        motivoPresente: true,
      })
      expect(JSON.stringify(auditoria.datos)).not.toContain(
        'Revisión confidencial del acta',
      )
    })

    it('audita la corrección de asistencia con el estado anterior y el nuevo', async () => {
      const escenario = await crearEscenario()

      await request(app.server)
        .patch(`/api/v1/asistencias/${escenario.asistenciaId}`)
        .set('Authorization', `Bearer ${escenario.director.token}`)
        .send({ estado: 'FALTA_JUSTIFICADA', motivo: 'Documento privado' })
        .expect(200)

      const auditoria = await prisma.auditoria.findFirstOrThrow({
        where: {
          entidad: 'ASISTENCIA',
          entidadId: escenario.asistenciaId,
          accion: 'CORREGIR',
        },
      })

      expect(auditoria.datos).toMatchObject({
        estado: { anterior: 'FALTA_INJUSTIFICADA', nuevo: 'FALTA_JUSTIFICADA' },
        motivoPresente: true,
      })
      expect(JSON.stringify(auditoria.datos)).not.toContain('Documento privado')
    })

    it('la auditoría es de solo inserción: no existe PATCH ni DELETE', async () => {
      const escenario = await crearEscenario()
      const fila = await prisma.auditoria.create({
        data: {
          usuarioId: escenario.director.usuarioId,
          accion: 'CREAR',
          entidad: 'HORARIO',
        },
      })

      await request(app.server)
        .patch(`/api/v1/auditoria/${fila.id}`)
        .set('Authorization', `Bearer ${escenario.director.token}`)
        .send({ accion: 'RETIRAR' })
        .expect(404)

      await request(app.server)
        .delete(`/api/v1/auditoria/${fila.id}`)
        .set('Authorization', `Bearer ${escenario.director.token}`)
        .expect(404)
    })
  },
)
