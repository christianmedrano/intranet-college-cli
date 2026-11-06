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
