import type { RoleCode } from '@intranet/shared'
import { signAccessToken } from '../../src/core/auth/tokens.js'
import type { PrismaClient } from '../../src/generated/prisma/client.js'

/**
 * Institución fija creada por `limpiarBaseDePruebas`.
 *
 * Los escenarios deben colgar de ella: el guard de autenticación resuelve la
 * primera institución vigente y los repositorios filtran por `institucionId`.
 */
export const INSTITUCION_ID = '00000000-0000-4000-8000-000000000001'

/** Actor autenticado listo para pruebas de servicio o de ruta. */
export interface ActorPrueba {
  usuarioId: string
  personaId: string
  token: string
}

/** Genera un documento único sin depender de contadores globales. */
function documentoUnico(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 30)
}

async function crearPersona(prisma: PrismaClient) {
  return prisma.persona.create({
    data: {
      nombres: 'Persona',
      apellidos: 'De Prueba',
      tipoDocumento: 'DNI',
      numeroDocumento: documentoUnico(),
    },
  })
}

/** Crea una persona con usuario, roles y token de acceso. */
export async function crearActor(
  prisma: PrismaClient,
  roles: readonly RoleCode[],
  personaId?: string,
): Promise<ActorPrueba> {
  const idPersona = personaId ?? (await crearPersona(prisma)).id

  const usuario = await prisma.usuario.create({
    data: {
      personaId: idPersona,
      username: `usuario.${crypto.randomUUID().slice(0, 8)}`,
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

  const { token } = await signAccessToken(usuario.id)

  return { usuarioId: usuario.id, personaId: idPersona, token }
}

/** Escenario completo del aula virtual (un año, dos secciones, tres materiales). */
export interface EscenarioVirtual {
  anioId: string
  periodoId: string
  cursoId: string
  seccionAId: string
  seccionBId: string
  docenteAId: string
  docenteBId: string
  alumnoAId: string
  materialAId: string
  materialBId: string
  materialEliminadoId: string
  docenteA: ActorPrueba
  docenteB: ActorPrueba
  docenteSinAsignacion: ActorPrueba
  director: ActorPrueba
  superAdmin: ActorPrueba
  alumnoA: ActorPrueba
  alumnoB: ActorPrueba
  apoderadoA: ActorPrueba
  sinRoles: ActorPrueba
}

/**
 * Crea el escenario base: docente A asignado a la sección A, docente B a la
 * sección B, alumno A/B matriculados, apoderado de A y materiales en ambas
 * secciones más uno eliminado lógicamente.
 */
export async function crearEscenarioVirtual(
  prisma: PrismaClient,
): Promise<EscenarioVirtual> {
  const anio = await prisma.anioAcademico.create({
    data: {
      institucionId: INSTITUCION_ID,
      nombre: `2026-${crypto.randomUUID().slice(0, 6)}`,
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

  const seccionA = await prisma.seccion.create({
    data: { gradoId: grado.id, anioId: anio.id, nombre: 'A' },
  })

  const seccionB = await prisma.seccion.create({
    data: { gradoId: grado.id, anioId: anio.id, nombre: 'B' },
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
      estado: 'ACTIVO',
    },
  })

  const docenteA = await crearActor(prisma, ['DOCENTE'])
  const fichaDocenteA = await prisma.docente.create({
    data: {
      personaId: docenteA.personaId,
      codigoDocente: `DOC-${crypto.randomUUID().slice(0, 8)}`,
    },
  })

  await prisma.asignacionDocente.create({
    data: {
      docenteId: fichaDocenteA.id,
      cursoId: curso.id,
      seccionId: seccionA.id,
      anioId: anio.id,
    },
  })

  const docenteB = await crearActor(prisma, ['DOCENTE'])
  const fichaDocenteB = await prisma.docente.create({
    data: {
      personaId: docenteB.personaId,
      codigoDocente: `DOC-${crypto.randomUUID().slice(0, 8)}`,
    },
  })

  await prisma.asignacionDocente.create({
    data: {
      docenteId: fichaDocenteB.id,
      cursoId: curso.id,
      seccionId: seccionB.id,
      anioId: anio.id,
    },
  })

  const docenteSinAsignacion = await crearActor(prisma, ['DOCENTE'])
  await prisma.docente.create({
    data: {
      personaId: docenteSinAsignacion.personaId,
      codigoDocente: `DOC-${crypto.randomUUID().slice(0, 8)}`,
    },
  })

  const alumnoA = await crearActor(prisma, ['ALUMNO'])
  const fichaAlumnoA = await prisma.alumno.create({
    data: {
      personaId: alumnoA.personaId,
      codigoAlumno: `AL-${crypto.randomUUID().slice(0, 8)}`,
    },
  })

  await prisma.matricula.create({
    data: {
      alumnoId: fichaAlumnoA.id,
      seccionId: seccionA.id,
      anioId: anio.id,
      estado: 'APROBADA',
    },
  })

  const alumnoB = await crearActor(prisma, ['ALUMNO'])
  const fichaAlumnoB = await prisma.alumno.create({
    data: {
      personaId: alumnoB.personaId,
      codigoAlumno: `AL-${crypto.randomUUID().slice(0, 8)}`,
    },
  })

  await prisma.matricula.create({
    data: {
      alumnoId: fichaAlumnoB.id,
      seccionId: seccionB.id,
      anioId: anio.id,
      estado: 'APROBADA',
    },
  })

  const apoderadoA = await crearActor(prisma, ['APODERADO'])
  const fichaApoderado = await prisma.apoderado.create({
    data: { personaId: apoderadoA.personaId },
  })

  await prisma.apoderadoAlumno.create({
    data: {
      apoderadoId: fichaApoderado.id,
      alumnoId: fichaAlumnoA.id,
      parentesco: 'Madre',
      esPrincipal: true,
    },
  })

  const director = await crearActor(prisma, ['DIRECTOR'])
  const superAdmin = await crearActor(prisma, ['SUPER_ADMIN'])
  const sinRoles = await crearActor(prisma, [])

  const base = {
    periodoId: periodo.id,
    anioId: anio.id,
    docenteId: fichaDocenteA.id,
    archivoNombre: 'material.pdf',
    archivoMime: 'application/pdf',
    tamanoBytes: 2048,
    archivoRuta: 'uploads/virtual/material.pdf',
  }

  const materialA = await prisma.materialVirtual.create({
    data: {
      ...base,
      cursoId: curso.id,
      seccionId: seccionA.id,
      titulo: 'Material de la sección A',
      descripcion: 'Contenido de A',
    },
  })

  const materialB = await prisma.materialVirtual.create({
    data: {
      ...base,
      cursoId: curso.id,
      seccionId: seccionB.id,
      docenteId: fichaDocenteB.id,
      titulo: 'Material de la sección B',
      descripcion: 'Contenido de B',
    },
  })

  const materialEliminado = await prisma.materialVirtual.create({
    data: {
      ...base,
      cursoId: curso.id,
      seccionId: seccionA.id,
      titulo: 'Material eliminado',
      descripcion: null,
      deletedAt: new Date(),
    },
  })

  return {
    anioId: anio.id,
    periodoId: periodo.id,
    cursoId: curso.id,
    seccionAId: seccionA.id,
    seccionBId: seccionB.id,
    docenteAId: fichaDocenteA.id,
    docenteBId: fichaDocenteB.id,
    alumnoAId: fichaAlumnoA.id,
    materialAId: materialA.id,
    materialBId: materialB.id,
    materialEliminadoId: materialEliminado.id,
    docenteA,
    docenteB,
    docenteSinAsignacion,
    director,
    superAdmin,
    alumnoA,
    alumnoB,
    apoderadoA,
    sinRoles,
  }
}
