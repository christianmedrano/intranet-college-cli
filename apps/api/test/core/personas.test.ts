import type { FastifyInstance } from 'fastify'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../../src/app.js'
import { signAccessToken } from '../../src/core/auth/tokens.js'
import { createTestPrisma, limpiarBaseDePruebas } from '../helpers/test-db.js'

describe.skipIf(!process.env.TEST_DATABASE_URL)('personas', () => {
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

    return String(70_000_000 + documentos)
  }

  function persona(
    overrides: Partial<{
      nombres: string
      apellidos: string
      tipoDocumento: string
      numeroDocumento: string
      fechaNacimiento: string | null
      telefono: string | null
      emailContacto: string | null
      direccion: string | null
    }> = {},
  ) {
    return {
      nombres: 'Ana',
      apellidos: 'Quispe Rojas',
      tipoDocumento: 'DNI',
      numeroDocumento: siguienteDocumento(),
      ...overrides,
    }
  }

  async function crearUsuarioConRoles(roles: string[]) {
    secuencia += 1

    const personaCreada = await prisma.persona.create({
      data: {
        nombres: `Usuario${secuencia}`,
        apellidos: 'De Prueba',
        tipoDocumento: 'DNI',
        numeroDocumento: String(40_000_000 + secuencia),
      },
    })

    const usuario = await prisma.usuario.create({
      data: {
        personaId: personaCreada.id,
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

  async function tokenDe(roles: string[]): Promise<string> {
    const usuario = await crearUsuarioConRoles(roles)
    const { token } = await signAccessToken(usuario.id)

    return token
  }

  function get(ruta: string, token?: string) {
    const peticion = request(app.server).get(ruta)

    return token ? peticion.set('Authorization', `Bearer ${token}`) : peticion
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

  async function crearAlumnoApi(
    token: string,
    overrides: Record<string, unknown> = {},
  ) {
    return post('/api/v1/alumnos', token, {
      persona: persona(),
      codigoAlumno: `AL-${siguienteDocumento()}`,
      ...overrides,
    })
  }

  async function crearDocenteApi(
    token: string,
    overrides: Record<string, unknown> = {},
  ) {
    return post('/api/v1/docentes', token, {
      persona: persona(),
      codigoDocente: `DO-${siguienteDocumento()}`,
      ...overrides,
    })
  }

  async function crearApoderadoApi(
    token: string,
    overrides: Record<string, unknown> = {},
  ) {
    return post('/api/v1/apoderados', token, {
      persona: persona(),
      ...overrides,
    })
  }

  it('exige autenticación en los diez endpoints de personas', async () => {
    const id = '00000000-0000-4000-8000-000000000001'

    const respuestas = [
      await get('/api/v1/alumnos'),
      await request(app.server).post('/api/v1/alumnos').send({}),
      await request(app.server).patch(`/api/v1/alumnos/${id}`).send({}),
      await get('/api/v1/docentes'),
      await request(app.server).post('/api/v1/docentes').send({}),
      await request(app.server).patch(`/api/v1/docentes/${id}`).send({}),
      await get('/api/v1/apoderados'),
      await request(app.server).post('/api/v1/apoderados').send({}),
      await request(app.server).patch(`/api/v1/apoderados/${id}`).send({}),
      await request(app.server)
        .post(`/api/v1/apoderados/${id}/alumnos`)
        .send({}),
    ]

    for (const respuesta of respuestas) {
      expect(respuesta.status).toBe(401)
    }
  })

  it('rechaza a un Docente en los diez endpoints de personas', async () => {
    const token = await tokenDe(['DOCENTE'])
    const id = '00000000-0000-4000-8000-000000000001'

    const respuestas = [
      await get('/api/v1/alumnos', token),
      await post('/api/v1/alumnos', token, {}),
      await patch(`/api/v1/alumnos/${id}`, token, {}),
      await get('/api/v1/docentes', token),
      await post('/api/v1/docentes', token, {}),
      await patch(`/api/v1/docentes/${id}`, token, {}),
      await get('/api/v1/apoderados', token),
      await post('/api/v1/apoderados', token, {}),
      await patch(`/api/v1/apoderados/${id}`, token, {}),
      await post(`/api/v1/apoderados/${id}/alumnos`, token, {}),
    ]

    for (const respuesta of respuestas) {
      expect(respuesta.status).toBe(403)
      expect(respuesta.body).toMatchObject({ error: { code: 'FORBIDDEN' } })
    }
  })

  describe('alumnos', () => {
    it('devuelve un listado vacío paginado', async () => {
      const token = await tokenDe(['SUPER_ADMIN'])

      const respuesta = await get('/api/v1/alumnos', token)

      expect(respuesta.status).toBe(200)
      expect(respuesta.body).toEqual({
        data: [],
        meta: { page: 1, pageSize: 20, total: 0 },
      })
    })

    it('crea el alumno y su persona sin crear cuenta de usuario', async () => {
      const usuario = await crearUsuarioConRoles(['DIRECTOR'])
      const { token } = await signAccessToken(usuario.id)
      const datos = persona({
        fechaNacimiento: '2012-05-14',
        telefono: '987654321',
        emailContacto: 'contacto@ejemplo.edu.pe',
      })

      const respuesta = await post('/api/v1/alumnos', token, {
        persona: datos,
        codigoAlumno: 'AL-001',
        fechaIngreso: '2026-03-01',
        observaciones: 'Ingresante',
      })

      expect(respuesta.status).toBe(201)
      expect(respuesta.body).toMatchObject({
        codigoAlumno: 'AL-001',
        fechaIngreso: '2026-03-01',
        observaciones: 'Ingresante',
        persona: {
          nombres: 'Ana',
          apellidos: 'Quispe Rojas',
          tipoDocumento: 'DNI',
          numeroDocumento: datos.numeroDocumento,
          fechaNacimiento: '2012-05-14',
          telefono: '987654321',
          emailContacto: 'contacto@ejemplo.edu.pe',
        },
        apoderados: [],
      })

      const persistido = await prisma.alumno.findUniqueOrThrow({
        where: { id: respuesta.body.id },
        include: { persona: true },
      })

      expect(persistido.createdBy).toBe(usuario.id)
      expect(persistido.persona.createdBy).toBe(usuario.id)

      const cuenta = await prisma.usuario.findFirst({
        where: { personaId: persistido.personaId },
      })

      expect(cuenta).toBeNull()
    })

    it('rechaza un documento duplicado con 409', async () => {
      const token = await tokenDe(['SUPER_ADMIN'])
      const datos = persona()

      await post('/api/v1/alumnos', token, {
        persona: datos,
        codigoAlumno: 'AL-001',
      })

      const respuesta = await post('/api/v1/alumnos', token, {
        persona: datos,
        codigoAlumno: 'AL-002',
      })

      expect(respuesta.status).toBe(409)
      expect(respuesta.body).toMatchObject({ error: { code: 'CONFLICT' } })
    })

    it('rechaza un código de alumno duplicado con 409', async () => {
      const token = await tokenDe(['SUPER_ADMIN'])

      await post('/api/v1/alumnos', token, {
        persona: persona(),
        codigoAlumno: 'AL-001',
      })

      const respuesta = await post('/api/v1/alumnos', token, {
        persona: persona(),
        codigoAlumno: 'AL-001',
      })

      expect(respuesta.status).toBe(409)
    })

    it('rechaza un documento ya usado por un docente con 409', async () => {
      const token = await tokenDe(['SUPER_ADMIN'])
      const datos = persona()

      await post('/api/v1/docentes', token, {
        persona: datos,
        codigoDocente: 'DO-001',
      })

      const respuesta = await post('/api/v1/alumnos', token, {
        persona: datos,
        codigoAlumno: 'AL-001',
      })

      expect(respuesta.status).toBe(409)
      expect(respuesta.body).toMatchObject({ error: { code: 'CONFLICT' } })
    })

    it('lista los alumnos con la persona anidada y orden estable', async () => {
      const token = await tokenDe(['SUPER_ADMIN'])

      await post('/api/v1/alumnos', token, {
        persona: persona({ nombres: 'Zulema', apellidos: 'Ávila' }),
        codigoAlumno: 'AL-003',
      })
      await post('/api/v1/alumnos', token, {
        persona: persona({ nombres: 'Bruno', apellidos: 'Ávila' }),
        codigoAlumno: 'AL-001',
      })
      await post('/api/v1/alumnos', token, {
        persona: persona({ nombres: 'Carla', apellidos: 'Benites' }),
        codigoAlumno: 'AL-002',
      })

      const respuesta = await get('/api/v1/alumnos', token)

      expect(respuesta.status).toBe(200)
      expect(respuesta.body.meta.total).toBe(3)
      expect(
        respuesta.body.data.map(
          (alumno: { persona: { nombres: string } }) => alumno.persona.nombres,
        ),
      ).toEqual(['Bruno', 'Zulema', 'Carla'])
      expect(respuesta.body.data[0].persona).toMatchObject({
        apellidos: 'Ávila',
        tipoDocumento: 'DNI',
      })
    })

    it('actualiza el alumno y su persona en una sola petición', async () => {
      const token = await tokenDe(['DIRECTOR'])
      const creado = await crearAlumnoApi(token)

      const respuesta = await patch(
        `/api/v1/alumnos/${creado.body.id}`,
        token,
        {
          codigoAlumno: 'AL-999',
          observaciones: 'Actualizado',
          persona: {
            nombres: 'Ana María',
            telefono: '999111222',
          },
        },
      )

      expect(respuesta.status).toBe(200)
      expect(respuesta.body).toMatchObject({
        codigoAlumno: 'AL-999',
        observaciones: 'Actualizado',
        persona: {
          nombres: 'Ana María',
          telefono: '999111222',
          apellidos: 'Quispe Rojas',
        },
      })
    })

    it('permite vaciar un campo opcional de la persona con null', async () => {
      const token = await tokenDe(['SUPER_ADMIN'])
      const creado = await crearAlumnoApi(token, {
        persona: persona({ telefono: '987654321' }),
      })

      const respuesta = await patch(
        `/api/v1/alumnos/${creado.body.id}`,
        token,
        { persona: { telefono: null } },
      )

      expect(respuesta.status).toBe(200)
      expect(respuesta.body.persona.telefono).toBeNull()
    })

    it('devuelve 404 al editar un alumno inexistente', async () => {
      const token = await tokenDe(['SUPER_ADMIN'])

      const respuesta = await patch(
        '/api/v1/alumnos/00000000-0000-4000-8000-000000000099',
        token,
        { codigoAlumno: 'AL-999' },
      )

      expect(respuesta.status).toBe(404)
    })

    it('oculta los alumnos con borrado lógico', async () => {
      const token = await tokenDe(['SUPER_ADMIN'])
      const creado = await crearAlumnoApi(token)

      await prisma.alumno.update({
        where: { id: creado.body.id },
        data: { deletedAt: new Date() },
      })

      const listado = await get('/api/v1/alumnos', token)
      const edicion = await patch(
        `/api/v1/alumnos/${creado.body.id}`,
        token,
        { codigoAlumno: 'AL-999' },
      )

      expect(listado.body.data).toEqual([])
      expect(edicion.status).toBe(404)
    })

    it('valida el número de documento obligatorio', async () => {
      const token = await tokenDe(['SUPER_ADMIN'])

      const respuesta = await post('/api/v1/alumnos', token, {
        persona: persona({ numeroDocumento: '   ' }),
        codigoAlumno: 'AL-001',
      })

      expect(respuesta.status).toBe(400)
      expect(respuesta.body.error.code).toBe('VALIDATION_ERROR')
    })

    it('valida el correo de contacto', async () => {
      const token = await tokenDe(['SUPER_ADMIN'])

      const respuesta = await post('/api/v1/alumnos', token, {
        persona: persona({ emailContacto: 'no-es-correo' }),
        codigoAlumno: 'AL-001',
      })

      expect(respuesta.status).toBe(400)
    })

    it('rechaza un cuerpo vacío al editar', async () => {
      const token = await tokenDe(['SUPER_ADMIN'])
      const creado = await crearAlumnoApi(token)

      const respuesta = await patch(
        `/api/v1/alumnos/${creado.body.id}`,
        token,
        {},
      )

      expect(respuesta.status).toBe(400)
    })
  })

  describe('docentes', () => {
    it('crea el docente sin cuenta de usuario', async () => {
      const usuario = await crearUsuarioConRoles(['DIRECTOR'])
      const { token } = await signAccessToken(usuario.id)

      const respuesta = await post('/api/v1/docentes', token, {
        persona: persona({ nombres: 'Luis', apellidos: 'Paredes' }),
        codigoDocente: 'DO-001',
        especialidad: 'Matemática',
      })

      expect(respuesta.status).toBe(201)
      expect(respuesta.body).toMatchObject({
        codigoDocente: 'DO-001',
        especialidad: 'Matemática',
        persona: { nombres: 'Luis', apellidos: 'Paredes' },
      })

      const persistido = await prisma.docente.findUniqueOrThrow({
        where: { id: respuesta.body.id },
      })

      expect(persistido.createdBy).toBe(usuario.id)

      const cuenta = await prisma.usuario.findFirst({
        where: { personaId: persistido.personaId },
      })

      expect(cuenta).toBeNull()
    })

    it('rechaza un código de docente duplicado con 409', async () => {
      const token = await tokenDe(['SUPER_ADMIN'])

      await post('/api/v1/docentes', token, {
        persona: persona(),
        codigoDocente: 'DO-001',
      })

      const respuesta = await post('/api/v1/docentes', token, {
        persona: persona(),
        codigoDocente: 'DO-001',
      })

      expect(respuesta.status).toBe(409)
      expect(respuesta.body).toMatchObject({ error: { code: 'CONFLICT' } })
    })

    it('lista los docentes con su persona', async () => {
      const token = await tokenDe(['SUPER_ADMIN'])

      await crearDocenteApi(token, {
        persona: persona({ nombres: 'Luis', apellidos: 'Paredes' }),
      })
      await crearDocenteApi(token, {
        persona: persona({ nombres: 'Elena', apellidos: 'Aguirre' }),
      })

      const respuesta = await get('/api/v1/docentes', token)

      expect(respuesta.status).toBe(200)
      expect(respuesta.body.meta.total).toBe(2)
      expect(
        respuesta.body.data.map(
          (docente: { persona: { nombres: string } }) => docente.persona.nombres,
        ),
      ).toEqual(['Elena', 'Luis'])
    })

    it('actualiza la especialidad y la persona', async () => {
      const token = await tokenDe(['DIRECTOR'])
      const creado = await crearDocenteApi(token)

      const respuesta = await patch(
        `/api/v1/docentes/${creado.body.id}`,
        token,
        {
          especialidad: 'Ciencia y Tecnología',
          persona: { direccion: 'Av. Los Álamos 123' },
        },
      )

      expect(respuesta.status).toBe(200)
      expect(respuesta.body).toMatchObject({
        especialidad: 'Ciencia y Tecnología',
        persona: { direccion: 'Av. Los Álamos 123' },
      })
    })

    it('devuelve 404 al editar un docente inexistente', async () => {
      const token = await tokenDe(['SUPER_ADMIN'])

      const respuesta = await patch(
        '/api/v1/docentes/00000000-0000-4000-8000-000000000099',
        token,
        { especialidad: 'Arte' },
      )

      expect(respuesta.status).toBe(404)
    })

    it('oculta los docentes con borrado lógico', async () => {
      const token = await tokenDe(['SUPER_ADMIN'])
      const creado = await crearDocenteApi(token)

      await prisma.docente.update({
        where: { id: creado.body.id },
        data: { deletedAt: new Date() },
      })

      const listado = await get('/api/v1/docentes', token)
      const edicion = await patch(
        `/api/v1/docentes/${creado.body.id}`,
        token,
        { especialidad: 'Arte' },
      )

      expect(listado.body.data).toEqual([])
      expect(edicion.status).toBe(404)
    })
  })

  describe('apoderados', () => {
    it('crea el apoderado con ocupación nula por defecto', async () => {
      const usuario = await crearUsuarioConRoles(['DIRECTOR'])
      const { token } = await signAccessToken(usuario.id)

      const respuesta = await post('/api/v1/apoderados', token, {
        persona: persona({ nombres: 'Rosa', apellidos: 'Mendoza' }),
      })

      expect(respuesta.status).toBe(201)
      expect(respuesta.body).toMatchObject({
        ocupacion: null,
        persona: { nombres: 'Rosa', apellidos: 'Mendoza' },
        alumnos: [],
      })

      const persistido = await prisma.apoderado.findUniqueOrThrow({
        where: { id: respuesta.body.id },
      })

      expect(persistido.createdBy).toBe(usuario.id)
    })

    it('actualiza la ocupación y la persona', async () => {
      const token = await tokenDe(['DIRECTOR'])
      const creado = await crearApoderadoApi(token)

      const respuesta = await patch(
        `/api/v1/apoderados/${creado.body.id}`,
        token,
        {
          ocupacion: 'Comerciante',
          persona: { emailContacto: 'rosa@ejemplo.edu.pe' },
        },
      )

      expect(respuesta.status).toBe(200)
      expect(respuesta.body).toMatchObject({
        ocupacion: 'Comerciante',
        persona: { emailContacto: 'rosa@ejemplo.edu.pe' },
      })
    })

    it('lista los apoderados con sus alumnos', async () => {
      const token = await tokenDe(['SUPER_ADMIN'])

      await crearApoderadoApi(token, {
        persona: persona({ nombres: 'Rosa', apellidos: 'Mendoza' }),
      })
      await crearApoderadoApi(token, {
        persona: persona({ nombres: 'Julio', apellidos: 'Salas' }),
      })

      const respuesta = await get('/api/v1/apoderados', token)

      expect(respuesta.status).toBe(200)
      expect(respuesta.body.meta.total).toBe(2)
      expect(
        respuesta.body.data.map(
          (apoderado: { persona: { nombres: string } }) =>
            apoderado.persona.nombres,
        ),
      ).toEqual(['Rosa', 'Julio'])
      expect(respuesta.body.data[0].alumnos).toEqual([])
    })

    it('rechaza un documento duplicado con 409', async () => {
      const token = await tokenDe(['SUPER_ADMIN'])
      const datos = persona()

      await post('/api/v1/apoderados', token, { persona: datos })

      const respuesta = await post('/api/v1/apoderados', token, {
        persona: datos,
        ocupacion: 'Docente',
      })

      expect(respuesta.status).toBe(409)
      expect(respuesta.body).toMatchObject({ error: { code: 'CONFLICT' } })
    })

    it('devuelve 404 al editar un apoderado inexistente', async () => {
      const token = await tokenDe(['SUPER_ADMIN'])

      const respuesta = await patch(
        '/api/v1/apoderados/00000000-0000-4000-8000-000000000099',
        token,
        { ocupacion: 'Comerciante' },
      )

      expect(respuesta.status).toBe(404)
    })
  })

  describe('vínculos apoderado-alumno', () => {
    it('vincula un alumno y lo expone en el apoderado', async () => {
      const token = await tokenDe(['DIRECTOR'])
      const alumno = await crearAlumnoApi(token)
      const apoderado = await crearApoderadoApi(token)

      const respuesta = await post(
        `/api/v1/apoderados/${apoderado.body.id}/alumnos`,
        token,
        { alumnoId: alumno.body.id, parentesco: 'Madre', esPrincipal: true },
      )

      expect(respuesta.status).toBe(201)
      expect(respuesta.body).toEqual({
        apoderadoId: apoderado.body.id,
        alumnoId: alumno.body.id,
        parentesco: 'Madre',
        esPrincipal: true,
      })

      const listado = await get('/api/v1/apoderados', token)

      expect(listado.body.data[0].alumnos).toEqual([
        {
          alumnoId: alumno.body.id,
          parentesco: 'Madre',
          esPrincipal: true,
          alumno: {
            id: alumno.body.id,
            codigoAlumno: alumno.body.codigoAlumno,
            persona: alumno.body.persona,
          },
        },
      ])
    })

    it('un apoderado con dos alumnos ve ambos', async () => {
      const token = await tokenDe(['SUPER_ADMIN'])
      const primero = await crearAlumnoApi(token)
      const segundo = await crearAlumnoApi(token)
      const apoderado = await crearApoderadoApi(token)

      await post(`/api/v1/apoderados/${apoderado.body.id}/alumnos`, token, {
        alumnoId: primero.body.id,
        parentesco: 'Padre',
        esPrincipal: true,
      })
      await post(`/api/v1/apoderados/${apoderado.body.id}/alumnos`, token, {
        alumnoId: segundo.body.id,
        parentesco: 'Padre',
        esPrincipal: true,
      })

      const listado = await get('/api/v1/apoderados', token)

      expect(listado.body.data[0].alumnos).toHaveLength(2)
      expect(
        listado.body.data[0].alumnos
          .map((vinculo: { alumnoId: string }) => vinculo.alumnoId)
          .sort(),
      ).toEqual([primero.body.id, segundo.body.id].sort())
    })

    it('desmarca al principal anterior al marcar otro apoderado', async () => {
      const token = await tokenDe(['SUPER_ADMIN'])
      const alumno = await crearAlumnoApi(token)
      const madre = await crearApoderadoApi(token)
      const padre = await crearApoderadoApi(token)

      await post(`/api/v1/apoderados/${madre.body.id}/alumnos`, token, {
        alumnoId: alumno.body.id,
        parentesco: 'Madre',
        esPrincipal: true,
      })
      await post(`/api/v1/apoderados/${padre.body.id}/alumnos`, token, {
        alumnoId: alumno.body.id,
        parentesco: 'Padre',
        esPrincipal: true,
      })

      const listado = await get('/api/v1/apoderados', token)
      const principales = listado.body.data.flatMap(
        (apoderado: {
          alumnos: Array<{ alumnoId: string; esPrincipal: boolean }>
        }) =>
          apoderado.alumnos.filter(
            (vinculo) =>
              vinculo.alumnoId === alumno.body.id && vinculo.esPrincipal,
          ),
      )

      expect(principales).toHaveLength(1)
      expect(principales[0]).toMatchObject({
        alumnoId: alumno.body.id,
        esPrincipal: true,
      })
    })

    it('actualiza un vínculo existente sin duplicarlo', async () => {
      const token = await tokenDe(['SUPER_ADMIN'])
      const alumno = await crearAlumnoApi(token)
      const apoderado = await crearApoderadoApi(token)

      await post(`/api/v1/apoderados/${apoderado.body.id}/alumnos`, token, {
        alumnoId: alumno.body.id,
        parentesco: 'Tía',
      })

      const respuesta = await post(
        `/api/v1/apoderados/${apoderado.body.id}/alumnos`,
        token,
        { alumnoId: alumno.body.id, parentesco: 'Madre', esPrincipal: true },
      )

      expect(respuesta.status).toBe(200)
      expect(respuesta.body).toMatchObject({
        parentesco: 'Madre',
        esPrincipal: true,
      })

      const vinculos = await prisma.apoderadoAlumno.findMany({
        where: { alumnoId: alumno.body.id },
      })

      expect(vinculos).toHaveLength(1)
    })

    it('no desmarca al principal si se envía esPrincipal falso', async () => {
      const token = await tokenDe(['SUPER_ADMIN'])
      const alumno = await crearAlumnoApi(token)
      const apoderado = await crearApoderadoApi(token)

      await post(`/api/v1/apoderados/${apoderado.body.id}/alumnos`, token, {
        alumnoId: alumno.body.id,
        parentesco: 'Madre',
        esPrincipal: true,
      })

      const respuesta = await post(
        `/api/v1/apoderados/${apoderado.body.id}/alumnos`,
        token,
        { alumnoId: alumno.body.id, parentesco: 'Madre', esPrincipal: false },
      )

      expect(respuesta.status).toBe(200)
      expect(respuesta.body.esPrincipal).toBe(true)
    })

    it('expone los apoderados desde el alumno', async () => {
      const token = await tokenDe(['SUPER_ADMIN'])
      const alumno = await crearAlumnoApi(token)
      const apoderado = await crearApoderadoApi(token)

      await post(`/api/v1/apoderados/${apoderado.body.id}/alumnos`, token, {
        alumnoId: alumno.body.id,
        parentesco: 'Abuelo',
        esPrincipal: true,
      })

      const listado = await get('/api/v1/alumnos', token)

      expect(listado.body.data[0].apoderados).toEqual([
        {
          apoderadoId: apoderado.body.id,
          parentesco: 'Abuelo',
          esPrincipal: true,
          apoderado: apoderado.body.persona,
        },
      ])
    })

    it('devuelve 404 si el apoderado no existe', async () => {
      const token = await tokenDe(['SUPER_ADMIN'])
      const alumno = await crearAlumnoApi(token)

      const respuesta = await post(
        '/api/v1/apoderados/00000000-0000-4000-8000-000000000099/alumnos',
        token,
        { alumnoId: alumno.body.id, parentesco: 'Madre' },
      )

      expect(respuesta.status).toBe(404)
    })

    it('devuelve 404 si el alumno no existe', async () => {
      const token = await tokenDe(['SUPER_ADMIN'])
      const apoderado = await crearApoderadoApi(token)

      const respuesta = await post(
        `/api/v1/apoderados/${apoderado.body.id}/alumnos`,
        token,
        {
          alumnoId: '00000000-0000-4000-8000-000000000099',
          parentesco: 'Madre',
        },
      )

      expect(respuesta.status).toBe(404)
    })

    it('rechaza vincular un alumno con borrado lógico', async () => {
      const token = await tokenDe(['SUPER_ADMIN'])
      const alumno = await crearAlumnoApi(token)
      const apoderado = await crearApoderadoApi(token)

      await prisma.alumno.update({
        where: { id: alumno.body.id },
        data: { deletedAt: new Date() },
      })

      const respuesta = await post(
        `/api/v1/apoderados/${apoderado.body.id}/alumnos`,
        token,
        { alumnoId: alumno.body.id, parentesco: 'Madre' },
      )

      expect(respuesta.status).toBe(404)
    })

    it('rechaza vincular a un apoderado con borrado lógico', async () => {
      const token = await tokenDe(['SUPER_ADMIN'])
      const alumno = await crearAlumnoApi(token)
      const apoderado = await crearApoderadoApi(token)

      await prisma.apoderado.update({
        where: { id: apoderado.body.id },
        data: { deletedAt: new Date() },
      })

      const respuesta = await post(
        `/api/v1/apoderados/${apoderado.body.id}/alumnos`,
        token,
        { alumnoId: alumno.body.id, parentesco: 'Madre' },
      )

      expect(respuesta.status).toBe(404)
    })

    it('oculta los vínculos cuyo alumno tiene borrado lógico', async () => {
      const token = await tokenDe(['SUPER_ADMIN'])
      const alumno = await crearAlumnoApi(token)
      const apoderado = await crearApoderadoApi(token)

      await post(`/api/v1/apoderados/${apoderado.body.id}/alumnos`, token, {
        alumnoId: alumno.body.id,
        parentesco: 'Madre',
        esPrincipal: true,
      })

      await prisma.alumno.update({
        where: { id: alumno.body.id },
        data: { deletedAt: new Date() },
      })

      const listado = await get('/api/v1/apoderados', token)

      expect(listado.body.data[0].alumnos).toEqual([])
    })

    it('valida los datos del vínculo', async () => {
      const token = await tokenDe(['SUPER_ADMIN'])
      const apoderado = await crearApoderadoApi(token)

      const respuesta = await post(
        `/api/v1/apoderados/${apoderado.body.id}/alumnos`,
        token,
        {
          alumnoId: '00000000-0000-4000-8000-000000000099',
          parentesco: '   ',
        },
      )

      expect(respuesta.status).toBe(400)
    })

    it('mantiene un solo principal bajo vinculaciones concurrentes', async () => {
      const token = await tokenDe(['SUPER_ADMIN'])
      const alumno = await crearAlumnoApi(token)
      const primero = await crearApoderadoApi(token)
      const segundo = await crearApoderadoApi(token)

      const [r1, r2] = await Promise.all([
        post(`/api/v1/apoderados/${primero.body.id}/alumnos`, token, {
          alumnoId: alumno.body.id,
          parentesco: 'Madre',
          esPrincipal: true,
        }),
        post(`/api/v1/apoderados/${segundo.body.id}/alumnos`, token, {
          alumnoId: alumno.body.id,
          parentesco: 'Padre',
          esPrincipal: true,
        }),
      ])

      expect([r1.status, r2.status].sort()).toEqual([201, 201])

      const principales = await prisma.apoderadoAlumno.count({
        where: { alumnoId: alumno.body.id, esPrincipal: true },
      })

      expect(principales).toBe(1)
    }, 15_000)
  })
})
