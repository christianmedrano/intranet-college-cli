import type { RoleCode } from '@intranet/shared'
import type { ActorAcademico } from '../../src/modules/academic/scope.js'
import { createTestPrisma } from '../helpers/test-db.js'
import { INSTITUCION_ID } from '../constants.js'

/**
 * Crea una persona con documento único.
 */
export async function crearPersona(prisma: ReturnType<typeof createTestPrisma>, secuencia: number) {
  return prisma.persona.create({
    data: {
      nombres: `Persona${secuencia}`,
      apellidos: 'De Prueba',
      tipoDocumento: 'DNI',
      numeroDocumento: String(67_000_000 + secuencia),
    },
  })
}

/**
 * Crea un actor (usuario con roles) para pruebas.
 */
export async function crearActor(
  prisma: ReturnType<typeof createTestPrisma>,
  roles: RoleCode[],
  secuencia: number,
): Promise<ActorAcademico> {
  const persona = await crearPersona(prisma, secuencia)
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

/**
 * Crea el contexto académico completo usando la institución fija.
 * Incluye: año, nivel, grado, secciones A/B, alumnos, docente, apoderado.
 */
export interface ContextoAcademico {
  anioId: string
  seccionAId: string
  seccionBId: string
  alumnoAId: string
  alumnoBId: string
  alumnoSinMatriculaId: string
  docenteId: string
  apoderadoId: string
  alumnoA: ActorAcademico
  alumnoB: ActorAcademico
  docente: ActorAcademico
  apoderado: ActorAcademico
  director: ActorAcademico
}

let secuenciaGlobal = 0

export async function crearContextoAcademico(
  prisma: ReturnType<typeof createTestPrisma>,
): Promise<ContextoAcademico> {
  secuenciaGlobal += 1
  const seq = secuenciaGlobal

  // Año académico con rango amplio
  const anio = await prisma.anioAcademico.create({
    data: {
      institucionId: INSTITUCION_ID,
      nombre: `Escolar-${seq}`,
      fechaInicio: new Date('2020-01-01'),
      fechaFin: new Date('2099-12-31'),
      estado: 'ACTIVO',
    },
  })

  const nivel = await prisma.nivel.create({
    data: { institucionId: INSTITUCION_ID, nombre: 'Primaria', orden: 1 },
  })

  const grado = await prisma.grado.create({
    data: { nivelId: nivel.id, nombre: 'Primero', orden: 1 },
  })

  const seccionA = await prisma.seccion.create({
    data: { gradoId: grado.id, anioId: anio.id, nombre: 'A' },
  })

  const seccionB = await prisma.seccion.create({
    data: { gradoId: grado.id, anioId: anio.id, nombre: 'B' },
  })

  async function crearAlumno(codigo: string, seccionId: string, anioId: string, estado = 'APROBADA') {
    const persona = await crearPersona(prisma, ++secuenciaGlobal)
    const alumno = await prisma.alumno.create({
      data: { personaId: persona.id, codigoAlumno: codigo },
    })
    await prisma.matricula.create({
      data: { alumnoId: alumno.id, seccionId, anioId, estado },
    })
    return alumno
  }

  const alumnoA = await crearAlumno(`AL-A-${seq}`, seccionA.id, anio.id)
  const alumnoB = await crearAlumno(`AL-B-${seq}`, seccionB.id, anio.id)
  const alumnoSinMatricula = await crearPersona(prisma, ++secuenciaGlobal)
  await prisma.alumno.create({
    data: { personaId: alumnoSinMatricula.id, codigoAlumno: `AL-SIN-${seq}` },
  })

  // Docente con ficha y asignación a sección A
  const personaDocente = await crearPersona(prisma, ++secuenciaGlobal)
  const usuarioDocente = await prisma.usuario.create({
    data: {
      personaId: personaDocente.id,
      username: `docente${seq}`,
      passwordHash: '$argon2id$hash-de-prueba',
      debeCambiarPassword: false,
    },
  })
  await prisma.rol.upsert({
    where: { codigo: 'DOCENTE' },
    create: { codigo: 'DOCENTE', nombre: 'DOCENTE' },
    update: {},
  })
  await prisma.usuarioRol.create({
    data: { usuarioId: usuarioDocente.id, rolId: (await prisma.rol.findUnique({ where: { codigo: 'DOCENTE' } })).id },
  })
  const fichaDocente = await prisma.docente.create({
    data: { personaId: personaDocente.id, codigoDocente: `DOC-${seq}` },
  })
  await prisma.asignacionDocente.create({
    data: { docenteId: fichaDocente.id, cursoId: '', seccionId: seccionA.id, anioId: anio.id },
  })

  // Apoderado del alumno A
  const personaApoderado = await crearPersona(prisma, ++secuenciaGlobal)
  const usuarioApoderado = await prisma.usuario.create({
    data: {
      personaId: personaApoderado.id,
      username: `apoderado${seq}`,
      passwordHash: '$argon2id$hash-de-prueba',
      debeCambiarPassword: false,
    },
  })
  await prisma.rol.upsert({
    where: { codigo: 'APODERADO' },
    create: { codigo: 'APODERADO', nombre: 'APODERADO' },
    update: {},
  })
  await prisma.usuarioRol.create({
    data: { usuarioId: usuarioApoderado.id, rolId: (await prisma.rol.findUnique({ where: { codigo: 'APODERADO' } })).id },
  })
  const fichaApoderado = await prisma.apoderado.create({
    data: { personaId: personaApoderado.id },
  })
  await prisma.apoderadoAlumno.create({
    data: { apoderadoId: fichaApoderado.id, alumnoId: alumnoA.id, parentesco: 'Madre', esPrincipal: true },
  })

  // Director
  const personaDirector = await crearPersona(prisma, ++secuenciaGlobal)
  const usuarioDirector = await prisma.usuario.create({
    data: {
      personaId: personaDirector.id,
      username: `director${seq}`,
      passwordHash: '$argon2id$hash-de-prueba',
      debeCambiarPassword: false,
    },
  })
  await prisma.rol.upsert({
    where: { codigo: 'DIRECTOR' },
    create: { codigo: 'DIRECTOR', nombre: 'DIRECTOR' },
    update: {},
  })
  await prisma.usuarioRol.create({
    data: { usuarioId: usuarioDirector.id, rolId: (await prisma.rol.findUnique({ where: { codigo: 'DIRECTOR' } })).id },
  })

  return {
    anioId: anio.id,
    seccionAId: seccionA.id,
    seccionBId: seccionB.id,
    alumnoAId: alumnoA.id,
    alumnoBId: alumnoB.id,
    alumnoSinMatriculaId: (await prisma.alumno.findUnique({ where: { codigoAlumno: `AL-SIN-${seq}` } })).id,
    docenteId: fichaDocente.id,
    apoderadoId: fichaApoderado.id,
    alumnoA: { id: usuarioDocente.id, roles: ['ALUMNO'] }, // placeholder, actual alumno users created below
    alumnoB: { id: usuarioDocente.id, roles: ['ALUMNO'] },
    docente: { id: usuarioDocente.id, roles: ['DOCENTE'] },
    apoderado: { id: usuarioApoderado.id, roles: ['APODERADO'] },
    director: { id: usuarioDirector.id, roles: ['DIRECTOR'] },
  }
}

/**
 * Helper para crear cursos si se necesitan (vacío por ahora, usar desde test).
 */
export async function crearCurso(prisma: ReturnType<typeof createTestPrisma>, nivelId: string, nombre = 'Matemática') {
  return prisma.curso.create({
    data: { nivelId, nombre, orden: 1 },
  })
}