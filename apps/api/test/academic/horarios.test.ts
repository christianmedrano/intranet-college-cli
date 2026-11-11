import type { RoleCode } from '@intranet/shared'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { PrismaClient } from '../../src/generated/prisma/client.js'
import {
  actualizarHorario,
  crearHorario,
  eliminarHorario,
} from '../../src/modules/academic/horarios/horario.service.js'
import type { ActorAcademico } from '../../src/modules/academic/scope.js'
import {
  createTestPrisma,
  limpiarBaseDePruebas,
} from '../helpers/test-db.js'

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'servicio de horarios',
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
          numeroDocumento: String(74_000_000 + secuencia),
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
      anioId: string
      seccionAId: string
      seccionBId: string
      cursoPrimariaId: string
      cursoSecundariaId: string
      docenteAsignadoId: string
      docenteSinAsignacionId: string
      director: ActorAcademico
      docente: ActorAcademico
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
      const cursoPrimaria = await prisma.curso.create({
        data: { nivelId: primaria.id, nombre: 'Matemática', orden: 1 },
      })
      const cursoSecundaria = await prisma.curso.create({
        data: { nivelId: secundaria.id, nombre: 'Física', orden: 1 },
      })

      const actorDocente = await crearActor(['DOCENTE'])
      const personaDocente = await prisma.usuario.findUniqueOrThrow({
        where: { id: actorDocente.id },
        select: { personaId: true },
      })
      const docente = await prisma.docente.create({
        data: {
          personaId: personaDocente.personaId,
          codigoDocente: `DOC-${secuencia}`,
        },
      })
      await prisma.asignacionDocente.create({
        data: {
          docenteId: docente.id,
          cursoId: cursoPrimaria.id,
          seccionId: seccionA.id,
          anioId: anio.id,
        },
      })
      await prisma.asignacionDocente.create({
        data: {
          docenteId: docente.id,
          cursoId: cursoPrimaria.id,
          seccionId: seccionB.id,
          anioId: anio.id,
        },
      })

      const otroDocente = await prisma.docente.create({
        data: {
          personaId: (await crearPersona()).id,
          codigoDocente: `DOC-${secuencia + 1}`,
        },
      })

      return {
        anioId: anio.id,
        seccionAId: seccionA.id,
        seccionBId: seccionB.id,
        cursoPrimariaId: cursoPrimaria.id,
        cursoSecundariaId: cursoSecundaria.id,
        docenteAsignadoId: docente.id,
        docenteSinAsignacionId: otroDocente.id,
        director: await crearActor(['DIRECTOR']),
        docente: actorDocente,
      }
    }

    function bloqueValido(contexto: Contexto) {
      return {
        anioId: contexto.anioId,
        seccionId: contexto.seccionAId,
        cursoId: contexto.cursoPrimariaId,
        docenteId: contexto.docenteAsignadoId,
        diaSemana: 1 as const,
        horaInicio: '09:00',
        horaFin: '10:00',
      }
    }

    it('crea un bloque válido y lo audita', async () => {
      const contexto = await crearContexto()

      const horario = await crearHorario(
        bloqueValido(contexto),
        contexto.director,
        {},
        prisma,
      )

      expect(horario).toMatchObject({
        anioId: contexto.anioId,
        seccionId: contexto.seccionAId,
        cursoId: contexto.cursoPrimariaId,
        docenteId: contexto.docenteAsignadoId,
        diaSemana: 1,
        horaInicio: '09:00',
        horaFin: '10:00',
      })

      const auditoria = await prisma.auditoria.findFirstOrThrow({
        where: { entidad: 'HORARIO', entidadId: horario.id, accion: 'CREAR' },
      })
      expect(auditoria.usuarioId).toBe(contexto.director.id)
    })

    it('crea un bloque sin docente', async () => {
      const contexto = await crearContexto()
      const sinDocente = {
        anioId: contexto.anioId,
        seccionId: contexto.seccionAId,
        cursoId: contexto.cursoPrimariaId,
        diaSemana: 1 as const,
        horaInicio: '09:00',
        horaFin: '10:00',
      }

      const horario = await crearHorario(
        sinDocente,
        contexto.director,
        {},
        prisma,
      )

      expect(horario.docenteId).toBeNull()
    })

    it('rechaza un solapamiento en la misma sección', async () => {
      const contexto = await crearContexto()
      await crearHorario(bloqueValido(contexto), contexto.director, {}, prisma)

      await expect(
        crearHorario(
          {
            ...bloqueValido(contexto),
            docenteId: undefined,
            horaInicio: '09:30',
            horaFin: '10:30',
          },
          contexto.director,
          {},
          prisma,
        ),
      ).rejects.toMatchObject({ code: 'CONFLICT' })
    })

    it('permite bloques contiguos que no se solapan', async () => {
      const contexto = await crearContexto()
      await crearHorario(bloqueValido(contexto), contexto.director, {}, prisma)

      const siguiente = await crearHorario(
        {
          ...bloqueValido(contexto),
          docenteId: undefined,
          horaInicio: '10:00',
          horaFin: '11:00',
        },
        contexto.director,
        {},
        prisma,
      )

      expect(siguiente.horaInicio).toBe('10:00')
    })

    it('rechaza el solapamiento del docente en otra sección', async () => {
      const contexto = await crearContexto()
      await crearHorario(bloqueValido(contexto), contexto.director, {}, prisma)

      await expect(
        crearHorario(
          {
            ...bloqueValido(contexto),
            seccionId: contexto.seccionBId,
            horaInicio: '09:30',
            horaFin: '10:30',
          },
          contexto.director,
          {},
          prisma,
        ),
      ).rejects.toMatchObject({ code: 'CONFLICT' })
    })

    it('rechaza un curso de otro nivel', async () => {
      const contexto = await crearContexto()

      await expect(
        crearHorario(
          {
            ...bloqueValido(contexto),
            cursoId: contexto.cursoSecundariaId,
            docenteId: undefined,
          },
          contexto.director,
          {},
          prisma,
        ),
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
    })

    it('rechaza un docente sin asignación vigente', async () => {
      const contexto = await crearContexto()

      await expect(
        crearHorario(
          {
            ...bloqueValido(contexto),
            docenteId: contexto.docenteSinAsignacionId,
          },
          contexto.director,
          {},
          prisma,
        ),
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
    })

    it('rechaza horas invertidas al actualizar una sola hora', async () => {
      const contexto = await crearContexto()
      const horario = await crearHorario(
        bloqueValido(contexto),
        contexto.director,
        {},
        prisma,
      )

      await expect(
        actualizarHorario(
          horario.id,
          { horaInicio: '11:00' },
          contexto.director,
          {},
          prisma,
        ),
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
    })

    it('actualiza un bloque y audita los campos cambiados', async () => {
      const contexto = await crearContexto()
      const horario = await crearHorario(
        bloqueValido(contexto),
        contexto.director,
        {},
        prisma,
      )

      const actualizado = await actualizarHorario(
        horario.id,
        { diaSemana: 2, horaInicio: '08:00', horaFin: '09:00' },
        contexto.director,
        {},
        prisma,
      )

      expect(actualizado).toMatchObject({
        diaSemana: 2,
        horaInicio: '08:00',
        horaFin: '09:00',
      })

      const auditoria = await prisma.auditoria.findFirstOrThrow({
        where: {
          entidad: 'HORARIO',
          entidadId: horario.id,
          accion: 'ACTUALIZAR',
        },
      })
      expect(auditoria.datos).toMatchObject({
        diaSemana: { anterior: 1, nuevo: 2 },
        horaInicio: { anterior: '09:00', nuevo: '08:00' },
        horaFin: { anterior: '10:00', nuevo: '09:00' },
      })
    })

    it('rechaza un solapamiento al actualizar', async () => {
      const contexto = await crearContexto()
      await crearHorario(bloqueValido(contexto), contexto.director, {}, prisma)
      const segundo = await crearHorario(
        {
          ...bloqueValido(contexto),
          docenteId: undefined,
          horaInicio: '10:00',
          horaFin: '11:00',
        },
        contexto.director,
        {},
        prisma,
      )

      await expect(
        actualizarHorario(
          segundo.id,
          { horaInicio: '09:30' },
          contexto.director,
          {},
          prisma,
        ),
      ).rejects.toMatchObject({ code: 'CONFLICT' })
    })

    it('elimina lógicamente y conserva la fila auditada', async () => {
      const contexto = await crearContexto()
      const horario = await crearHorario(
        bloqueValido(contexto),
        contexto.director,
        {},
        prisma,
      )

      await eliminarHorario(horario.id, contexto.director, {}, prisma)

      const fila = await prisma.horario.findUniqueOrThrow({
        where: { id: horario.id },
      })
      expect(fila.deletedAt).not.toBeNull()

      const auditoria = await prisma.auditoria.findFirstOrThrow({
        where: {
          entidad: 'HORARIO',
          entidadId: horario.id,
          accion: 'RETIRAR',
        },
      })
      expect(auditoria.usuarioId).toBe(contexto.director.id)

      await expect(
        eliminarHorario(horario.id, contexto.director, {}, prisma),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    })

    it('el docente no puede gestionar horarios', async () => {
      const contexto = await crearContexto()

      await expect(
        crearHorario(bloqueValido(contexto), contexto.docente, {}, prisma),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    })

    it('serializa dos altas concurrentes del mismo bloque', async () => {
      const contexto = await crearContexto()

      const resultados = await Promise.allSettled([
        crearHorario(
          { ...bloqueValido(contexto), horaInicio: '09:00', horaFin: '10:00' },
          contexto.director,
          {},
          prisma,
        ),
        crearHorario(
          { ...bloqueValido(contexto), horaInicio: '09:30', horaFin: '10:30' },
          contexto.director,
          {},
          prisma,
        ),
      ])

      const exitosos = resultados.filter(
        (resultado) => resultado.status === 'fulfilled',
      )
      const fallidos = resultados.filter(
        (resultado) => resultado.status === 'rejected',
      )

      expect(exitosos).toHaveLength(1)
      expect(fallidos).toHaveLength(1)
      expect(fallidos[0]).toMatchObject({
        reason: { code: 'CONFLICT' },
      })

      expect(
        await prisma.horario.count({
          where: { seccionId: contexto.seccionAId, deletedAt: null },
        }),
      ).toBe(1)
    })
  },
)
