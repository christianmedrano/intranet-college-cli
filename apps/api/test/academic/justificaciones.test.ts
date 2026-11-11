import type { RoleCode } from '@intranet/shared'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { PrismaClient } from '../../src/generated/prisma/client.js'
import { aFechaUTC } from '../../src/modules/core/estructura/fechas.js'
import {
  aprobarJustificacion,
  rechazarJustificacion,
  solicitarJustificacion,
} from '../../src/modules/academic/justificaciones/justificacion.service.js'
import type { ActorAcademico } from '../../src/modules/academic/scope.js'
import {
  createTestPrisma,
  limpiarBaseDePruebas,
} from '../helpers/test-db.js'

const FECHA = '2024-05-12'

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'servicio de justificaciones',
  () => {
    let prisma: PrismaClient
    let secuencia = 0

    beforeAll(() => {
      prisma = createTestPrisma()
    })

    beforeEach(async () => {
      await limpiarBaseDePruebas(prisma)
      secuencia = 0
    })

    afterAll(async () => {
      await prisma.$disconnect()
    })

    async function crearPersona() {
      secuencia += 1

      return prisma.persona.create({
        data: {
          nombres: `Persona${secuencia}`,
          apellidos: 'De Prueba',
          tipoDocumento: 'DNI',
          numeroDocumento: String(70_000_000 + secuencia),
        },
      })
    }

    interface ActorCompleto {
      actor: ActorAcademico
      usuarioId: string
      personaId: string
    }

    async function crearActorCompleto(
      roles: RoleCode[],
    ): Promise<ActorCompleto> {
      const persona = await crearPersona()
      const usuario = await prisma.usuario.create({
        data: {
          personaId: persona.id,
          username: `usuario${secuencia}`,
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

      return {
        actor: { id: usuario.id, roles },
        usuarioId: usuario.id,
        personaId: persona.id,
      }
    }

    interface Contexto {
      seccionId: string
      anioId: string
      nivelId: string
      alumnoId: string
      asistenciaId: string
      apoderado: ActorCompleto
      tutor: ActorCompleto
      noTutor: ActorCompleto
      director: ActorCompleto
      apoderadoAjeno: ActorCompleto
    }

    async function crearContexto(): Promise<Contexto> {
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

      const apoderado = await crearActorCompleto(['APODERADO'])
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

      async function crearDocente(
        esTutor: boolean,
      ): Promise<ActorCompleto> {
        const actor = await crearActorCompleto(['DOCENTE'])
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
      const director = await crearActorCompleto(['DIRECTOR'])
      const apoderadoAjeno = await crearActorCompleto(['APODERADO'])

      return {
        seccionId: seccion.id,
        anioId: anio.id,
        nivelId: nivel.id,
        alumnoId: alumno.id,
        asistenciaId: asistencia.id,
        apoderado,
        tutor,
        noTutor,
        director,
        apoderadoAjeno,
      }
    }

    it('el apoderado vinculado crea la solicitud y se audita', async () => {
      const contexto = await crearContexto()

      const solicitud = await solicitarJustificacion(
        contexto.asistenciaId,
        { motivo: 'Cita médica' },
        contexto.apoderado.actor,
        {},
        prisma,
      )

      expect(solicitud).toMatchObject({
        asistenciaId: contexto.asistenciaId,
        estado: 'SOLICITADA',
        solicitanteUsuarioId: contexto.apoderado.usuarioId,
        resueltoPor: null,
      })

      const auditoria = await prisma.auditoria.findFirstOrThrow({
        where: {
          entidad: 'JUSTIFICACION_FALTA',
          entidadId: solicitud.id,
          accion: 'CREAR',
        },
      })
      expect(auditoria.usuarioId).toBe(contexto.apoderado.usuarioId)
    })

    it('rechaza al apoderado ajeno', async () => {
      const contexto = await crearContexto()

      await expect(
        solicitarJustificacion(
          contexto.asistenciaId,
          { motivo: 'Cita médica' },
          contexto.apoderadoAjeno.actor,
          {},
          prisma,
        ),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    })

    it('solo justifica una falta injustificada', async () => {
      const contexto = await crearContexto()
      await prisma.asistencia.update({
        where: { id: contexto.asistenciaId },
        data: { estado: 'PRESENTE' },
      })

      await expect(
        solicitarJustificacion(
          contexto.asistenciaId,
          { motivo: 'Cita médica' },
          contexto.apoderado.actor,
          {},
          prisma,
        ),
      ).rejects.toMatchObject({ code: 'CONFLICT' })
    })

    it('rechaza una segunda solicitud abierta', async () => {
      const contexto = await crearContexto()

      await solicitarJustificacion(
        contexto.asistenciaId,
        { motivo: 'Cita médica' },
        contexto.apoderado.actor,
        {},
        prisma,
      )

      await expect(
        solicitarJustificacion(
          contexto.asistenciaId,
          { motivo: 'Otra razón' },
          contexto.apoderado.actor,
          {},
          prisma,
        ),
      ).rejects.toMatchObject({ code: 'CONFLICT' })
    })

    it('el tutor aprueba y la asistencia pasa a justificada', async () => {
      const contexto = await crearContexto()
      const solicitud = await solicitarJustificacion(
        contexto.asistenciaId,
        { motivo: 'Cita médica' },
        contexto.apoderado.actor,
        {},
        prisma,
      )

      const aprobada = await aprobarJustificacion(
        solicitud.id,
        { comentario: 'Documento presentado' },
        contexto.tutor.actor,
        {},
        prisma,
      )

      expect(aprobada.estado).toBe('APROBADA')
      expect(aprobada.resueltoPor).toBe(contexto.tutor.usuarioId)

      const asistencia = await prisma.asistencia.findUniqueOrThrow({
        where: { id: contexto.asistenciaId },
      })
      expect(asistencia.estado).toBe('FALTA_JUSTIFICADA')

      const auditoria = await prisma.auditoria.findFirstOrThrow({
        where: {
          entidad: 'JUSTIFICACION_FALTA',
          entidadId: solicitud.id,
          accion: 'APROBAR',
        },
      })
      expect(auditoria.datos).toMatchObject({
        estado: {
          anterior: 'FALTA_INJUSTIFICADA',
          nuevo: 'FALTA_JUSTIFICADA',
        },
      })
    })

    it('rechaza al docente que no es tutor', async () => {
      const contexto = await crearContexto()
      const solicitud = await solicitarJustificacion(
        contexto.asistenciaId,
        { motivo: 'Cita médica' },
        contexto.apoderado.actor,
        {},
        prisma,
      )

      await expect(
        aprobarJustificacion(
          solicitud.id,
          {},
          contexto.noTutor.actor,
          {},
          prisma,
        ),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    })

    it('el Director aprueba sin ser tutor', async () => {
      const contexto = await crearContexto()
      const solicitud = await solicitarJustificacion(
        contexto.asistenciaId,
        { motivo: 'Cita médica' },
        contexto.apoderado.actor,
        {},
        prisma,
      )

      const aprobada = await aprobarJustificacion(
        solicitud.id,
        {},
        contexto.director.actor,
        {},
        prisma,
      )

      expect(aprobada.estado).toBe('APROBADA')
    })

    it('el rechazo conserva la falta injustificada y se audita', async () => {
      const contexto = await crearContexto()
      const solicitud = await solicitarJustificacion(
        contexto.asistenciaId,
        { motivo: 'Cita médica' },
        contexto.apoderado.actor,
        {},
        prisma,
      )

      const rechazada = await rechazarJustificacion(
        solicitud.id,
        { motivo: 'Sin documentos' },
        contexto.tutor.actor,
        {},
        prisma,
      )

      expect(rechazada.estado).toBe('RECHAZADA')
      expect(rechazada.motivoResolucion).toBe('Sin documentos')

      const asistencia = await prisma.asistencia.findUniqueOrThrow({
        where: { id: contexto.asistenciaId },
      })
      expect(asistencia.estado).toBe('FALTA_INJUSTIFICADA')

      const auditoria = await prisma.auditoria.findFirstOrThrow({
        where: {
          entidad: 'JUSTIFICACION_FALTA',
          entidadId: solicitud.id,
          accion: 'RECHAZAR',
        },
      })
      expect(auditoria.datos).toMatchObject({ motivoPresente: true })
      expect(JSON.stringify(auditoria.datos)).not.toContain('Sin documentos')
    })

    it('no permite resolver dos veces la misma solicitud', async () => {
      const contexto = await crearContexto()
      const solicitud = await solicitarJustificacion(
        contexto.asistenciaId,
        { motivo: 'Cita médica' },
        contexto.apoderado.actor,
        {},
        prisma,
      )

      await aprobarJustificacion(
        solicitud.id,
        {},
        contexto.director.actor,
        {},
        prisma,
      )

      await expect(
        rechazarJustificacion(
          solicitud.id,
          { motivo: 'Tarde' },
          contexto.director.actor,
          {},
          prisma,
        ),
      ).rejects.toMatchObject({ code: 'CONFLICT' })
    })

    it('nadie resuelve su propia solicitud', async () => {
      const contexto = await crearContexto()
      const mixto = await crearActorCompleto(['APODERADO', 'DOCENTE'])
      const registro = await prisma.apoderado.create({
        data: { personaId: mixto.personaId },
      })
      await prisma.apoderadoAlumno.create({
        data: {
          apoderadoId: registro.id,
          alumnoId: contexto.alumnoId,
          parentesco: 'Padre',
          esPrincipal: false,
        },
      })
      const docente = await prisma.docente.create({
        data: {
          personaId: mixto.personaId,
          codigoDocente: `DOC-${secuencia}`,
        },
      })
      const curso = await prisma.curso.create({
        data: { nivelId: contexto.nivelId, nombre: 'Comunicación', orden: 2 },
      })
      await prisma.asignacionDocente.create({
        data: {
          docenteId: docente.id,
          cursoId: curso.id,
          seccionId: contexto.seccionId,
          anioId: contexto.anioId,
          esTutor: true,
        },
      })

      const solicitud = await solicitarJustificacion(
        contexto.asistenciaId,
        { motivo: 'Cita médica' },
        mixto.actor,
        {},
        prisma,
      )

      await expect(
        aprobarJustificacion(solicitud.id, {}, mixto.actor, {}, prisma),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    })

    it('devuelve 404 al resolver una solicitud inexistente', async () => {
      const contexto = await crearContexto()

      await expect(
        aprobarJustificacion(
          '00000000-0000-4000-8000-000000000099',
          {},
          contexto.director.actor,
          {},
          prisma,
        ),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    })
  },
)
