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
