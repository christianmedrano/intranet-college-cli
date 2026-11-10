import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { PrismaClient } from '../../src/generated/prisma/client.js'
import {
  createTestPrisma,
  limpiarBaseDePruebas,
} from '../helpers/test-db.js'

// Sin TEST_DATABASE_URL la suite se omite en lugar de fallar: las pruebas de
// integración necesitan la base aislada que documenta el README.
describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'integridad del modelo académico',
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

    /** Crea una persona con documento único para evitar choques entre casos. */
    async function crearPersona() {
      secuencia += 1

      return prisma.persona.create({
        data: {
          nombres: 'Ana',
          apellidos: 'Pérez',
          tipoDocumento: 'DNI',
          numeroDocumento: String(10_000_000 + secuencia),
        },
      })
    }

    async function crearAlumno() {
      const persona = await crearPersona()
      secuencia += 1

      return prisma.alumno.create({
        data: { personaId: persona.id, codigoAlumno: `AL-${secuencia}` },
      })
    }

    async function crearUsuario() {
      const persona = await crearPersona()
      secuencia += 1

      return prisma.usuario.create({
        data: {
          personaId: persona.id,
          username: `usuario${secuencia}`,
          passwordHash: '$argon2id$hash-de-prueba',
          debeCambiarPassword: false,
        },
      })
    }

    /** Estructura mínima: institución, año, nivel, grado, sección, curso y período. */
    async function crearEstructura() {
      const institucion = await prisma.institucion.create({
        data: { nombre: 'IE de Pruebas' },
      })
      const anio = await prisma.anioAcademico.create({
        data: {
          institucionId: institucion.id,
          nombre: '2026',
          fechaInicio: new Date('2026-03-01'),
          fechaFin: new Date('2026-12-15'),
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
          fechaInicio: new Date('2026-03-01'),
          fechaFin: new Date('2026-05-31'),
        },
      })

      return { institucion, anio, nivel, grado, seccion, curso, periodo }
    }

    describe('restricciones únicas', () => {
      it('rechaza dos calificaciones del mismo alumno, curso y período', async () => {
        const { curso, periodo } = await crearEstructura()
        const alumno = await crearAlumno()
        const clave = {
          alumnoId: alumno.id,
          cursoId: curso.id,
          periodoId: periodo.id,
        }

        await prisma.calificacion.create({ data: { ...clave, valor: 'A' } })

        await expect(
          prisma.calificacion.create({ data: { ...clave, valor: 'B' } }),
        ).rejects.toMatchObject({ code: 'P2002' })
      })

      it('rechaza dos notas finales del mismo alumno, curso y período', async () => {
        const { curso, periodo } = await crearEstructura()
        const alumno = await crearAlumno()
        const clave = {
          alumnoId: alumno.id,
          cursoId: curso.id,
          periodoId: periodo.id,
        }

        await prisma.notaFinalPeriodo.create({
          data: { ...clave, valor: 'AD' },
        })

        await expect(
          prisma.notaFinalPeriodo.create({ data: { ...clave, valor: 'C' } }),
        ).rejects.toMatchObject({ code: 'P2002' })
      })

      it('rechaza dos asistencias del mismo alumno en la misma fecha', async () => {
        const alumno = await crearAlumno()
        const fecha = new Date('2026-05-12')

        await prisma.asistencia.create({
          data: { alumnoId: alumno.id, fecha, estado: 'PRESENTE' },
        })

        await expect(
          prisma.asistencia.create({
            data: { alumnoId: alumno.id, fecha, estado: 'TARDE' },
          }),
        ).rejects.toMatchObject({ code: 'P2002' })
      })

      it('rechaza dos umbrales para el mismo año', async () => {
        const { anio } = await crearEstructura()

        await prisma.umbralAsistencia.create({
          data: { anioId: anio.id, faltasParaAlerta: 3 },
        })

        await expect(
          prisma.umbralAsistencia.create({
            data: { anioId: anio.id, faltasParaAlerta: 5 },
          }),
        ).rejects.toMatchObject({ code: 'P2002' })
      })

      it('rechaza dos alertas del mismo alumno en el mismo año', async () => {
        const { anio } = await crearEstructura()
        const alumno = await crearAlumno()
        const clave = { alumnoId: alumno.id, anioId: anio.id }
        const datos = {
          ...clave,
          faltasInjustificadas: 3,
          umbral: 3,
        }

        await prisma.alertaAsistencia.create({ data: datos })

        await expect(
          prisma.alertaAsistencia.create({
            data: { ...datos, faltasInjustificadas: 4 },
          }),
        ).rejects.toMatchObject({ code: 'P2002' })
      })

      it('rechaza dos bloques de horario con la misma sección, día y hora de inicio', async () => {
        const { anio, seccion, curso } = await crearEstructura()
        const clave = {
          anioId: anio.id,
          seccionId: seccion.id,
          cursoId: curso.id,
          diaSemana: 1,
          horaInicio: '08:00',
        }

        await prisma.horario.create({
          data: { ...clave, horaFin: '09:30' },
        })

        await expect(
          prisma.horario.create({ data: { ...clave, horaFin: '10:00' } }),
        ).rejects.toMatchObject({ code: 'P2002' })
      })
    })

    describe('restricciones CHECK', () => {
      it('solo admite la escala literal AD, A, B, C en calificaciones y notas finales', async () => {
        const { curso, periodo } = await crearEstructura()
        const alumno = await crearAlumno()
        const clave = {
          alumnoId: alumno.id,
          cursoId: curso.id,
          periodoId: periodo.id,
        }

        await expect(
          prisma.calificacion.create({ data: { ...clave, valor: 'D' } }),
        ).rejects.toThrow()

        await expect(
          prisma.notaFinalPeriodo.create({ data: { ...clave, valor: '20' } }),
        ).rejects.toThrow()
      })

      it('solo admite los estados de asistencia definidos', async () => {
        const alumno = await crearAlumno()

        await expect(
          prisma.asistencia.create({
            data: {
              alumnoId: alumno.id,
              fecha: new Date('2026-05-12'),
              estado: 'AUSENTE',
            },
          }),
        ).rejects.toThrow()
      })

      it('solo admite los estados de justificación definidos', async () => {
        const alumno = await crearAlumno()
        const usuario = await crearUsuario()
        const asistencia = await prisma.asistencia.create({
          data: {
            alumnoId: alumno.id,
            fecha: new Date('2026-05-12'),
            estado: 'FALTA_INJUSTIFICADA',
          },
        })

        await expect(
          prisma.justificacionFalta.create({
            data: {
              asistenciaId: asistencia.id,
              solicitanteUsuarioId: usuario.id,
              motivo: 'Cita médica',
              estado: 'PENDIENTE',
            },
          }),
        ).rejects.toThrow()
      })

      it('exige un umbral entero positivo', async () => {
        const { anio } = await crearEstructura()

        await expect(
          prisma.umbralAsistencia.create({
            data: { anioId: anio.id, faltasParaAlerta: 0 },
          }),
        ).rejects.toThrow()
      })

      it('exige umbral positivo y faltas no negativas en la alerta', async () => {
        const { anio } = await crearEstructura()
        const alumno = await crearAlumno()

        await expect(
          prisma.alertaAsistencia.create({
            data: { alumnoId: alumno.id, anioId: anio.id, faltasInjustificadas: 3, umbral: 0 },
          }),
        ).rejects.toThrow()
      })

      it('valida el día de la semana entre 1 y 7', async () => {
        const { anio, seccion, curso } = await crearEstructura()
        const base = {
          anioId: anio.id,
          seccionId: seccion.id,
          cursoId: curso.id,
          horaInicio: '08:00',
          horaFin: '09:30',
        }

        await expect(
          prisma.horario.create({ data: { ...base, diaSemana: 0 } }),
        ).rejects.toThrow()

        await expect(
          prisma.horario.create({ data: { ...base, diaSemana: 8 } }),
        ).rejects.toThrow()
      })

      it('valida el formato HH:MM y el orden de las horas', async () => {
        const { anio, seccion, curso } = await crearEstructura()
        const base = {
          anioId: anio.id,
          seccionId: seccion.id,
          cursoId: curso.id,
          diaSemana: 1,
        }

        await expect(
          prisma.horario.create({
            data: { ...base, horaInicio: '8:00', horaFin: '09:30' },
          }),
        ).rejects.toThrow()

        await expect(
          prisma.horario.create({
            data: { ...base, horaInicio: '08:00', horaFin: '24:00' },
          }),
        ).rejects.toThrow()

        await expect(
          prisma.horario.create({
            data: { ...base, horaInicio: '10:00', horaFin: '09:00' },
          }),
        ).rejects.toThrow()
      })
    })
  },
)
