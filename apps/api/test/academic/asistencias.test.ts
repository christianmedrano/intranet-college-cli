import type { RoleCode } from '@intranet/shared'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { aFechaUTC } from '../../src/modules/core/estructura/fechas.js'
import type { PrismaClient } from '../../src/generated/prisma/client.js'
import {
  corregirAsistencia,
  registrarAsistenciaLote,
} from '../../src/modules/academic/asistencias/asistencia.service.js'
import type { ActorAcademico } from '../../src/modules/academic/scope.js'
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
  'servicio de asistencias',
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
          numeroDocumento: String(67_000_000 + secuencia),
        },
      })
    }

    async function crearActor(roles: RoleCode[]): Promise<ActorAcademico> {
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

      return { id: usuario.id, roles }
    }

    interface Contexto {
      seccionId: string
      seccionBId: string
      anioId: string
      alumnoAId: string
      alumnoBId: string
      alumnoSinMatriculaId: string
    }

    /**
     * Estructura con un año de rango amplio para que las pruebas de fecha no
     * dependan del año real en que se ejecuten.
     */
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
      const seccionA = await prisma.seccion.create({
        data: { gradoId: grado.id, anioId: anio.id, nombre: 'A' },
      })
      const seccionB = await prisma.seccion.create({
        data: { gradoId: grado.id, anioId: anio.id, nombre: 'B' },
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
            seccionId: seccionA.id,
            anioId: anio.id,
            estado: 'APROBADA',
          },
        })
      }

      return {
        seccionId: seccionA.id,
        seccionBId: seccionB.id,
        anioId: anio.id,
        alumnoAId: alumnoA.id,
        alumnoBId: alumnoB.id,
        alumnoSinMatriculaId: alumnoSinMatricula.id,
      }
    }

    async function crearDocenteDeSeccion(
      contexto: Contexto,
      roles: RoleCode[] = ['DOCENTE'],
      seccionId = contexto.seccionId,
    ): Promise<ActorAcademico> {
      const actor = await crearActor(roles)
      const usuario = await prisma.usuario.findUniqueOrThrow({
        where: { id: actor.id },
        select: { personaId: true },
      })
      const curso = await prisma.curso.create({
        data: {
          nivelId: (
            await prisma.seccion.findUniqueOrThrow({
              where: { id: seccionId },
              select: { grado: { select: { nivelId: true } } },
            })
          ).grado.nivelId,
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
          seccionId,
          anioId: contexto.anioId,
        },
      })

      return actor
    }

    it('registra el lote y audita cada asistencia', async () => {
      const contexto = await crearContexto()
      const docente = await crearDocenteDeSeccion(contexto)

      const filas = await registrarAsistenciaLote(
        {
          seccionId: contexto.seccionId,
          fecha: FECHA,
          registros: [
            { alumnoId: contexto.alumnoAId, estado: 'PRESENTE' },
            {
              alumnoId: contexto.alumnoBId,
              estado: 'TARDE',
              observacion: 'Llegó 10 minutos tarde',
            },
          ],
        },
        docente,
        {},
        prisma,
      )

      expect(filas).toHaveLength(2)
      expect(filas.map((fila) => fila.fecha)).toEqual([FECHA, FECHA])

      const auditorias = await prisma.auditoria.findMany({
        where: {
          entidad: 'ASISTENCIA',
          entidadId: { in: filas.map((fila) => fila.id) },
        },
      })
      expect(auditorias).toHaveLength(2)
      expect(auditorias.every((fila) => fila.accion === 'CREAR')).toBe(true)
    })

    it('rechaza la fecha duplicada sin guardar el resto del lote', async () => {
      const contexto = await crearContexto()
      const docente = await crearDocenteDeSeccion(contexto)

      await prisma.asistencia.create({
        data: {
          alumnoId: contexto.alumnoAId,
          fecha: aFechaUTC(FECHA),
          estado: 'PRESENTE',
        },
      })

      await expect(
        registrarAsistenciaLote(
          {
            seccionId: contexto.seccionId,
            fecha: FECHA,
            registros: [
              { alumnoId: contexto.alumnoAId, estado: 'PRESENTE' },
              { alumnoId: contexto.alumnoBId, estado: 'PRESENTE' },
            ],
          },
          docente,
          {},
          prisma,
        ),
      ).rejects.toMatchObject({ code: 'CONFLICT' })

      await expect(
        prisma.asistencia.count({
          where: { alumnoId: contexto.alumnoBId },
        }),
      ).resolves.toBe(0)
    })

    it('rechaza el lote si un alumno no tiene matrícula aprobada', async () => {
      const contexto = await crearContexto()
      const docente = await crearDocenteDeSeccion(contexto)

      await expect(
        registrarAsistenciaLote(
          {
            seccionId: contexto.seccionId,
            fecha: FECHA,
            registros: [
              { alumnoId: contexto.alumnoAId, estado: 'PRESENTE' },
              { alumnoId: contexto.alumnoSinMatriculaId, estado: 'PRESENTE' },
            ],
          },
          docente,
          {},
          prisma,
        ),
      ).rejects.toMatchObject({ code: 'CONFLICT' })

      await expect(
        prisma.asistencia.count({ where: { alumnoId: contexto.alumnoAId } }),
      ).resolves.toBe(0)
    })

    it('rechaza una fecha futura', async () => {
      const contexto = await crearContexto()
      const docente = await crearDocenteDeSeccion(contexto)

      await expect(
        registrarAsistenciaLote(
          {
            seccionId: contexto.seccionId,
            fecha: fechaEnLima(1),
            registros: [
              { alumnoId: contexto.alumnoAId, estado: 'PRESENTE' },
            ],
          },
          docente,
          {},
          prisma,
        ),
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
    })

    it('rechaza una fecha fuera del rango del año', async () => {
      const contexto = await crearContexto()
      const docente = await crearDocenteDeSeccion(contexto)

      await expect(
        registrarAsistenciaLote(
          {
            seccionId: contexto.seccionId,
            fecha: '2019-12-31',
            registros: [
              { alumnoId: contexto.alumnoAId, estado: 'PRESENTE' },
            ],
          },
          docente,
          {},
          prisma,
        ),
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
    })

    it('rechaza al docente sin asignación en la sección', async () => {
      const contexto = await crearContexto()
      const docenteAjeno = await crearActor(['DOCENTE'])

      await expect(
        registrarAsistenciaLote(
          {
            seccionId: contexto.seccionId,
            fecha: FECHA,
            registros: [
              { alumnoId: contexto.alumnoAId, estado: 'PRESENTE' },
            ],
          },
          docenteAjeno,
          {},
          prisma,
        ),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    })

    it('permite al Director registrar sin asignación docente', async () => {
      const contexto = await crearContexto()
      const director = await crearActor(['DIRECTOR'])

      const filas = await registrarAsistenciaLote(
        {
          seccionId: contexto.seccionId,
          fecha: FECHA,
          registros: [{ alumnoId: contexto.alumnoAId, estado: 'PRESENTE' }],
        },
        director,
        {},
        prisma,
      )

      expect(filas).toHaveLength(1)
    })

    it('corrige con motivo y audita el valor anterior y el nuevo', async () => {
      const contexto = await crearContexto()
      const docente = await crearDocenteDeSeccion(contexto)
      const asistencia = await prisma.asistencia.create({
        data: {
          alumnoId: contexto.alumnoAId,
          fecha: aFechaUTC(FECHA),
          estado: 'FALTA_INJUSTIFICADA',
        },
      })

      const corregida = await corregirAsistencia(
        asistencia.id,
        { estado: 'FALTA_JUSTIFICADA', motivo: 'Justificación presentada' },
        docente,
        { ip: '127.0.0.1' },
        prisma,
      )

      expect(corregida.estado).toBe('FALTA_JUSTIFICADA')

      const auditoria = await prisma.auditoria.findFirstOrThrow({
        where: {
          entidad: 'ASISTENCIA',
          entidadId: asistencia.id,
          accion: 'CORREGIR',
        },
      })
      expect(auditoria.usuarioId).toBe(docente.id)
      expect(auditoria.ip).toBe('127.0.0.1')
      expect(auditoria.datos).toMatchObject({
        estado: { anterior: 'FALTA_INJUSTIFICADA', nuevo: 'FALTA_JUSTIFICADA' },
        motivoPresente: true,
      })
      expect(JSON.stringify(auditoria.datos)).not.toContain(
        'Justificación presentada',
      )
    })

    it('rechaza la corrección de un docente ajeno a la sección', async () => {
      const contexto = await crearContexto()
      const docenteAjeno = await crearActor(['DOCENTE'])
      const asistencia = await prisma.asistencia.create({
        data: {
          alumnoId: contexto.alumnoAId,
          fecha: aFechaUTC(FECHA),
          estado: 'PRESENTE',
        },
      })

      await expect(
        corregirAsistencia(
          asistencia.id,
          { estado: 'TARDE', motivo: 'Corrección' },
          docenteAjeno,
          {},
          prisma,
        ),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    })

    it('devuelve 404 al corregir una asistencia inexistente', async () => {
      const contexto = await crearContexto()
      const docente = await crearDocenteDeSeccion(contexto)

      await expect(
        corregirAsistencia(
          '00000000-0000-4000-8000-000000000099',
          { estado: 'TARDE', motivo: 'Corrección' },
          docente,
          {},
          prisma,
        ),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    })
  },
)
