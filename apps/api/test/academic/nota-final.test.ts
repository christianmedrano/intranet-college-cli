import type { RoleCode } from '@intranet/shared'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { PrismaClient } from '../../src/generated/prisma/client.js'
import {
  actualizarNotaFinal,
  crearNotaFinal,
} from '../../src/modules/academic/calificaciones/nota-final.service.js'
import type { ActorAcademico } from '../../src/modules/academic/scope.js'
import {
  createTestPrisma,
  limpiarBaseDePruebas,
} from '../helpers/test-db.js'
import { INSTITUCION_ID } from '../constants.js'

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'servicio de nota final',
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
          numeroDocumento: String(63_000_000 + secuencia),
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

      return { id: usuario.id, roles, institucionId: INSTITUCION_ID }
    }

    interface Contexto {
      institucionId: string
      anioId: string
      periodoId: string
      nivelId: string
      seccionId: string
      cursoId: string
      alumnoId: string
    }

    async function crearContexto(opciones: {
      estadoPeriodo?: string
      estadoMatricula?: string
    } = {}): Promise<Contexto> {
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
          estado: opciones.estadoPeriodo ?? 'ACTIVO',
        },
      })
      const persona = await crearPersona()
      const alumno = await prisma.alumno.create({
        data: {
          personaId: persona.id,
          codigoAlumno: `AL-${secuencia}`,
        },
      })

      await prisma.matricula.create({
        data: {
          alumnoId: alumno.id,
          seccionId: seccion.id,
          anioId: anio.id,
          estado: opciones.estadoMatricula ?? 'APROBADA',
        },
      })

      return {
        institucionId: INSTITUCION_ID,
        anioId: anio.id,
        periodoId: periodo.id,
        nivelId: nivel.id,
        seccionId: seccion.id,
        cursoId: curso.id,
        alumnoId: alumno.id,
      }
    }

    async function crearDocenteAsignado(
      contexto: Contexto,
      roles: RoleCode[] = ['DOCENTE'],
    ): Promise<ActorAcademico> {
      const actor = await crearActor(roles)
      const usuario = await prisma.usuario.findUniqueOrThrow({
        where: { id: actor.id },
        select: { personaId: true },
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
          cursoId: contexto.cursoId,
          seccionId: contexto.seccionId,
          anioId: contexto.anioId,
        },
      })

      return actor
    }

    it('guarda exactamente el valor enviado sin calificaciones parciales', async () => {
      const contexto = await crearContexto()
      const docente = await crearDocenteAsignado(contexto)

      const nota = await crearNotaFinal(
        {
          alumnoId: contexto.alumnoId,
          cursoId: contexto.cursoId,
          periodoId: contexto.periodoId,
          valor: 'B',
        },
        docente,
        {},
        prisma,
      )

      expect(nota.valor).toBe('B')
      await expect(
        prisma.calificacion.count({
          where: {
            alumnoId: contexto.alumnoId,
            cursoId: contexto.cursoId,
            periodoId: contexto.periodoId,
          },
        }),
      ).resolves.toBe(0)
    })

    it('no deriva la nota de las calificaciones parciales', async () => {
      const contexto = await crearContexto()
      const docente = await crearDocenteAsignado(contexto)
      const segundo = await prisma.periodoAcademico.create({
        data: {
          anioId: contexto.anioId,
          nombre: 'Bimestre 2',
          orden: 2,
          fechaInicio: new Date('2026-06-01'),
          fechaFin: new Date('2026-08-31'),
        },
      })
      const tercero = await prisma.periodoAcademico.create({
        data: {
          anioId: contexto.anioId,
          nombre: 'Bimestre 3',
          orden: 3,
          fechaInicio: new Date('2026-09-01'),
          fechaFin: new Date('2026-12-15'),
        },
      })
      const parciales = [
        { periodoId: contexto.periodoId, valor: 'AD' },
        { periodoId: segundo.id, valor: 'A' },
        { periodoId: tercero.id, valor: 'B' },
      ]

      for (const parcial of parciales) {
        await prisma.calificacion.create({
          data: {
            alumnoId: contexto.alumnoId,
            cursoId: contexto.cursoId,
            valor: parcial.valor,
            periodoId: parcial.periodoId,
          },
        })
      }

      const nota = await crearNotaFinal(
        {
          alumnoId: contexto.alumnoId,
          cursoId: contexto.cursoId,
          periodoId: contexto.periodoId,
          valor: 'C',
        },
        docente,
        {},
        prisma,
      )

      expect(nota.valor).toBe('C')
    })

    it('rechaza una segunda nota final para el mismo alumno, curso y período', async () => {
      const contexto = await crearContexto()
      const docente = await crearDocenteAsignado(contexto)
      const datos = {
        alumnoId: contexto.alumnoId,
        cursoId: contexto.cursoId,
        periodoId: contexto.periodoId,
      }

      await crearNotaFinal({ ...datos, valor: 'A' }, docente, {}, prisma)

      await expect(
        crearNotaFinal({ ...datos, valor: 'B' }, docente, {}, prisma),
      ).rejects.toMatchObject({ code: 'CONFLICT' })
    })

    it('rechaza a un alumno sin matrícula aprobada', async () => {
      const contexto = await crearContexto({ estadoMatricula: 'RETIRADA' })
      const docente = await crearDocenteAsignado(contexto)

      await expect(
        crearNotaFinal(
          {
            alumnoId: contexto.alumnoId,
            cursoId: contexto.cursoId,
            periodoId: contexto.periodoId,
            valor: 'A',
          },
          docente,
          {},
          prisma,
        ),
      ).rejects.toMatchObject({ code: 'CONFLICT' })
    })

    it('bloquea al docente cuando el período está cerrado', async () => {
      const contexto = await crearContexto({ estadoPeriodo: 'CERRADO' })
      const docente = await crearDocenteAsignado(contexto)

      await expect(
        crearNotaFinal(
          {
            alumnoId: contexto.alumnoId,
            cursoId: contexto.cursoId,
            periodoId: contexto.periodoId,
            valor: 'AD',
          },
          docente,
          {},
          prisma,
        ),
      ).rejects.toMatchObject({ code: 'CONFLICT' })
    })

    it('impide al Director modificar antes del cierre', async () => {
      const contexto = await crearContexto()
      const docente = await crearDocenteAsignado(contexto)
      const director = await crearActor(['DIRECTOR'])
      const nota = await crearNotaFinal(
        {
          alumnoId: contexto.alumnoId,
          cursoId: contexto.cursoId,
          periodoId: contexto.periodoId,
          valor: 'B',
        },
        docente,
        {},
        prisma,
      )

      await expect(
        actualizarNotaFinal(
          nota.id,
          { valor: 'A', motivo: 'Ajuste' },
          director,
          {},
          prisma,
        ),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    })

    it('exige motivo al Director para corregir tras el cierre', async () => {
      const contexto = await crearContexto({ estadoPeriodo: 'CERRADO' })
      const director = await crearActor(['DIRECTOR'])
      const nota = await prisma.notaFinalPeriodo.create({
        data: {
          alumnoId: contexto.alumnoId,
          cursoId: contexto.cursoId,
          periodoId: contexto.periodoId,
          valor: 'B',
        },
      })

      await expect(
        actualizarNotaFinal(nota.id, { valor: 'A' }, director, {}, prisma),
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
    })

    it('permite al Director corregir tras el cierre y audita el motivo', async () => {
      const contexto = await crearContexto({ estadoPeriodo: 'CERRADO' })
      const director = await crearActor(['DIRECTOR'])
      const nota = await prisma.notaFinalPeriodo.create({
        data: {
          alumnoId: contexto.alumnoId,
          cursoId: contexto.cursoId,
          periodoId: contexto.periodoId,
          valor: 'B',
        },
      })

      const corregida = await actualizarNotaFinal(
        nota.id,
        { valor: 'AD', motivo: 'Revisión del acta' },
        director,
        {},
        prisma,
      )

      expect(corregida.valor).toBe('AD')

      const auditoria = await prisma.auditoria.findFirstOrThrow({
        where: {
          entidad: 'NOTA_FINAL_PERIODO',
          entidadId: nota.id,
          accion: 'CORREGIR',
        },
      })
      expect(auditoria.usuarioId).toBe(director.id)
      expect(auditoria.createdAt).toBeInstanceOf(Date)
      expect(auditoria.datos).toMatchObject({
        valor: { anterior: 'B', nuevo: 'AD' },
        motivoPresente: true,
      })
      expect(JSON.stringify(auditoria.datos)).not.toContain('Revisión del acta')
    })

    it('devuelve 404 cuando la nota final no existe', async () => {
      const contexto = await crearContexto()
      const docente = await crearDocenteAsignado(contexto)

      await expect(
        actualizarNotaFinal(
          '00000000-0000-4000-8000-000000000099',
          { valor: 'A' },
          docente,
          {},
          prisma,
        ),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    })
  },
)
