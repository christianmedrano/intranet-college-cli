import {
  umbralAsistenciaSchema,
  type RoleCode,
} from '@intranet/shared'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { PrismaClient } from '../../src/generated/prisma/client.js'
import {
  corregirAsistencia,
  registrarAsistenciaLote,
} from '../../src/modules/academic/asistencias/asistencia.service.js'
import {
  aprobarJustificacion,
  solicitarJustificacion,
} from '../../src/modules/academic/justificaciones/justificacion.service.js'
import type { ActorAcademico } from '../../src/modules/academic/scope.js'
import {
  guardarUmbral,
  obtenerUmbral,
} from '../../src/modules/academic/umbral/umbral.service.js'
import {
  createTestPrisma,
  limpiarBaseDePruebas,
} from '../helpers/test-db.js'
import { INSTITUCION_ID } from '../constants.js'

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'umbral y alertas de asistencias',
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
          numeroDocumento: String(72_000_000 + secuencia),
        },
      })
    }

    interface ActorCompleto {
      actor: ActorAcademico
      personaId: string
      usuarioId: string
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

      return { actor: { id: usuario.id, roles, institucionId: INSTITUCION_ID }, personaId: persona.id, usuarioId: usuario.id }
    }

    interface Contexto {
      anioId: string
      seccionId: string
      alumnoId: string
      cursoId: string
      docente: ActorCompleto
      director: ActorCompleto
      apoderado: ActorCompleto
    }

    async function crearContexto(): Promise<Contexto> {
      const anio = await prisma.anioAcademico.create({
        data: {
          institucionId: INSTITUCION_ID,
          nombre: '2024',
          fechaInicio: new Date('2024-03-01'),
          fechaFin: new Date('2024-12-15'),
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

      const docente = await crearActorCompleto(['DOCENTE'])
      const registroDocente = await prisma.docente.create({
        data: {
          personaId: docente.personaId,
          codigoDocente: `DOC-${secuencia}`,
        },
      })
      await prisma.asignacionDocente.create({
        data: {
          docenteId: registroDocente.id,
          cursoId: curso.id,
          seccionId: seccion.id,
          anioId: anio.id,
          esTutor: true,
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

      return {
        anioId: anio.id,
        seccionId: seccion.id,
        alumnoId: alumno.id,
        cursoId: curso.id,
        docente,
        director: await crearActorCompleto(['DIRECTOR']),
        apoderado,
      }
    }

    /** Registra una falta injustificada en la fecha indicada. */
    async function registrarFalta(
      contexto: Contexto,
      fecha: string,
      estado: 'FALTA_INJUSTIFICADA' | 'PRESENTE' = 'FALTA_INJUSTIFICADA',
    ) {
      const [fila] = await registrarAsistenciaLote(
        {
          seccionId: contexto.seccionId,
          fecha,
          registros: [{ alumnoId: contexto.alumnoId, estado }],
        },
        contexto.docente.actor,
        {},
        prisma,
      )

      return fila
    }

    async function alertasDe(contexto: Contexto) {
      return prisma.alertaAsistencia.findMany({
        where: { alumnoId: contexto.alumnoId, anioId: contexto.anioId },
      })
    }

    it('sin umbral no se genera ninguna alerta', async () => {
      const contexto = await crearContexto()

      await registrarFalta(contexto, '2024-05-01')
      await registrarFalta(contexto, '2024-05-02')

      expect(await alertasDe(contexto)).toHaveLength(0)
    })

    it('genera la alerta cuando las faltas alcanzan el umbral', async () => {
      const contexto = await crearContexto()
      await guardarUmbral(
        contexto.anioId,
        { faltasParaAlerta: 3 },
        contexto.director.actor,
        {},
        prisma,
      )

      await registrarFalta(contexto, '2024-05-01')
      await registrarFalta(contexto, '2024-05-02')
      expect(await alertasDe(contexto)).toHaveLength(0)

      await registrarFalta(contexto, '2024-05-03')

      const alertas = await alertasDe(contexto)
      expect(alertas).toHaveLength(1)
      expect(alertas[0]).toMatchObject({
        alumnoId: contexto.alumnoId,
        anioId: contexto.anioId,
        faltasInjustificadas: 3,
        umbral: 3,
      })
    })

    it('mantiene una sola alerta por alumno y año al sumar faltas', async () => {
      const contexto = await crearContexto()
      await guardarUmbral(
        contexto.anioId,
        { faltasParaAlerta: 2 },
        contexto.director.actor,
        {},
        prisma,
      )

      await registrarFalta(contexto, '2024-05-01')
      await registrarFalta(contexto, '2024-05-02')
      await registrarFalta(contexto, '2024-05-03')

      const alertas = await alertasDe(contexto)
      expect(alertas).toHaveLength(1)
      expect(alertas[0]?.faltasInjustificadas).toBe(3)
    })

    it('elimina la alerta cuando el umbral sube por encima de las faltas', async () => {
      const contexto = await crearContexto()
      await guardarUmbral(
        contexto.anioId,
        { faltasParaAlerta: 2 },
        contexto.director.actor,
        {},
        prisma,
      )

      await registrarFalta(contexto, '2024-05-01')
      await registrarFalta(contexto, '2024-05-02')
      expect(await alertasDe(contexto)).toHaveLength(1)

      await guardarUmbral(
        contexto.anioId,
        { faltasParaAlerta: 4 },
        contexto.director.actor,
        {},
        prisma,
      )

      expect(await alertasDe(contexto)).toHaveLength(0)
    })

    it('genera las alertas pendientes al bajar el umbral', async () => {
      const contexto = await crearContexto()
      await guardarUmbral(
        contexto.anioId,
        { faltasParaAlerta: 3 },
        contexto.director.actor,
        {},
        prisma,
      )

      await registrarFalta(contexto, '2024-05-01')
      await registrarFalta(contexto, '2024-05-02')
      expect(await alertasDe(contexto)).toHaveLength(0)

      await guardarUmbral(
        contexto.anioId,
        { faltasParaAlerta: 2 },
        contexto.director.actor,
        {},
        prisma,
      )

      const alertas = await alertasDe(contexto)
      expect(alertas).toHaveLength(1)
      expect(alertas[0]?.faltasInjustificadas).toBe(2)
    })

    it('al aprobar una justificación recalcula y elimina la alerta', async () => {
      const contexto = await crearContexto()
      await guardarUmbral(
        contexto.anioId,
        { faltasParaAlerta: 2 },
        contexto.director.actor,
        {},
        prisma,
      )

      await registrarFalta(contexto, '2024-05-01')
      const falta = await registrarFalta(contexto, '2024-05-02')
      expect(await alertasDe(contexto)).toHaveLength(1)

      const solicitud = await solicitarJustificacion(
        falta.id,
        { motivo: 'Cita médica' },
        contexto.apoderado.actor,
        {},
        prisma,
      )
      await aprobarJustificacion(
        solicitud.id,
        {},
        contexto.docente.actor,
        {},
        prisma,
      )

      expect(await alertasDe(contexto)).toHaveLength(0)
    })

    it('al corregir la falta a presente recalcula y elimina la alerta', async () => {
      const contexto = await crearContexto()
      await guardarUmbral(
        contexto.anioId,
        { faltasParaAlerta: 1 },
        contexto.director.actor,
        {},
        prisma,
      )

      const falta = await registrarFalta(contexto, '2024-05-01')
      expect(await alertasDe(contexto)).toHaveLength(1)

      await corregirAsistencia(
        falta.id,
        { estado: 'PRESENTE', motivo: 'Error de registro' },
        contexto.docente.actor,
        {},
        prisma,
      )

      expect(await alertasDe(contexto)).toHaveLength(0)
    })

    it('consulta el umbral como null y lo guarda auditado', async () => {
      const contexto = await crearContexto()

      expect(
        await obtenerUmbral(contexto.anioId, contexto.director.actor, prisma),
      ).toEqual({ anioId: contexto.anioId, faltasParaAlerta: null })

      const guardado = await guardarUmbral(
        contexto.anioId,
        { faltasParaAlerta: 5 },
        contexto.director.actor,
        {},
        prisma,
      )

      expect(guardado).toEqual({
        anioId: contexto.anioId,
        faltasParaAlerta: 5,
      })

      expect(
        await obtenerUmbral(contexto.anioId, contexto.director.actor, prisma),
      ).toEqual({ anioId: contexto.anioId, faltasParaAlerta: 5 })

      const auditoria = await prisma.auditoria.findFirstOrThrow({
        where: { entidad: 'UMBRAL_ASISTENCIA', entidadId: contexto.anioId },
      })
      expect(auditoria.accion).toBe('CREAR')
      expect(auditoria.datos).toMatchObject({
        faltasParaAlerta: { anterior: null, nuevo: 5 },
      })
    })

    it('rechaza umbrales no positivos y a quien no gestiona la estructura', async () => {
      expect(
        umbralAsistenciaSchema.safeParse({ faltasParaAlerta: 0 }).success,
      ).toBe(false)
      expect(
        umbralAsistenciaSchema.safeParse({ faltasParaAlerta: -2 }).success,
      ).toBe(false)

      const contexto = await crearContexto()

      await expect(
        guardarUmbral(
          contexto.anioId,
          { faltasParaAlerta: 3 },
          contexto.docente.actor,
          {},
          prisma,
        ),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    })

    it('devuelve 404 si el año no existe', async () => {
      const contexto = await crearContexto()

      await expect(
        obtenerUmbral(
          '00000000-0000-4000-8000-000000000099',
          contexto.director.actor,
          prisma,
        ),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    })
  },
)
