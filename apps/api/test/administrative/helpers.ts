import { signAccessToken } from '../../src/core/auth/tokens.js'
import type { PrismaClient } from '../../src/generated/prisma/client.js'
import { INSTITUCION_ID } from '../constants.js'

let secuencia = 0
let documentos = 0
let certificados = 0

/** Documento único para personas creadas dentro de una misma prueba. */
export function siguienteDocumento(): string {
  documentos += 1

  return String(80_000_000 + documentos)
}

/** Crea un usuario para una persona existente y le asigna los roles dados. */
export async function crearUsuarioParaPersona(
  prisma: PrismaClient,
  personaId: string,
  roles: readonly string[],
) {
  secuencia += 1

  const usuario = await prisma.usuario.create({
    data: {
      personaId,
      username: `admin.usuario.${secuencia}`,
      email: `admin.usuario.${secuencia}@ejemplo.edu.pe`,
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

/** Crea una persona con usuario y roles. */
export async function crearUsuarioConRoles(
  prisma: PrismaClient,
  roles: readonly string[],
) {
  const documento = siguienteDocumento()
  const persona = await prisma.persona.create({
    data: {
      nombres: `Usuario${documento}`,
      apellidos: 'De Prueba',
      tipoDocumento: 'DNI',
      numeroDocumento: documento,
    },
  })

  return crearUsuarioParaPersona(prisma, persona.id, roles)
}

/** Crea un usuario con roles y devuelve su token de acceso. */
export async function tokenDe(
  prisma: PrismaClient,
  roles: readonly string[],
) {
  const usuario = await crearUsuarioConRoles(prisma, roles)
  const { token } = await signAccessToken(usuario.id)

  return { usuario, token }
}

/** Estructura mínima: nivel, grado, año y sección. */
export async function crearEstructura(
  prisma: PrismaClient,
  opciones: { capacidad?: number; estadoAnio?: string; nombreAnio?: string } = {},
) {
  const nivel = await prisma.nivel.create({
    data: { institucionId: INSTITUCION_ID, nombre: 'Primaria', orden: 1 },
  })
  const grado = await prisma.grado.create({
    data: { nivelId: nivel.id, nombre: '1.°', orden: 1 },
  })
  const nombreAnio = opciones.nombreAnio ?? '2026'
  const anio = await prisma.anioAcademico.create({
    data: {
      institucionId: INSTITUCION_ID,
      nombre: nombreAnio,
      fechaInicio: new Date(`${nombreAnio}-03-01T00:00:00.000Z`),
      fechaFin: new Date(`${nombreAnio}-12-15T00:00:00.000Z`),
      estado: opciones.estadoAnio ?? 'ACTIVO',
    },
  })
  const seccion = await prisma.seccion.create({
    data: {
      gradoId: grado.id,
      anioId: anio.id,
      nombre: 'A',
      capacidad: opciones.capacidad ?? null,
    },
  })

  return { nivel, grado, anio, seccion }
}

/** Crea un alumno con su persona. */
export async function crearAlumno(
  prisma: PrismaClient,
  opciones: { nombres?: string; apellidos?: string } = {},
) {
  const documento = siguienteDocumento()
  const persona = await prisma.persona.create({
    data: {
      nombres: opciones.nombres ?? 'Ana',
      apellidos: opciones.apellidos ?? 'Quispe Rojas',
      tipoDocumento: 'DNI',
      numeroDocumento: documento,
    },
  })

  return prisma.alumno.create({
    data: {
      personaId: persona.id,
      codigoAlumno: `AL-${documento}`,
    },
    include: { persona: true },
  })
}

/** Crea un apoderado principal sin usuario asociado. */
export async function crearApoderadoPrincipal(
  prisma: PrismaClient,
  alumnoId: string,
) {
  const documento = siguienteDocumento()
  const persona = await prisma.persona.create({
    data: {
      nombres: 'Rosa',
      apellidos: 'Mendoza',
      tipoDocumento: 'DNI',
      numeroDocumento: documento,
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

/** Crea un alumno cuyo usuario autenticado tiene rol ALUMNO. */
export async function crearAlumnoConUsuario(prisma: PrismaClient) {
  const documento = siguienteDocumento()
  const persona = await prisma.persona.create({
    data: {
      nombres: 'Luis',
      apellidos: 'Alumno Propio',
      tipoDocumento: 'DNI',
      numeroDocumento: documento,
    },
  })

  const usuario = await crearUsuarioParaPersona(prisma, persona.id, ['ALUMNO'])
  const alumno = await prisma.alumno.create({
    data: {
      personaId: persona.id,
      codigoAlumno: `AL-${documento}`,
    },
    include: { persona: true },
  })
  const { token } = await signAccessToken(usuario.id)

  return { alumno, usuario, token }
}

/** Crea un apoderado con usuario autenticado vinculado a un alumno. */
export async function crearApoderadoConUsuario(
  prisma: PrismaClient,
  alumnoId: string,
) {
  const documento = siguienteDocumento()
  const persona = await prisma.persona.create({
    data: {
      nombres: 'Rosa',
      apellidos: 'Mendoza',
      tipoDocumento: 'DNI',
      numeroDocumento: documento,
    },
  })

  const usuario = await crearUsuarioParaPersona(prisma, persona.id, ['APODERADO'])
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

  const { token } = await signAccessToken(usuario.id)

  return { apoderado, usuario, token }
}

/** Crea una plantilla de certificado directa en la base. */
export async function crearPlantilla(
  prisma: PrismaClient,
  opciones: {
    tipo?: string
    contenido?: string
    activa?: boolean
    nombre?: string
    version?: number
  } = {},
) {
  return prisma.plantillaCertificado.create({
    data: {
      tipo: opciones.tipo ?? 'ESTUDIOS',
      nombre: opciones.nombre ?? 'Plantilla de prueba',
      contenido:
        opciones.contenido ??
        'Certificado de {{alumno}} correspondiente al año {{anio}}',
      activa: opciones.activa ?? true,
      version: opciones.version ?? 1,
    },
  })
}

/** Crea un pago directo en la base. */
export async function crearPago(
  prisma: PrismaClient,
  datos: {
    alumnoId: string
    monto?: number
    concepto?: string
    estado?: string
    fechaPago?: Date
    metodo?: string
    createdBy?: string | null
  },
) {
  return prisma.pago.create({
    data: {
      alumnoId: datos.alumnoId,
      concepto: datos.concepto ?? 'CUOTA_MENSUAL',
      monto: datos.monto ?? 150,
      moneda: 'PEN',
      fechaPago: datos.fechaPago ?? new Date('2026-01-15T00:00:00.000Z'),
      metodo: datos.metodo ?? 'EFECTIVO',
      estado: datos.estado ?? 'REGISTRADO',
      createdBy: datos.createdBy ?? null,
    },
  })
}

/** Crea un certificado directo en la base con número único. */
export async function crearCertificado(
  prisma: PrismaClient,
  datos: {
    alumnoId: string
    anioId: string
    estado?: string
    tipo?: string
    plantillaId?: string | null
  },
) {
  certificados += 1

  return prisma.certificado.create({
    data: {
      tipo: datos.tipo ?? 'ESTUDIOS',
      numero: `CERT-TEST-${String(certificados).padStart(4, '0')}`,
      alumnoId: datos.alumnoId,
      anioId: datos.anioId,
      estado: datos.estado ?? 'SOLICITADO',
      plantillaId: datos.plantillaId ?? null,
    },
  })
}
