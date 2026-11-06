import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { PrismaClient } from '../../src/generated/prisma/client.js'
import {
  createTestPrisma,
  limpiarBaseDePruebas,
} from '../helpers/test-db.js'

// Sin TEST_DATABASE_URL la suite se omite en lugar de fallar: las pruebas de
// integración necesitan la base aislada que documenta el README.
describe.skipIf(!process.env.TEST_DATABASE_URL)('integridad del modelo', () => {
  let prisma: PrismaClient

  beforeAll(() => {
    prisma = createTestPrisma()
  })

  beforeEach(async () => {
    await limpiarBaseDePruebas(prisma)
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  async function crearInstitucion() {
    return prisma.institucion.create({ data: { nombre: 'IE de Pruebas' } })
  }

  async function crearPersona(numeroDocumento = '12345678') {
    return prisma.persona.create({
      data: {
        nombres: 'Ana',
        apellidos: 'Pérez',
        tipoDocumento: 'DNI',
        numeroDocumento,
      },
    })
  }

  async function crearUsuario(
    personaId: string,
    datos: { username: string; email?: string },
  ) {
    return prisma.usuario.create({
      data: {
        personaId,
        username: datos.username,
        email: datos.email,
        passwordHash: '$argon2id$hash-de-prueba',
      },
    })
  }

  async function crearAnio(institucionId: string, nombre = '2026') {
    return prisma.anioAcademico.create({
      data: {
        institucionId,
        nombre,
        fechaInicio: new Date('2026-03-01'),
        fechaFin: new Date('2026-12-15'),
      },
    })
  }

  async function crearSeccion(anioId: string, nombre = 'A') {
    const institucion = await prisma.institucion.findFirstOrThrow()
    const nivel = await prisma.nivel.create({
      data: { institucionId: institucion.id, nombre: 'Primaria', orden: 1 },
    })
    const grado = await prisma.grado.create({
      data: { nivelId: nivel.id, nombre: 'Primero', orden: 1 },
    })

    return prisma.seccion.create({
      data: { gradoId: grado.id, anioId, nombre },
    })
  }

  describe('restricciones únicas', () => {
    it('rechaza dos personas con el mismo tipo y número de documento', async () => {
      await crearPersona('12345678')

      await expect(crearPersona('12345678')).rejects.toMatchObject({
        code: 'P2002',
      })
    })

    it('rechaza dos usuarios con el mismo username', async () => {
      const primera = await crearPersona('11111111')
      const segunda = await crearPersona('22222222')

      await crearUsuario(primera.id, { username: 'ana.perez' })

      await expect(
        crearUsuario(segunda.id, { username: 'ana.perez' }),
      ).rejects.toMatchObject({ code: 'P2002' })
    })

    it('rechaza dos usuarios con el mismo correo', async () => {
      const primera = await crearPersona('11111111')
      const segunda = await crearPersona('22222222')

      await crearUsuario(primera.id, {
        username: 'ana.perez',
        email: 'ana@ejemplo.edu.pe',
      })

      await expect(
        crearUsuario(segunda.id, {
          username: 'ana.perez.2',
          email: 'ana@ejemplo.edu.pe',
        }),
      ).rejects.toMatchObject({ code: 'P2002' })
    })

    it('rechaza dos períodos con el mismo orden dentro de un año', async () => {
      const institucion = await crearInstitucion()
      const anio = await crearAnio(institucion.id)
      const periodo = {
        anioId: anio.id,
        fechaInicio: new Date('2026-03-01'),
        fechaFin: new Date('2026-05-31'),
      }

      await prisma.periodoAcademico.create({
        data: { ...periodo, nombre: 'Bimestre 1', orden: 1 },
      })

      await expect(
        prisma.periodoAcademico.create({
          data: { ...periodo, nombre: 'Bimestre 2', orden: 1 },
        }),
      ).rejects.toMatchObject({ code: 'P2002' })
    })

    it('rechaza dos secciones con el mismo nombre en el mismo grado y año', async () => {
      const institucion = await crearInstitucion()
      const anio = await crearAnio(institucion.id)
      const seccion = await crearSeccion(anio.id, 'A')

      await expect(
        prisma.seccion.create({
          data: {
            gradoId: seccion.gradoId,
            anioId: anio.id,
            nombre: 'A',
          },
        }),
      ).rejects.toMatchObject({ code: 'P2002' })
    })
  })

  describe('claves foráneas', () => {
    it('rechaza una matrícula con un alumno inexistente', async () => {
      const institucion = await crearInstitucion()
      const anio = await crearAnio(institucion.id)
      const seccion = await crearSeccion(anio.id)

      await expect(
        prisma.matricula.create({
          data: {
            alumnoId: '00000000-0000-4000-8000-000000000099',
            seccionId: seccion.id,
            anioId: anio.id,
          },
        }),
      ).rejects.toMatchObject({ code: 'P2003' })
    })

    it('impide borrar una persona que tiene usuario (Restrict)', async () => {
      const persona = await crearPersona()
      await crearUsuario(persona.id, { username: 'ana.perez' })

      await expect(
        prisma.persona.delete({ where: { id: persona.id } }),
      ).rejects.toMatchObject({ code: 'P2003' })
    })

    it('elimina los roles del usuario al borrar el usuario (Cascade)', async () => {
      const persona = await crearPersona()
      const usuario = await crearUsuario(persona.id, { username: 'ana.perez' })
      const rol = await prisma.rol.create({
        data: { codigo: 'DOCENTE', nombre: 'Docente' },
      })

      await prisma.usuarioRol.create({
        data: { usuarioId: usuario.id, rolId: rol.id },
      })

      await prisma.usuario.delete({ where: { id: usuario.id } })

      await expect(
        prisma.usuarioRol.count({ where: { usuarioId: usuario.id } }),
      ).resolves.toBe(0)
    })

    it('anula la referencia de la auditoría al borrar el usuario (SetNull)', async () => {
      const persona = await crearPersona()
      const usuario = await crearUsuario(persona.id, { username: 'ana.perez' })

      await prisma.auditoria.create({
        data: { usuarioId: usuario.id, accion: 'CREAR', entidad: 'Usuario' },
      })

      await prisma.usuario.delete({ where: { id: usuario.id } })

      const auditoria = await prisma.auditoria.findFirstOrThrow()
      expect(auditoria.usuarioId).toBeNull()
    })
  })

  describe('borrado lógico', () => {
    it('conserva el registro marcado y lo excluye de las consultas activas', async () => {
      const persona = await crearPersona()
      const borradaEn = new Date()

      await prisma.persona.update({
        where: { id: persona.id },
        data: { deletedAt: borradaEn },
      })

      const encontrada = await prisma.persona.findUnique({
        where: { id: persona.id },
      })
      expect(encontrada?.deletedAt).toEqual(borradaEn)

      const activas = await prisma.persona.findMany({
        where: { id: persona.id, deletedAt: null },
      })
      expect(activas).toHaveLength(0)
    })

    it('no permite reutilizar el documento de una persona con borrado lógico', async () => {
      const persona = await crearPersona('12345678')

      await prisma.persona.update({
        where: { id: persona.id },
        data: { deletedAt: new Date() },
      })

      await expect(crearPersona('12345678')).rejects.toMatchObject({
        code: 'P2002',
      })
    })
  })
})
