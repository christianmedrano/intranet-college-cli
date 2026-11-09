import type {
  PaginationInput,
  RoleCode,
  UsuarioResponse,
} from '@intranet/shared'
import { normalizeRoleCodes } from '../../../core/rbac.js'
import type { Prisma } from '../../../generated/prisma/client.js'
import {
  CAMPOS_PERSONA,
  toPersonaResponse,
  type PersonaRow,
} from '../personas/persona.repository.js'

/** Campos de `Usuario` expuestos por los contratos públicos. */
export const CAMPOS_USUARIO = {
  id: true,
  username: true,
  email: true,
  activo: true,
  debeCambiarPassword: true,
  ultimoAcceso: true,
  persona: { select: CAMPOS_PERSONA },
  roles: { select: { rol: { select: { codigo: true } } } },
} satisfies Prisma.UsuarioSelect

/** Fila interna de usuario con su persona y roles. */
export interface UsuarioRow {
  id: string
  username: string | null
  email: string | null
  activo: boolean
  debeCambiarPassword: boolean
  ultimoAcceso: Date | null
  persona: PersonaRow
  roles: Array<{ rol: { codigo: string } }>
}

/** Proyecta la fila interna al contrato público. */
export function toUsuarioResponse(fila: UsuarioRow): UsuarioResponse {
  return {
    id: fila.id,
    username: fila.username,
    email: fila.email,
    activo: fila.activo,
    debeCambiarPassword: fila.debeCambiarPassword,
    ultimoAcceso: fila.ultimoAcceso ? fila.ultimoAcceso.toISOString() : null,
    persona: toPersonaResponse(fila.persona),
    roles: normalizeRoleCodes(fila.roles.map((vinculo) => vinculo.rol.codigo)),
  }
}

/**
 * Filtro de roles que acota el listado.
 *
 * Se exige que el usuario tenga al menos uno de los roles permitidos y que
 * ninguno quede fuera: así el Director no ve cuentas con roles que no gestiona.
 */
function filtroDeRoles(
  rolesPermitidos: readonly RoleCode[] | undefined,
): Prisma.UsuarioWhereInput {
  if (!rolesPermitidos) {
    return {}
  }

  return {
    roles: {
      some: { rol: { codigo: { in: [...rolesPermitidos] } } },
      every: { rol: { codigo: { in: [...rolesPermitidos] } } },
    },
  }
}

/** Cuenta los usuarios vigentes, opcionalmente acotados por rol. */
export async function countUsuarios(
  db: Prisma.TransactionClient,
  rolesPermitidos?: readonly RoleCode[],
): Promise<number> {
  return db.usuario.count({
    where: { deletedAt: null, ...filtroDeRoles(rolesPermitidos) },
  })
}

/**
 * Lista usuarios vigentes ordenados por apellidos y nombres.
 *
 * `id` desempata para que la paginación sea estable.
 */
export async function findUsuarios(
  db: Prisma.TransactionClient,
  paginacion: PaginationInput,
  rolesPermitidos?: readonly RoleCode[],
): Promise<UsuarioRow[]> {
  return db.usuario.findMany({
    where: { deletedAt: null, ...filtroDeRoles(rolesPermitidos) },
    orderBy: [
      { persona: { apellidos: 'asc' } },
      { persona: { nombres: 'asc' } },
      { id: 'asc' },
    ],
    skip: (paginacion.page - 1) * paginacion.pageSize,
    take: paginacion.pageSize,
    select: CAMPOS_USUARIO,
  })
}

/** Busca un usuario vigente por identificador. */
export async function findUsuarioPorId(
  db: Prisma.TransactionClient,
  id: string,
): Promise<UsuarioRow | null> {
  return db.usuario.findFirst({
    where: { id, deletedAt: null },
    select: CAMPOS_USUARIO,
  })
}

/** Busca una persona vigente que pueda recibir una cuenta de acceso. */
export async function findPersonaParaUsuario(
  db: Prisma.TransactionClient,
  id: string,
): Promise<PersonaRow | null> {
  return db.persona.findFirst({
    where: { id, deletedAt: null },
    select: CAMPOS_PERSONA,
  })
}

/** Fila mínima del catálogo de roles. */
export interface RolRow {
  id: string
  codigo: string
}

/** Carga los roles solicitados; el servicio comprueba que existan todos. */
export async function findRolesPorCodigos(
  db: Prisma.TransactionClient,
  codigos: readonly string[],
): Promise<RolRow[]> {
  return db.rol.findMany({
    where: { codigo: { in: [...codigos] } },
    select: { id: true, codigo: true },
  })
}
