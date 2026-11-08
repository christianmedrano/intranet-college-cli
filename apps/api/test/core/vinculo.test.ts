import type { PrismaClient } from '../../src/generated/prisma/client.js'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  assertApoderadoOfAlumno,
  assertDocenteAssignedTo,
  assertOwnAlumno,
} from '../../src/core/auth/vinculo.js'
import { createTestPrisma, limpiarBaseDePruebas } from '../helpers/test-db.js'

describe.skipIf(!process.env.TEST_DATABASE_URL)('guards de vínculo', () => {
  let prisma: ReturnType<typeof createTestPrisma>
  let secuencia = 0

  beforeAll(() => {
    prisma = createTestPrisma()
  })

  beforeEach(async () => {
    await limpiarBaseDePruebas(prisma)
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  function siguiente(): number {
    secuencia += 1
    return secuencia
  }

  async function crearPersona() {
    const n = siguiente()

    return prisma.persona.create({
      data: {
        nombres: `Persona ${n}`,
        apellidos: 'De Prueba',
        tipoDocumento: 'DNI',
        numeroDocumento: String(10_000_000 + n),
      },
    })
  }

  async function crearUsuario(
    personaId: string,
    activo = true,
    prismaCliente: PrismaClient = prisma,
  ) {
    const n = siguiente()

    return prismaCliente.usuario.create({
      data: {
        personaId,
        username: `usuario.${n}`,
        email: `usuario.${n}@ejemplo.edu.pe`,
        passwordHash: '$argon2id$hash-de-prueba',
        debeCambiarPassword: false,
        activo,
      },
    })
  }

  async function crearAlumnoConUsuario(activo = true) {
    const persona = await crearPersona()
    const usuario = await crearUsuario(persona.id, activo)
    const alumno = await prisma.alumno.create({
      data: {
        personaId: persona.id,
        codigoAlumno: `AL-${siguiente()}`,
      },
    })

    return { persona, usuario, alumno }
  }

  async function crearAlumnoSinUsuario() {
    const persona = await crearPersona()
    const alumno = await prisma.alumno.create({
      data: {
        personaId: persona.id,
        codigoAlumno: `AL-${siguiente()}`,
      },
    })

    return { persona, alumno }
  }

  async function crearDocenteConUsuario(activo = true) {
    const persona = await crearPersona()
    const usuario = await crearUsuario(persona.id, activo)
    const docente = await prisma.docente.create({
      data: {
        personaId: persona.id,
        codigoDocente: `DO-${siguiente()}`,
      },
    })

    return { persona, usuario, docente }
  }

  async function crearApoderadoConUsuario(activo = true) {
    const persona = await crearPersona()
    const usuario = await crearUsuario(persona.id, activo)
    const apoderado = await prisma.apoderado.create({
      data: {
        personaId: persona.id,
        ocupacion: 'Docente',
      },
    })

    return { persona, usuario, apoderado }
  }

  async function asignarRol(usuarioId: string, codigo: string): Promise<void> {
    const rol = await prisma.rol.upsert({
      where: { codigo },
      create: { codigo, nombre: codigo },
      update: {},
    })

    await prisma.usuarioRol.create({
      data: { usuarioId, rolId: rol.id },
    })
  }

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

    const otroAnio = await prisma.anioAcademico.create({
      data: {
        institucionId: institucion.id,
        nombre: '2025',
        fechaInicio: new Date('2025-03-01'),
        fechaFin: new Date('2025-12-15'),
      },
    })

    const nivel = await prisma.nivel.create({
      data: { institucionId: institucion.id, nombre: 'Primaria', orden: 1 },
    })

    const grado = await prisma.grado.create({
      data: { nivelId: nivel.id, nombre: '1.º', orden: 1 },
    })

    const seccionA = await prisma.seccion.create({
      data: { gradoId: grado.id, anioId: anio.id, nombre: 'A' },
    })

    const seccionB = await prisma.seccion.create({
      data: { gradoId: grado.id, anioId: anio.id, nombre: 'B' },
    })

    const curso = await prisma.curso.create({
      data: { nivelId: nivel.id, nombre: 'Matemática', orden: 1 },
    })

    const otroCurso = await prisma.curso.create({
      data: { nivelId: nivel.id, nombre: 'Comunicación', orden: 2 },
    })

    return {
      anio,
      otroAnio,
      seccionA,
      seccionB,
      curso,
      otroCurso,
    }
  }

  describe('assertApoderadoOfAlumno', () => {
    it('permite el acceso al hijo del apoderado', async () => {
      const padre = await crearApoderadoConUsuario()
      const hijo = await crearAlumnoSinUsuario()

      await prisma.apoderadoAlumno.create({
        data: {
          apoderadoId: padre.apoderado.id,
          alumnoId: hijo.alumno.id,
          parentesco: 'Madre',
          esPrincipal: true,
        },
      })

      await expect(
        assertApoderadoOfAlumno(padre.usuario.id, hijo.alumno.id),
      ).resolves.toBeUndefined()
    })

    it('evalúa el vínculo de apoderado aunque el usuario también sea docente', async () => {
      const padre = await crearApoderadoConUsuario()
      await asignarRol(padre.usuario.id, 'DOCENTE')
      await asignarRol(padre.usuario.id, 'APODERADO')

      const hijo = await crearAlumnoSinUsuario()

      await prisma.apoderadoAlumno.create({
        data: {
          apoderadoId: padre.apoderado.id,
          alumnoId: hijo.alumno.id,
          parentesco: 'Padre',
          esPrincipal: true,
        },
      })

      await expect(
        assertApoderadoOfAlumno(padre.usuario.id, hijo.alumno.id),
      ).resolves.toBeUndefined()
    })

    it('rechaza al docente sin vínculo aunque tenga el rol DOCENTE', async () => {
      const docente = await crearDocenteConUsuario()
      await asignarRol(docente.usuario.id, 'DOCENTE')

      const alumno = await crearAlumnoSinUsuario()

      await expect(
        assertApoderadoOfAlumno(docente.usuario.id, alumno.alumno.id),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    })

    it('rechaza a un apoderado ajeno con 403', async () => {
      const padre = await crearApoderadoConUsuario()
      const otroPadre = await crearApoderadoConUsuario()
      const hijo = await crearAlumnoSinUsuario()

      await prisma.apoderadoAlumno.create({
        data: {
          apoderadoId: otroPadre.apoderado.id,
          alumnoId: hijo.alumno.id,
          parentesco: 'Padre',
          esPrincipal: true,
        },
      })

      await expect(
        assertApoderadoOfAlumno(padre.usuario.id, hijo.alumno.id),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    })

    it('rechaza a un usuario que no es apoderado', async () => {
      const alumno = await crearAlumnoConUsuario()
      const otroAlumno = await crearAlumnoSinUsuario()

      await expect(
        assertApoderadoOfAlumno(alumno.usuario.id, otroAlumno.alumno.id),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    })

    it('rechaza si la cuenta del apoderado está inactiva', async () => {
      const padre = await crearApoderadoConUsuario(false)
      const hijo = await crearAlumnoSinUsuario()

      await prisma.apoderadoAlumno.create({
        data: {
          apoderadoId: padre.apoderado.id,
          alumnoId: hijo.alumno.id,
          parentesco: 'Madre',
        },
      })

      await expect(
        assertApoderadoOfAlumno(padre.usuario.id, hijo.alumno.id),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    })

    it('rechaza si el alumno tiene borrado lógico', async () => {
      const padre = await crearApoderadoConUsuario()
      const hijo = await crearAlumnoSinUsuario()

      await prisma.apoderadoAlumno.create({
        data: {
          apoderadoId: padre.apoderado.id,
          alumnoId: hijo.alumno.id,
          parentesco: 'Madre',
        },
      })

      await prisma.alumno.update({
        where: { id: hijo.alumno.id },
        data: { deletedAt: new Date() },
      })

      await expect(
        assertApoderadoOfAlumno(padre.usuario.id, hijo.alumno.id),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    })
  })

  describe('assertDocenteAssignedTo', () => {
    it('permite el acceso con la asignación exacta', async () => {
      const docente = await crearDocenteConUsuario()
      const estructura = await crearEstructura()

      await prisma.asignacionDocente.create({
        data: {
          docenteId: docente.docente.id,
          cursoId: estructura.curso.id,
          seccionId: estructura.seccionA.id,
          anioId: estructura.anio.id,
        },
      })

      await expect(
        assertDocenteAssignedTo(docente.usuario.id, {
          cursoId: estructura.curso.id,
          seccionId: estructura.seccionA.id,
          anioId: estructura.anio.id,
        }),
      ).resolves.toBeUndefined()
    })

    it('rechaza una sección no asignada', async () => {
      const docente = await crearDocenteConUsuario()
      const estructura = await crearEstructura()

      await prisma.asignacionDocente.create({
        data: {
          docenteId: docente.docente.id,
          cursoId: estructura.curso.id,
          seccionId: estructura.seccionA.id,
          anioId: estructura.anio.id,
        },
      })

      await expect(
        assertDocenteAssignedTo(docente.usuario.id, {
          cursoId: estructura.curso.id,
          seccionId: estructura.seccionB.id,
          anioId: estructura.anio.id,
        }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    })

    it('rechaza un curso no asignado', async () => {
      const docente = await crearDocenteConUsuario()
      const estructura = await crearEstructura()

      await prisma.asignacionDocente.create({
        data: {
          docenteId: docente.docente.id,
          cursoId: estructura.curso.id,
          seccionId: estructura.seccionA.id,
          anioId: estructura.anio.id,
        },
      })

      await expect(
        assertDocenteAssignedTo(docente.usuario.id, {
          cursoId: estructura.otroCurso.id,
          seccionId: estructura.seccionA.id,
          anioId: estructura.anio.id,
        }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    })

    it('rechaza un año distinto al de la asignación', async () => {
      const docente = await crearDocenteConUsuario()
      const estructura = await crearEstructura()

      await prisma.asignacionDocente.create({
        data: {
          docenteId: docente.docente.id,
          cursoId: estructura.curso.id,
          seccionId: estructura.seccionA.id,
          anioId: estructura.anio.id,
        },
      })

      await expect(
        assertDocenteAssignedTo(docente.usuario.id, {
          cursoId: estructura.curso.id,
          seccionId: estructura.seccionA.id,
          anioId: estructura.otroAnio.id,
        }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    })

    it('rechaza a un docente sin ninguna asignación', async () => {
      const docente = await crearDocenteConUsuario()
      const estructura = await crearEstructura()

      await expect(
        assertDocenteAssignedTo(docente.usuario.id, {
          cursoId: estructura.curso.id,
          seccionId: estructura.seccionA.id,
          anioId: estructura.anio.id,
        }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    })

    it('rechaza si la cuenta del docente está inactiva', async () => {
      const docente = await crearDocenteConUsuario(false)
      const estructura = await crearEstructura()

      await prisma.asignacionDocente.create({
        data: {
          docenteId: docente.docente.id,
          cursoId: estructura.curso.id,
          seccionId: estructura.seccionA.id,
          anioId: estructura.anio.id,
        },
      })

      await expect(
        assertDocenteAssignedTo(docente.usuario.id, {
          cursoId: estructura.curso.id,
          seccionId: estructura.seccionA.id,
          anioId: estructura.anio.id,
        }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    })
  })

  describe('assertOwnAlumno', () => {
    it('permite el acceso al propio alumno', async () => {
      const alumno = await crearAlumnoConUsuario()

      await expect(
        assertOwnAlumno(alumno.usuario.id, alumno.alumno.id),
      ).resolves.toBeUndefined()
    })

    it('rechaza el alumno de otra persona', async () => {
      const alumno = await crearAlumnoConUsuario()
      const otroAlumno = await crearAlumnoConUsuario()

      await expect(
        assertOwnAlumno(alumno.usuario.id, otroAlumno.alumno.id),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    })

    it('rechaza a un usuario que no tiene ficha de alumno', async () => {
      const apoderado = await crearApoderadoConUsuario()
      const alumno = await crearAlumnoSinUsuario()

      await expect(
        assertOwnAlumno(apoderado.usuario.id, alumno.alumno.id),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    })

    it('rechaza si la cuenta del alumno está inactiva', async () => {
      const alumno = await crearAlumnoConUsuario(false)

      await expect(
        assertOwnAlumno(alumno.usuario.id, alumno.alumno.id),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    })

    it('rechaza si el alumno tiene borrado lógico', async () => {
      const alumno = await crearAlumnoConUsuario()

      await prisma.alumno.update({
        where: { id: alumno.alumno.id },
        data: { deletedAt: new Date() },
      })

      await expect(
        assertOwnAlumno(alumno.usuario.id, alumno.alumno.id),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    })
  })
})
