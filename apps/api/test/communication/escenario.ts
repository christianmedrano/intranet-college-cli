import type { RoleCode } from '@intranet/shared'
import { signAccessToken } from '../../src/core/auth/tokens.js'
import type { PrismaClient } from '../../src/generated/prisma/client.js'

/** Institución fija creada por `limpiarBaseDePruebas`. */
export const INSTITUCION_ID = '00000000-0000-4000-8000-000000000001'

/** Actor autenticado listo para pruebas de servicio o de ruta. */
export interface ActorPrueba {
  usuarioId: string
  personaId: string
  token: string
}

function documentoUnico(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 30)
}

/** Crea una persona con usuario, roles y token de acceso. */
export async function crearActor(
  prisma: PrismaClient,
  roles: readonly RoleCode[],
): Promise<ActorPrueba> {
  const persona = await prisma.persona.create({
    data: {
      nombres: 'Persona',
      apellidos: 'De Prueba',
      tipoDocumento: 'DNI',
      numeroDocumento: documentoUnico(),
    },
  })

  const usuario = await prisma.usuario.create({
    data: {
      personaId: persona.id,
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

  return { usuarioId: usuario.id, personaId: persona.id, token }
}

/** Escenario de comunicación: dos secciones, un tutor, un alumno y un apoderado. */
export interface EscenarioComunicacion {
  anioId: string
  nivelId: string
  gradoId: string
  cursoId: string
  seccionAId: string
  seccionBId: string
  docenteTutor: ActorPrueba
  docenteNoTutor: ActorPrueba
  alumnoA: ActorPrueba
  apoderadoA: ActorPrueba
  apoderadoSinVinculo: ActorPrueba
  director: ActorPrueba
  superAdmin: ActorPrueba
  anuncioInstitucionalId: string
  anuncioBorradorId: string
  anuncioPorNivelId: string
  anuncioSeccionAId: string
  anuncioSeccionBId: string
  hiloSeccionAId: string
}

/**
 * Crea el escenario base de comunicación.
 *
 * - Docente tutor de la sección A y docente no tutor de la sección B.
 * - Alumno matriculado (`APROBADA`) en A y su apoderado principal.
 * - Un apoderado sin vínculo.
 * - Anuncios institucionales (publicado, borrador, por nivel) y de sección A/B.
 * - Hilo de mensajería de la sección A (la B queda sin hilo a propósito).
 */
export async function crearEscenarioComunicacion(
  prisma: PrismaClient,
): Promise<EscenarioComunicacion> {
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

  const docenteTutor = await crearActor(prisma, ['DOCENTE'])
  const fichaTutor = await prisma.docente.create({
    data: {
      personaId: docenteTutor.personaId,
      codigoDocente: `DOC-${crypto.randomUUID().slice(0, 8)}`,
    },
  })

  await prisma.asignacionDocente.create({
    data: {
      docenteId: fichaTutor.id,
      cursoId: curso.id,
      seccionId: seccionA.id,
      anioId: anio.id,
      esTutor: true,
    },
  })

  const docenteNoTutor = await crearActor(prisma, ['DOCENTE'])
  const fichaNoTutor = await prisma.docente.create({
    data: {
      personaId: docenteNoTutor.personaId,
      codigoDocente: `DOC-${crypto.randomUUID().slice(0, 8)}`,
    },
  })

  await prisma.asignacionDocente.create({
    data: {
      docenteId: fichaNoTutor.id,
      cursoId: curso.id,
      seccionId: seccionB.id,
      anioId: anio.id,
      esTutor: false,
    },
  })

  const alumnoA = await crearActor(prisma, ['ALUMNO'])
  const fichaAlumno = await prisma.alumno.create({
    data: {
      personaId: alumnoA.personaId,
      codigoAlumno: `AL-${crypto.randomUUID().slice(0, 8)}`,
    },
  })

  await prisma.matricula.create({
    data: {
      alumnoId: fichaAlumno.id,
      seccionId: seccionA.id,
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
      alumnoId: fichaAlumno.id,
      parentesco: 'Madre',
      esPrincipal: true,
    },
  })

  const apoderadoSinVinculo = await crearActor(prisma, ['APODERADO'])
  await prisma.apoderado.create({ data: { personaId: apoderadoSinVinculo.personaId } })

  const director = await crearActor(prisma, ['DIRECTOR'])
  const superAdmin = await crearActor(prisma, ['SUPER_ADMIN'])

  const base = {
    institucionId: INSTITUCION_ID,
    autorId: director.usuarioId,
    cuerpo: 'Cuerpo del anuncio de prueba',
    anioId: anio.id,
  }

  const anuncioInstitucional = await prisma.anuncio.create({
    data: {
      ...base,
      titulo: 'Institucional publicado',
      tipo: 'INSTITUCIONAL',
      estado: 'PUBLICADO',
      publicadoEn: new Date('2026-03-02T10:00:00.000Z'),
      audienciaRoles: ['APODERADO', 'ALUMNO'],
    },
  })

  const anuncioBorrador = await prisma.anuncio.create({
    data: {
      ...base,
      titulo: 'Institucional en borrador',
      tipo: 'INSTITUCIONAL',
      estado: 'BORRADOR',
      audienciaRoles: ['APODERADO', 'ALUMNO'],
    },
  })

  const anuncioPorNivel = await prisma.anuncio.create({
    data: {
      ...base,
      titulo: 'Institucional por nivel',
      tipo: 'INSTITUCIONAL',
      estado: 'PUBLICADO',
      publicadoEn: new Date('2026-03-03T10:00:00.000Z'),
      audienciaNiveles: [nivel.id],
    },
  })

  const anuncioSeccionA = await prisma.anuncio.create({
    data: {
      ...base,
      titulo: 'Anuncio de la sección A',
      tipo: 'SECCION',
      estado: 'PUBLICADO',
      publicadoEn: new Date('2026-03-04T10:00:00.000Z'),
      audienciaSecciones: [seccionA.id],
    },
  })

  const anuncioSeccionB = await prisma.anuncio.create({
    data: {
      ...base,
      titulo: 'Anuncio de la sección B',
      tipo: 'SECCION',
      estado: 'PUBLICADO',
      publicadoEn: new Date('2026-03-05T10:00:00.000Z'),
      audienciaSecciones: [seccionB.id],
    },
  })

  const hilo = await prisma.hiloMensajeria.create({
    data: { seccionId: seccionA.id },
  })

  return {
    anioId: anio.id,
    nivelId: nivel.id,
    gradoId: grado.id,
    cursoId: curso.id,
    seccionAId: seccionA.id,
    seccionBId: seccionB.id,
    docenteTutor,
    docenteNoTutor,
    alumnoA,
    apoderadoA,
    apoderadoSinVinculo,
    director,
    superAdmin,
    anuncioInstitucionalId: anuncioInstitucional.id,
    anuncioBorradorId: anuncioBorrador.id,
    anuncioPorNivelId: anuncioPorNivel.id,
    anuncioSeccionAId: anuncioSeccionA.id,
    anuncioSeccionBId: anuncioSeccionB.id,
    hiloSeccionAId: hilo.id,
  }
}
