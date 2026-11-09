import type {
  ActualizarUsuarioInput,
  CrearUsuarioInput,
  Paginated,
  PaginationInput,
  RoleCode,
  UsuarioCreadoResponse,
  UsuarioResponse,
} from '@intranet/shared'
import {
  registrarAuditoria,
  type ContextoAuditoria,
} from '../../../core/audit.js'
import { hashPassword } from '../../../core/auth/password.js'
import { getPrisma } from '../../../core/db.js'
import { AppError } from '../../../core/errors.js'
import { esConflictoDeUnicidad } from '../../../core/prisma-errors.js'
import type { AuthActor } from '../../../core/rbac.js'
import type { PrismaClient } from '../../../generated/prisma/client.js'
import { generarPinTemporal } from '../auth/pin.js'
import {
  CAMPOS_USUARIO,
  countUsuarios,
  findPersonaParaUsuario,
  findRolesPorCodigos,
  findUsuarioPorId,
  findUsuarios,
  toUsuarioResponse,
  type RolRow,
} from './usuario.repository.js'

/** Roles que el Director puede asignar y gestionar (RF-CORE-002). */
const ROLES_GESTIONABLES_POR_DIRECTOR: readonly RoleCode[] = [
  'DOCENTE',
  'APODERADO',
  'ALUMNO',
]

const CONJUNTO_GESTIONABLE: ReadonlySet<string> = new Set(
  ROLES_GESTIONABLES_POR_DIRECTOR,
)

const MENSAJE_CONFLICTO =
  'Ya existe un usuario con ese identificador (persona, usuario o correo).'

function esSuperAdmin(actor: AuthActor): boolean {
  return actor.roles.includes('SUPER_ADMIN')
}

/**
 * Impide que un Director asigne roles fuera de Docente, Apoderado o Alumno.
 *
 * @throws AppError `FORBIDDEN` si algún rol no es gestionable por el actor.
 */
function assertRolesAsignables(
  actor: AuthActor,
  roles: readonly string[],
): void {
  if (esSuperAdmin(actor)) {
    return
  }

  if (roles.some((rol) => !CONJUNTO_GESTIONABLE.has(rol))) {
    throw new AppError('FORBIDDEN', 'No puedes asignar ese rol.')
  }
}

/**
 * Impide que un Director edite cuentas con roles administrativos.
 *
 * Un usuario con roles mixtos (por ejemplo, Docente y SuperAdmin) tampoco es
 * gestionable por el Director: el conjunto completo debe estar permitido.
 *
 * @throws AppError `FORBIDDEN` si la cuenta queda fuera de su alcance.
 */
function assertPuedeGestionar(
  actor: AuthActor,
  rolesActuales: readonly string[],
): void {
  if (esSuperAdmin(actor)) {
    return
  }

  if (
    rolesActuales.length === 0 ||
    rolesActuales.some((rol) => !CONJUNTO_GESTIONABLE.has(rol))
  ) {
    throw new AppError('FORBIDDEN', 'No puedes gestionar a este usuario.')
  }
}

/**
 * Carga el catálogo de roles y exige que estén todos.
 *
 * Los roles los crea el seed; si falta alguno, el problema es de configuración
 * y no debe traducirse en un `404` ni en un usuario sin rol.
 *
 * @throws AppError `INTERNAL_ERROR` si el catálogo está incompleto.
 */
async function cargarRoles(
  db: PrismaClient,
  codigos: readonly RoleCode[],
): Promise<RolRow[]> {
  const unicos = [...new Set(codigos)]
  const roles = await findRolesPorCodigos(db, unicos)

  if (roles.length !== unicos.length) {
    throw new AppError('INTERNAL_ERROR')
  }

  return roles
}

/** Roles que el actor puede ver en el listado; `undefined` = todos. */
function rolesVisibles(actor: AuthActor): readonly RoleCode[] | undefined {
  return esSuperAdmin(actor) ? undefined : ROLES_GESTIONABLES_POR_DIRECTOR
}

/**
 * Lista las cuentas vigentes con su persona y roles (RF-CORE-002).
 *
 * El SuperAdmin ve todas. El Director solo ve cuentas cuyos roles se limitan a
 * Docente, Apoderado o Alumno; el despliegue atiende una sola institución, así
 * que no hace falta un filtro adicional por institución.
 *
 * @param paginacion Página y tamaño ya validados por Zod.
 * @param actor Identidad autenticada que consulta.
 * @param prisma Cliente inyectable para las pruebas.
 */
export async function listarUsuarios(
  paginacion: PaginationInput,
  actor: AuthActor,
  prisma: PrismaClient = getPrisma(),
): Promise<Paginated<UsuarioResponse>> {
  const permitidos = rolesVisibles(actor)
  const total = await countUsuarios(prisma, permitidos)
  const filas = await findUsuarios(prisma, paginacion, permitidos)

  return {
    data: filas.map(toUsuarioResponse),
    meta: {
      page: paginacion.page,
      pageSize: paginacion.pageSize,
      total,
    },
  }
}

/**
 * Crea la cuenta de acceso de una persona existente (RF-CORE-002).
 *
 * Genera un PIN temporal aleatorio, lo hashea con Argon2id y marca
 * `debeCambiarPassword`. El PIN en claro solo viaja en esta respuesta.
 *
 * @param input Persona, identificadores y roles.
 * @param actor Identidad autenticada que crea la cuenta.
 * @param contexto IP y user-agent para la auditoría.
 * @param prisma Cliente inyectable para las pruebas.
 * @throws AppError `NOT_FOUND` si la persona no existe; `FORBIDDEN` si el actor
 * no puede asignar alguno de los roles; `CONFLICT` si la persona ya tiene
 * cuenta o los identificadores están en uso.
 */
export async function crearUsuario(
  input: CrearUsuarioInput,
  actor: AuthActor,
  contexto: ContextoAuditoria = {},
  prisma: PrismaClient = getPrisma(),
): Promise<UsuarioCreadoResponse> {
  assertRolesAsignables(actor, input.roles)

  const persona = await findPersonaParaUsuario(prisma, input.personaId)

  if (!persona) {
    throw new AppError('NOT_FOUND', 'La persona no existe.')
  }

  const roles = await cargarRoles(prisma, input.roles)
  const pinTemporal = generarPinTemporal([
    persona.numeroDocumento,
    ...(input.username ? [input.username] : []),
    ...(input.email ? [input.email] : []),
  ])
  const passwordHash = await hashPassword(pinTemporal)

  try {
    const fila = await prisma.$transaction(async (tx) => {
      const usuario = await tx.usuario.create({
        data: {
          personaId: input.personaId,
          username: input.username ?? null,
          email: input.email ?? null,
          passwordHash,
          debeCambiarPassword: true,
          activo: true,
          createdBy: actor.id,
          roles: {
            create: roles.map((rol) => ({
              rolId: rol.id,
              createdBy: actor.id,
            })),
          },
        },
        select: CAMPOS_USUARIO,
      })

      await registrarAuditoria(tx, {
        usuarioId: actor.id,
        accion: 'CREAR',
        entidad: 'USUARIO',
        entidadId: usuario.id,
        datos: {
          personaId: input.personaId,
          roles: roles.map((rol) => rol.codigo),
        },
        ...contexto,
      })

      return usuario
    })

    return { ...toUsuarioResponse(fila), pinTemporal }
  } catch (error) {
    if (esConflictoDeUnicidad(error)) {
      throw new AppError('CONFLICT', MENSAJE_CONFLICTO)
    }

    throw error
  }
}

/**
 * Actualiza identificadores, estado o roles de una cuenta (RF-CORE-002).
 *
 * Los roles enviados reemplazan al conjunto anterior. La baja es lógica
 * (`activo: false`): la cuenta sigue existiendo para poder reactivarse y el
 * refresh deja de renovarse en la siguiente petición.
 *
 * @param id Usuario a actualizar.
 * @param input Campos a cambiar; al menos uno.
 * @param actor Identidad autenticada que actualiza.
 * @param contexto IP y user-agent para la auditoría.
 * @param prisma Cliente inyectable para las pruebas.
 * @throws AppError `NOT_FOUND` si el usuario no existe; `FORBIDDEN` si el actor
 * no puede gestionar la cuenta o asignar los roles; `CONFLICT` si un
 * identificador choca con otra cuenta.
 */
export async function actualizarUsuario(
  id: string,
  input: ActualizarUsuarioInput,
  actor: AuthActor,
  contexto: ContextoAuditoria = {},
  prisma: PrismaClient = getPrisma(),
): Promise<UsuarioResponse> {
  const actual = await findUsuarioPorId(prisma, id)

  if (!actual) {
    throw new AppError('NOT_FOUND', 'El usuario no existe.')
  }

  const rolesActuales = actual.roles.map((vinculo) => vinculo.rol.codigo)

  assertPuedeGestionar(actor, rolesActuales)

  const rolesNuevos = input.roles
    ? await cargarRoles(prisma, input.roles)
    : null

  if (rolesNuevos) {
    assertRolesAsignables(
      actor,
      rolesNuevos.map((rol) => rol.codigo),
    )
  }

  const camposActualizados = Object.entries(input)
    .filter(([, valor]) => valor !== undefined)
    .map(([campo]) => campo)

  try {
    const fila = await prisma.$transaction(async (tx) => {
      await tx.usuario.update({
        where: { id },
        data: {
          ...(input.username !== undefined ? { username: input.username } : {}),
          ...(input.email !== undefined ? { email: input.email } : {}),
          ...(input.activo !== undefined ? { activo: input.activo } : {}),
          updatedBy: actor.id,
        },
      })

      if (rolesNuevos) {
        await tx.usuarioRol.deleteMany({ where: { usuarioId: id } })

        await tx.usuarioRol.createMany({
          data: rolesNuevos.map((rol) => ({
            usuarioId: id,
            rolId: rol.id,
            createdBy: actor.id,
          })),
        })
      }

      await registrarAuditoria(tx, {
        usuarioId: actor.id,
        accion: 'ACTUALIZAR',
        entidad: 'USUARIO',
        entidadId: id,
        datos: {
          camposActualizados,
          ...(rolesNuevos
            ? { roles: rolesNuevos.map((rol) => rol.codigo) }
            : {}),
        },
        ...contexto,
      })

      return tx.usuario.findUniqueOrThrow({
        where: { id },
        select: CAMPOS_USUARIO,
      })
    })

    return toUsuarioResponse(fila)
  } catch (error) {
    if (esConflictoDeUnicidad(error)) {
      throw new AppError('CONFLICT', MENSAJE_CONFLICTO)
    }

    throw error
  }
}
