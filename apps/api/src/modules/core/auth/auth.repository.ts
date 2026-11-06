import type { PrismaClient } from '../../../generated/prisma/client.js'

/** Datos mínimos del usuario para validar credenciales. */
export interface UsuarioParaLogin {
  id: string
  passwordHash: string
  activo: boolean
}

/**
 * Busca usuarios por identificador flexible: nombre de usuario, correo o
 * número de documento (RN-CORE-015).
 *
 * Excluye los registros con borrado lógico para que no provoquen conflictos
 * fantasma. Puede devolver más de un resultado: el servicio decide si hay
 * ambigüedad.
 */
export async function findUsuariosPorIdentificador(
  prisma: PrismaClient,
  identificador: string,
): Promise<UsuarioParaLogin[]> {
  return prisma.usuario.findMany({
    where: {
      deletedAt: null,
      OR: [
        { username: identificador },
        { email: identificador },
        { persona: { numeroDocumento: identificador } },
      ],
    },
    select: { id: true, passwordHash: true, activo: true },
  })
}

export interface InicioDeSesion {
  usuarioId: string
  tokenHash: string
  expiraEn: Date
  ahora: Date
}

/**
 * Registra la sesión y actualiza el último acceso en una sola transacción.
 *
 * El refresh se guarda solo como hash (RN-CORE-013).
 */
export async function registrarInicioDeSesion(
  prisma: PrismaClient,
  datos: InicioDeSesion,
): Promise<void> {
  await prisma.$transaction([
    prisma.sesionRefresh.create({
      data: {
        usuarioId: datos.usuarioId,
        tokenHash: datos.tokenHash,
        expiraEn: datos.expiraEn,
      },
    }),
    prisma.usuario.update({
      where: { id: datos.usuarioId },
      data: { ultimoAcceso: datos.ahora },
    }),
  ])
}

/**
 * Carga el usuario con su persona y sus roles para construir el perfil.
 *
 * Excluye el borrado lógico; la vigencia (`activo`) la evalúa el servicio.
 */
export async function findUsuarioConRoles(
  prisma: PrismaClient,
  usuarioId: string,
) {
  return prisma.usuario.findFirst({
    where: { id: usuarioId, deletedAt: null },
    include: {
      persona: true,
      roles: { include: { rol: true } },
    },
  })
}

/**
 * Busca una sesión por el hash del refresh.
 *
 * Trae el estado del usuario para que el servicio pueda rechazar la renovación
 * de una cuenta desactivada o con borrado lógico.
 */
export async function findSesionPorHash(
  prisma: PrismaClient,
  tokenHash: string,
) {
  return prisma.sesionRefresh.findUnique({
    where: { tokenHash },
    include: {
      usuario: {
        select: { id: true, activo: true, deletedAt: true },
      },
    },
  })
}

export interface RotacionDeSesion {
  sesionId: string
  usuarioId: string
  tokenHash: string
  expiraEn: Date
  ahora: Date
}

/**
 * Rota una sesión: revoca la anterior y crea la nueva de forma atómica.
 *
 * La revocación es condicional (`revocadoEn: null`) para que dos renovaciones
 * simultáneas con el mismo token no produzcan dos sesiones válidas: la segunda
 * no encuentra filas que actualizar y la transacción se revierte.
 *
 * @returns `false` si la sesión ya había sido revocada por otra petición.
 */
export async function rotarSesion(
  prisma: PrismaClient,
  datos: RotacionDeSesion,
): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const revocada = await tx.sesionRefresh.updateMany({
      where: { id: datos.sesionId, revocadoEn: null },
      data: { revocadoEn: datos.ahora },
    })

    if (revocada.count !== 1) {
      return false
    }

    await tx.sesionRefresh.create({
      data: {
        usuarioId: datos.usuarioId,
        tokenHash: datos.tokenHash,
        expiraEn: datos.expiraEn,
      },
    })

    return true
  })
}

/**
 * Revoca la sesión identificada por el hash, solo si pertenece al usuario.
 *
 * Es idempotente: una sesión ya revocada o inexistente no produce error.
 */
export async function revocarSesion(
  prisma: PrismaClient,
  datos: { tokenHash: string; usuarioId: string; ahora: Date },
): Promise<void> {
  await prisma.sesionRefresh.updateMany({
    where: {
      tokenHash: datos.tokenHash,
      usuarioId: datos.usuarioId,
      revocadoEn: null,
    },
    data: { revocadoEn: datos.ahora },
  })
}

/**
 * Busca un usuario vigente por correo para iniciar la recuperación.
 *
 * Solo devuelve cuentas activas y sin borrado lógico; el servicio responde
 * igual cuando no hay coincidencia para no revelar qué correos existen.
 */
export async function findUsuarioPorEmail(
  prisma: PrismaClient,
  email: string,
): Promise<{ id: string } | null> {
  return prisma.usuario.findFirst({
    where: { email, activo: true, deletedAt: null },
    select: { id: true },
  })
}

/** Datos del usuario necesarios para emitir un token o validar la política. */
export interface UsuarioParaRecuperacion {
  id: string
  username: string | null
  email: string | null
  persona: { numeroDocumento: string }
}

/**
 * Carga un usuario vigente por identificador.
 *
 * Se usa tanto para emitir un token desde administración como para validar la
 * política de contraseña al restablecer.
 */
export async function findUsuarioVigente(
  prisma: PrismaClient,
  usuarioId: string,
): Promise<UsuarioParaRecuperacion | null> {
  return prisma.usuario.findFirst({
    where: { id: usuarioId, activo: true, deletedAt: null },
    select: {
      id: true,
      username: true,
      email: true,
      persona: { select: { numeroDocumento: true } },
    },
  })
}

export interface EmisionDeToken {
  usuarioId: string
  tokenHash: string
  expiraEn: Date
  ahora: Date
}

/**
 * Emite un token de recuperación invalidando los anteriores sin usar.
 *
 * Marcar los previos como usados evita que dos enlaces sigan vivos a la vez.
 * Se hace en una transacción para que nunca queden dos tokens válidos.
 */
export async function emitirTokenRecuperacion(
  prisma: PrismaClient,
  datos: EmisionDeToken,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.tokenRecuperacion.updateMany({
      where: { usuarioId: datos.usuarioId, usadoEn: null },
      data: { usadoEn: datos.ahora },
    })

    await tx.tokenRecuperacion.create({
      data: {
        usuarioId: datos.usuarioId,
        tokenHash: datos.tokenHash,
        expiraEn: datos.expiraEn,
      },
    })
  })
}

/** Busca un token de recuperación por su hash e incluye al usuario. */
export async function findTokenRecuperacion(
  prisma: PrismaClient,
  tokenHash: string,
) {
  return prisma.tokenRecuperacion.findUnique({
    where: { tokenHash },
    include: {
      usuario: {
        select: {
          id: true,
          username: true,
          email: true,
          activo: true,
          deletedAt: true,
          persona: { select: { numeroDocumento: true } },
        },
      },
    },
  })
}

export interface ConsumoDeToken {
  tokenId: string
  usuarioId: string
  passwordHash: string
  ahora: Date
}

/**
 * Consume el token y aplica el cambio de contraseña en una transacción.
 *
 * La actualización del token es condicional (`usadoEn: null` y vigente), así que
 * dos restablecimientos simultáneos con el mismo token no pueden triunfar.
 * Además revoca todas las sesiones del usuario (RF-CORE-007).
 *
 * @returns `false` si el token ya fue usado o expiró.
 */
export async function consumirTokenRecuperacion(
  prisma: PrismaClient,
  datos: ConsumoDeToken,
): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const consumido = await tx.tokenRecuperacion.updateMany({
      where: {
        id: datos.tokenId,
        usuarioId: datos.usuarioId,
        usadoEn: null,
        expiraEn: { gt: datos.ahora },
      },
      data: { usadoEn: datos.ahora },
    })

    if (consumido.count !== 1) {
      return false
    }

    await tx.usuario.update({
      where: { id: datos.usuarioId },
      data: {
        passwordHash: datos.passwordHash,
        debeCambiarPassword: false,
      },
    })

    await tx.sesionRefresh.updateMany({
      where: { usuarioId: datos.usuarioId, revocadoEn: null },
      data: { revocadoEn: datos.ahora },
    })

    return true
  })
}
