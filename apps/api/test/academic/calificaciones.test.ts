import type { RoleCode } from '@intranet/shared'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { PrismaClient } from '../../src/generated/prisma/client.js'
import {
  actualizarCalificacion,
  crearCalificacion,
} from '../../src/modules/academic/calificaciones/calificacion.service.js'
import type { ActorAcademico } from '../../src/modules/academic/scope.js'
import {
  createTestPrisma,
  limpiarBaseDePruebas,
} from '../helpers/test-db.js'
import { INSTITUCION_ID } from '../constants.js'

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'servicio de calificaciones',
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
          numeroDocumento: String(62_000_000 + secuencia),
        },
      })
    }

    async function crearUsuarioConRoles(roles: RoleCode[]) {
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

      return usuario
    }

    async function crearActor(roles: RoleCode[]): Promise<ActorAcademico> {
      const usuario = await crearUsuarioConRoles(roles)

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
      const docente = await prisma.docente.create({
        data: {
          personaId: (
            await prisma.usuario.findUniqueOrThrow({
              where: { id: actor.id },
              select: { personaId: true },
            })
          ).personaId,
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

    it('registra una calificación válida y la audita con autor y fecha', async () => {
      const contexto = await crearContexto()
      const docente = await crearDocenteAsignado(contexto)

      const calificacion = await crearCalificacion(
        {
          alumnoId: contexto.alumnoId,
          cursoId: contexto.cursoId,
          periodoId: contexto.periodoId,
          valor: 'A',
        },
        docente,
        {},
        prisma,
      )

      expect(calificacion).toMatchObject({
        alumnoId: contexto.alumnoId,
        cursoId: contexto.cursoId,
        periodoId: contexto.periodoId,
        valor: 'A',
      })

      const auditoria = await prisma.auditoria.findFirstOrThrow({
        where: { entidad: 'CALIFICACION', entidadId: calificacion.id },
      })
      expect(auditoria.accion).toBe('CREAR')
      expect(auditoria.usuarioId).toBe(docente.id)
      expect(auditoria.createdAt).toBeInstanceOf(Date)
    })

    it('rechaza al docente sin asignación en el curso', async () => {
      const contexto = await crearContexto()
      const docente = await crearDocenteAsignado(contexto)
      const otroCurso = await prisma.curso.create({
        data: { nivelId: contexto.nivelId, nombre: 'Comunicación', orden: 2 },
      })

      await expect(
        crearCalificacion(
          {
            alumnoId: contexto.alumnoId,
            cursoId: otroCurso.id,
            periodoId: contexto.periodoId,
            valor: 'B',
          },
          docente,
          {},
          prisma,
        ),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    })

    it('rechaza a un alumno sin matrícula aprobada', async () => {
      const contexto = await crearContexto({ estadoMatricula: 'SOLICITADA' })
      const docente = await crearDocenteAsignado(contexto)

      await expect(
        crearCalificacion(
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

    it('bloquea el registro cuando el período está cerrado', async () => {
      const contexto = await crearContexto({ estadoPeriodo: 'CERRADO' })
      const docente = await crearDocenteAsignado(contexto)

      await expect(
        crearCalificacion(
          {
            alumnoId: contexto.alumnoId,
            cursoId: contexto.cursoId,
            periodoId: contexto.periodoId,
            valor: 'C',
          },
          docente,
          {},
          prisma,
        ),
      ).rejects.toMatchObject({ code: 'CONFLICT' })
    })

    it('rechaza una segunda calificación del mismo alumno, curso y período', async () => {
      const contexto = await crearContexto()
      const docente = await crearDocenteAsignado(contexto)
      const datos = {
        alumnoId: contexto.alumnoId,
        cursoId: contexto.cursoId,
        periodoId: contexto.periodoId,
      }

      await crearCalificacion(
        { ...datos, valor: 'A' },
        docente,
        {},
        prisma,
      )

      await expect(
        crearCalificacion({ ...datos, valor: 'B' }, docente, {}, prisma),
      ).rejects.toMatchObject({ code: 'CONFLICT' })
    })

    it('permite editar al docente mientras el período está abierto', async () => {
      const contexto = await crearContexto()
      const docente = await crearDocenteAsignado(contexto)
      const creada = await crearCalificacion(
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

      const actualizada = await actualizarCalificacion(
        creada.id,
        { valor: 'A', observacion: 'Mejora sostenida' },
        docente,
        {},
        prisma,
      )

      expect(actualizada.valor).toBe('A')
      expect(actualizada.observacion).toBe('Mejora sostenida')

      const auditoria = await prisma.auditoria.findFirstOrThrow({
        where: {
          entidad: 'CALIFICACION',
          entidadId: creada.id,
          accion: 'CORREGIR',
        },
      })
      expect(auditoria.datos).toMatchObject({
        valor: { anterior: 'B', nuevo: 'A' },
      })
    })

    it('impide al Director editar antes del cierre', async () => {
      const contexto = await crearContexto()
      const docente = await crearDocenteAsignado(contexto)
      const director = await crearActor(['DIRECTOR'])
      const creada = await crearCalificacion(
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
        actualizarCalificacion(
          creada.id,
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
      const creada = await prisma.calificacion.create({
        data: {
          alumnoId: contexto.alumnoId,
          cursoId: contexto.cursoId,
          periodoId: contexto.periodoId,
          valor: 'B',
        },
      })

      await expect(
        actualizarCalificacion(creada.id, { valor: 'A' }, director, {}, prisma),
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
    })

    it('permite al Director corregir tras el cierre sin guardar el motivo', async () => {
      const contexto = await crearContexto({ estadoPeriodo: 'CERRADO' })
      const director = await crearActor(['DIRECTOR'])
      const creada = await prisma.calificacion.create({
        data: {
          alumnoId: contexto.alumnoId,
          cursoId: contexto.cursoId,
          periodoId: contexto.periodoId,
          valor: 'B',
        },
      })

      const corregida = await actualizarCalificacion(
        creada.id,
        { valor: 'AD', motivo: 'Revisión del acta' },
        director,
        { ip: '127.0.0.1' },
        prisma,
      )

      expect(corregida.valor).toBe('AD')

      const auditoria = await prisma.auditoria.findFirstOrThrow({
        where: {
          entidad: 'CALIFICACION',
          entidadId: creada.id,
          accion: 'CORREGIR',
        },
      })
      expect(auditoria.usuarioId).toBe(director.id)
      expect(auditoria.ip).toBe('127.0.0.1')
      expect(auditoria.createdAt).toBeInstanceOf(Date)
      expect(auditoria.datos).toMatchObject({
        valor: { anterior: 'B', nuevo: 'AD' },
        motivoPresente: true,
      })
      expect(JSON.stringify(auditoria.datos)).not.toContain('Revisión del acta')
    })

    it('impide al docente corregir un período cerrado', async () => {
      const contexto = await crearContexto({ estadoPeriodo: 'CERRADO' })
      const docente = await crearDocenteAsignado(contexto)
      const creada = await prisma.calificacion.create({
        data: {
          alumnoId: contexto.alumnoId,
          cursoId: contexto.cursoId,
          periodoId: contexto.periodoId,
          valor: 'B',
        },
      })

      await expect(
        actualizarCalificacion(
          creada.id,
          { valor: 'A', motivo: 'Intento' },
          docente,
          {},
          prisma,
        ),
      ).rejects.toMatchObject({ code: 'CONFLICT' })
    })

    it('impide al docente editar una calificación de otra sección', async () => {
      const contexto = await crearContexto()
      const docente = await crearDocenteAsignado(contexto)
      const otroDocente = await crearActor(['DOCENTE'])
      const creada = await crearCalificacion(
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
        actualizarCalificacion(
          creada.id,
          { valor: 'A' },
          otroDocente,
          {},
          prisma,
        ),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    })

    it('devuelve 404 cuando la calificación no existe', async () => {
      const contexto = await crearContexto()
      const docente = await crearDocenteAsignado(contexto)

      await expect(
        actualizarCalificacion(
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
