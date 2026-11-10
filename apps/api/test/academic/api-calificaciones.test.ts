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
  'API de escritura de calificaciones y notas finales',
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
          numeroDocumento: String(66_000_000 + secuencia),
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

      return { usuario, token }
    }

    interface Contexto {
      anioId: string
      periodoId: string
      cursoId: string
      seccionId: string
      alumnoId: string
      docente: string
      director: string
      apoderado: string
      sinRoles: string
    }

    async function crearContexto(opciones: {
      estadoPeriodo?: 'PLANIFICADO' | 'ACTIVO' | 'CERRADO'
    } = {}): Promise<Contexto> {
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

      const docenteToken = await tokenDe(['DOCENTE'])
      const docente = await prisma.docente.create({
        data: {
          personaId: (
            await prisma.usuario.findUniqueOrThrow({
              where: { id: docenteToken.usuario.id },
              select: { personaId: true },
            })
          ).personaId,
          codigoDocente: 'DOC-1',
        },
      })
      await prisma.asignacionDocente.create({
        data: {
          docenteId: docente.id,
          cursoId: curso.id,
          seccionId: seccion.id,
          anioId: anio.id,
        },
      })

      const director = await tokenDe(['DIRECTOR'])
      const apoderado = await tokenDe(['APODERADO'])
      const sinRoles = await tokenDe([])

      return {
        anioId: anio.id,
        periodoId: periodo.id,
        cursoId: curso.id,
        seccionId: seccion.id,
        alumnoId: alumno.id,
        docente: docenteToken.token,
        director: director.token,
        apoderado: apoderado.token,
        sinRoles: sinRoles.token,
      }
    }

    function enviar(
      metodo: 'post' | 'patch',
      ruta: string,
      token: string | undefined,
      cuerpo: unknown,
    ) {
      const peticion = request(app.server)[metodo](ruta).send(cuerpo)

      return token ? peticion.set('Authorization', `Bearer ${token}`) : peticion
    }

    it('exige autenticación para registrar', async () => {
      const contexto = await crearContexto()

      await enviar('post', '/api/v1/calificaciones', undefined, {
        alumnoId: contexto.alumnoId,
        cursoId: contexto.cursoId,
        periodoId: contexto.periodoId,
        valor: 'A',
      }).expect(401)
    })

    it('rechaza el registro a un rol sin permiso de gestión', async () => {
      const contexto = await crearContexto()

      await enviar('post', '/api/v1/calificaciones', contexto.apoderado, {
        alumnoId: contexto.alumnoId,
        cursoId: contexto.cursoId,
        periodoId: contexto.periodoId,
        valor: 'A',
      }).expect(403)
    })

    it('registra una calificación con 201 y auditoría', async () => {
      const contexto = await crearContexto()

      const respuesta = await enviar(
        'post',
        '/api/v1/calificaciones',
        contexto.docente,
        {
          alumnoId: contexto.alumnoId,
          cursoId: contexto.cursoId,
          periodoId: contexto.periodoId,
          valor: 'AD',
          observacion: 'Destacado',
        },
      ).expect(201)

      expect(respuesta.body).toMatchObject({
        alumnoId: contexto.alumnoId,
        cursoId: contexto.cursoId,
        periodoId: contexto.periodoId,
        valor: 'AD',
        observacion: 'Destacado',
      })

      const auditoria = await prisma.auditoria.findFirst({
        where: {
          accion: 'CREAR',
          entidad: 'CALIFICACION',
          entidadId: respuesta.body.id,
        },
      })
      expect(auditoria).not.toBeNull()
    })

    it('devuelve 409 al duplicar la calificación', async () => {
      const contexto = await crearContexto()
      const datos = {
        alumnoId: contexto.alumnoId,
        cursoId: contexto.cursoId,
        periodoId: contexto.periodoId,
        valor: 'A',
      }

      await enviar(
        'post',
        '/api/v1/calificaciones',
        contexto.docente,
        datos,
      ).expect(201)

      const duplicada = await enviar(
        'post',
        '/api/v1/calificaciones',
        contexto.docente,
        { ...datos, valor: 'B' },
      ).expect(409)

      expect(duplicada.body.error.code).toBe('CONFLICT')
    })

    it('edita la calificación con el período abierto', async () => {
      const contexto = await crearContexto()
      const creada = await prisma.calificacion.create({
        data: {
          alumnoId: contexto.alumnoId,
          cursoId: contexto.cursoId,
          periodoId: contexto.periodoId,
          valor: 'B',
        },
      })

      const respuesta = await enviar(
        'patch',
        `/api/v1/calificaciones/${creada.id}`,
        contexto.docente,
        { valor: 'A' },
      ).expect(200)

      expect(respuesta.body.valor).toBe('A')
    })

    it('rechaza la edición a un rol sin permiso de gestión ni corrección', async () => {
      const contexto = await crearContexto()
      const creada = await prisma.calificacion.create({
        data: {
          alumnoId: contexto.alumnoId,
          cursoId: contexto.cursoId,
          periodoId: contexto.periodoId,
          valor: 'B',
        },
      })

      await enviar(
        'patch',
        `/api/v1/calificaciones/${creada.id}`,
        contexto.apoderado,
        { valor: 'A' },
      ).expect(403)
    })

    it('el Director corrige tras el cierre solo con motivo', async () => {
      const contexto = await crearContexto({ estadoPeriodo: 'CERRADO' })
      const creada = await prisma.calificacion.create({
        data: {
          alumnoId: contexto.alumnoId,
          cursoId: contexto.cursoId,
          periodoId: contexto.periodoId,
          valor: 'B',
        },
      })

      await enviar(
        'patch',
        `/api/v1/calificaciones/${creada.id}`,
        contexto.director,
        { valor: 'A' },
      ).expect(400)

      const respuesta = await enviar(
        'patch',
        `/api/v1/calificaciones/${creada.id}`,
        contexto.director,
        { valor: 'A', motivo: 'Revisión del acta' },
      ).expect(200)

      expect(respuesta.body.valor).toBe('A')
    })

    it('registra y corrige la nota final con los mismos permisos', async () => {
      const contexto = await crearContexto()

      const creada = await enviar(
        'post',
        '/api/v1/notas-finales',
        contexto.docente,
        {
          alumnoId: contexto.alumnoId,
          cursoId: contexto.cursoId,
          periodoId: contexto.periodoId,
          valor: 'B',
        },
      ).expect(201)

      const actualizada = await enviar(
        'patch',
        `/api/v1/notas-finales/${creada.body.id}`,
        contexto.docente,
        { valor: 'A' },
      ).expect(200)

      expect(actualizada.body.valor).toBe('A')
    })

    it('devuelve 409 al duplicar la nota final', async () => {
      const contexto = await crearContexto()
      const datos = {
        alumnoId: contexto.alumnoId,
        cursoId: contexto.cursoId,
        periodoId: contexto.periodoId,
        valor: 'A',
      }

      await enviar(
        'post',
        '/api/v1/notas-finales',
        contexto.docente,
        datos,
      ).expect(201)

      await enviar('post', '/api/v1/notas-finales', contexto.docente, {
        ...datos,
        valor: 'B',
      }).expect(409)
    })

    it('valida el cuerpo de la calificación', async () => {
      const contexto = await crearContexto()

      await enviar('post', '/api/v1/calificaciones', contexto.docente, {
        alumnoId: contexto.alumnoId,
        cursoId: contexto.cursoId,
        periodoId: contexto.periodoId,
        valor: '20',
      }).expect(400)
    })
  },
)
