import type { FastifyInstance } from 'fastify'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../../src/app.js'
import {
  redactarDatos,
  registrarAuditoria,
  TEXTO_REDACTADO,
} from '../../src/core/audit.js'
import { signAccessToken } from '../../src/core/auth/tokens.js'
import { createTestPrisma, limpiarBaseDePruebas } from '../helpers/test-db.js'
import { INSTITUCION_ID } from '../constants.js'

describe.skipIf(!process.env.TEST_DATABASE_URL)('auditoría', () => {
  let app: FastifyInstance
  let prisma: ReturnType<typeof createTestPrisma>
  let secuencia = 0
  let documentos = 0

  beforeAll(async () => {
    prisma = createTestPrisma()
    app = await buildApp()
    await app.ready()
  })

  beforeEach(async () => {
    await limpiarBaseDePruebas(prisma)
  })

  afterAll(async () => {
    await app.close()
    await prisma.$disconnect()
  })

  function siguienteDocumento(): string {
    documentos += 1

    return String(75_000_000 + documentos)
  }

  async function crearUsuarioConRoles(roles: string[]) {
    secuencia += 1

    const persona = await prisma.persona.create({
      data: {
        nombres: `Usuario${secuencia}`,
        apellidos: 'De Prueba',
        tipoDocumento: 'DNI',
        numeroDocumento: String(43_000_000 + secuencia),
      },
    })

    const usuario = await prisma.usuario.create({
      data: {
        personaId: persona.id,
        username: `usuario.${secuencia}`,
        email: `usuario.${secuencia}@ejemplo.edu.pe`,
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

  function get(ruta: string, token: string) {
    return request(app.server)
      .get(ruta)
      .set('Authorization', `Bearer ${token}`)
  }

  function post(ruta: string, token: string, cuerpo: unknown) {
    return request(app.server)
      .post(ruta)
      .set('Authorization', `Bearer ${token}`)
      .send(cuerpo as object)
  }

  function patch(ruta: string, token: string, cuerpo: unknown) {
    return request(app.server)
      .patch(ruta)
      .set('Authorization', `Bearer ${token}`)
      .send(cuerpo as object)
  }

  async function crearEstructura() {
    const institucion = { id: INSTITUCION_ID }
    const nivel = await prisma.nivel.create({
      data: { institucionId: INSTITUCION_ID, nombre: 'Primaria', orden: 1 },
    })
    const grado = await prisma.grado.create({
      data: { nivelId: nivel.id, nombre: '1.°', orden: 1 },
    })
    const anio = await prisma.anioAcademico.create({
      data: {
        institucionId: INSTITUCION_ID,
        nombre: '2026',
        fechaInicio: new Date('2026-03-01T00:00:00.000Z'),
        fechaFin: new Date('2026-12-15T00:00:00.000Z'),
        estado: 'ACTIVO',
      },
    })
    const seccion = await prisma.seccion.create({
      data: { gradoId: grado.id, anioId: anio.id, nombre: 'A' },
    })

    return { institucion, nivel, grado, anio, seccion }
  }

  async function crearAlumno() {
    const documento = siguienteDocumento()
    const persona = await prisma.persona.create({
      data: {
        nombres: 'Ana',
        apellidos: 'Quispe Rojas',
        tipoDocumento: 'DNI',
        numeroDocumento: documento,
      },
    })

    return prisma.alumno.create({
      data: { personaId: persona.id, codigoAlumno: `AL-${documento}` },
      include: { persona: true },
    })
  }

  async function crearApoderadoPrincipal(alumnoId: string) {
    const persona = await prisma.persona.create({
      data: {
        nombres: 'Rosa',
        apellidos: 'Mendoza',
        tipoDocumento: 'DNI',
        numeroDocumento: siguienteDocumento(),
      },
    })
    const apoderado = await prisma.apoderado.create({
      data: { personaId: persona.id },
    })

    await prisma.apoderadoAlumno.create({
      data: {
        apoderadoId: apoderado.id,
        alumnoId,
        parentesco: 'Madre',
        esPrincipal: true,
      },
    })

    return apoderado
  }

  it('redacta credenciales y PII de forma recursiva', () => {
    const resultado = redactarDatos({
      codigo: 'AL-001',
      password: 'secreto',
      persona: {
        nombres: 'Ana',
        numero_documento: '12345678',
        telefono: '987654321',
        emailContacto: 'ana@ejemplo.edu.pe',
      },
      tokens: [{ accessToken: 'abc' }, { valor: 'visible' }],
    })

    expect(resultado).toEqual({
      codigo: 'AL-001',
      password: TEXTO_REDACTADO,
      persona: {
        nombres: TEXTO_REDACTADO,
        numero_documento: TEXTO_REDACTADO,
        telefono: TEXTO_REDACTADO,
        emailContacto: TEXTO_REDACTADO,
      },
      tokens: [{ accessToken: TEXTO_REDACTADO }, { valor: 'visible' }],
    })
  })

  it('conserva los valores no sensibles y los nulos', () => {
    expect(
      redactarDatos({
        estado: 'APROBADA',
        motivo: null,
        conteo: 2,
        activo: true,
      }),
    ).toEqual({
      estado: 'APROBADA',
      motivo: null,
      conteo: 2,
      activo: true,
    })
  })

  it('persiste usuario, entidad, acción, IP y datos redactados', async () => {
    const usuario = await crearUsuarioConRoles(['SUPER_ADMIN'])
    const entidadId = '00000000-0000-4000-8000-000000000001'

    await prisma.$transaction(async (tx) => {
      await registrarAuditoria(tx, {
        usuarioId: usuario.id,
        accion: 'CREAR',
        entidad: 'ALUMNO',
        entidadId,
        datos: {
          codigoAlumno: 'AL-001',
          persona: { nombres: 'Ana', numeroDocumento: '12345678' },
        },
        ip: '127.0.0.1',
        userAgent: 'vitest',
      })
    })

    const fila = await prisma.auditoria.findFirstOrThrow()

    expect(fila).toMatchObject({
      usuarioId: usuario.id,
      accion: 'CREAR',
      entidad: 'ALUMNO',
      entidadId,
      ip: '127.0.0.1',
      userAgent: 'vitest',
    })
    expect(fila.datos).toEqual({
      codigoAlumno: 'AL-001',
      persona: {
        nombres: TEXTO_REDACTADO,
        numeroDocumento: TEXTO_REDACTADO,
      },
    })
  })

  it('revierte la auditoría si la transacción falla', async () => {
    const usuario = await crearUsuarioConRoles(['SUPER_ADMIN'])

    await expect(
      prisma.$transaction(async (tx) => {
        await registrarAuditoria(tx, {
          usuarioId: usuario.id,
          accion: 'CREAR',
          entidad: 'ALUMNO',
          datos: { codigoAlumno: 'AL-001' },
        })

        throw new Error('fallo posterior')
      }),
    ).rejects.toThrow('fallo posterior')

    expect(await prisma.auditoria.count()).toBe(0)
  })

  it('audita la creación de un alumno sin guardar su PII', async () => {
    const usuario = await crearUsuarioConRoles(['DIRECTOR'])
    const { token } = await signAccessToken(usuario.id)

    const respuesta = await post('/api/v1/alumnos', token, {
      persona: {
        nombres: 'Ana',
        apellidos: 'Quispe Rojas',
        tipoDocumento: 'DNI',
        numeroDocumento: siguienteDocumento(),
      },
      codigoAlumno: 'AL-001',
    })

    expect(respuesta.status).toBe(201)

    const fila = await prisma.auditoria.findFirstOrThrow({
      where: { entidad: 'ALUMNO', entidadId: respuesta.body.id },
    })

    expect(fila.usuarioId).toBe(usuario.id)
    expect(fila.accion).toBe('CREAR')
    expect(typeof fila.ip).toBe('string')
    expect(fila.ip).not.toBe('')
    expect(fila.datos).toEqual({
      personaId: respuesta.body.persona.id,
      codigoAlumno: 'AL-001',
    })
    expect(JSON.stringify(fila.datos)).not.toContain('Quispe')
  })

  it('audita la edición de una persona solo con los nombres de campo', async () => {
    const usuario = await crearUsuarioConRoles(['DIRECTOR'])
    const { token } = await signAccessToken(usuario.id)
    const alumno = await crearAlumno()

    const respuesta = await patch(`/api/v1/alumnos/${alumno.id}`, token, {
      persona: { telefono: '987654321', direccion: 'Av. Siempre Viva 123' },
    })

    expect(respuesta.status).toBe(200)

    const fila = await prisma.auditoria.findFirstOrThrow({
      where: { entidad: 'ALUMNO', entidadId: alumno.id },
    })

    expect(fila.accion).toBe('ACTUALIZAR')
    expect(fila.datos).toEqual({
      camposActualizados: ['persona'],
      camposPersona: ['telefono', 'direccion'],
    })
    expect(JSON.stringify(fila.datos)).not.toContain('987654321')
    expect(JSON.stringify(fila.datos)).not.toContain('Siempre Viva')
  })

  it('audita la aprobación de una matrícula', async () => {
    const { anio, seccion } = await crearEstructura()
    const alumno = await crearAlumno()
    await crearApoderadoPrincipal(alumno.id)
    const usuario = await crearUsuarioConRoles(['SUPER_ADMIN'])
    const { token } = await signAccessToken(usuario.id)

    const creacion = await post('/api/v1/matriculas', token, {
      alumnoId: alumno.id,
      seccionId: seccion.id,
      anioId: anio.id,
    })

    expect(creacion.status).toBe(201)

    const aprobacion = await patch(
      `/api/v1/matriculas/${creacion.body.id}`,
      token,
      { estado: 'APROBADA' },
    )

    expect(aprobacion.status).toBe(200)

    const fila = await prisma.auditoria.findFirstOrThrow({
      where: {
        entidad: 'MATRICULA',
        entidadId: creacion.body.id,
        accion: 'APROBAR',
      },
    })

    expect(fila.usuarioId).toBe(usuario.id)
    expect(fila.datos).toEqual({
      estadoAnterior: 'SOLICITADA',
      estado: 'APROBADA',
    })

    const historial = await get(
      `/api/v1/matriculas?alumnoId=${alumno.id}`,
      token,
    )

    expect(historial.status).toBe(200)
    expect(historial.body.data[0].estado).toBe('APROBADA')
  })
})
