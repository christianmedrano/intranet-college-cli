import type {
  ChangePasswordInput,
  ForgotPasswordInput,
  LoginInput,
  LoginResponse,
  MeResponse,
  RecoveryTokenResponse,
  ResetPasswordInput,
} from '@intranet/shared'
import {
  assertPasswordPolicy,
  hashPassword,
  verifyPassword,
} from '../../../core/auth/password.js'
import {
  createRecoveryToken,
  createRefreshToken,
  hashToken,
  signAccessToken,
  type RefreshToken,
} from '../../../core/auth/tokens.js'
import { getPrisma } from '../../../core/db.js'
import { AppError } from '../../../core/errors.js'
import { getEffectivePermissions, normalizeRoleCodes } from '../../../core/rbac.js'
import type { PrismaClient } from '../../../generated/prisma/client.js'
import {
  actualizarPasswordYRevocarSesiones,
  consumirTokenRecuperacion,
  emitirTokenRecuperacion,
  findSesionPorHash,
  findTokenRecuperacion,
  findUsuarioConRoles,
  findUsuarioPorEmail,
  findUsuarioVigente,
  findUsuariosPorIdentificador,
  registrarInicioDeSesion,
  revocarSesion,
  rotarSesion,
} from './auth.repository.js'

/** Resultado interno: incluye el refresh en claro para la cookie. */
export interface LoginResult extends LoginResponse {
  refresh: RefreshToken
}

/**
 * Autentica a un usuario con identificador flexible.
 *
 * Reglas aplicadas:
 * - RN-CORE-015: si el identificador coincide con más de un usuario, se rechaza
 *   para forzar uno más específico (`409`).
 * - RN-CORE-006: un usuario inactivo no puede autenticarse.
 * - Los fallos de credenciales responden siempre igual, sin revelar si el
 *   identificador existe (RF-CORE-004).
 *
 * @param input Credenciales ya validadas por Zod.
 * @param prisma Cliente inyectable para las pruebas.
 * @throws AppError `CONFLICT` si hay ambigüedad; `UNAUTHORIZED` si las
 * credenciales no son válidas o el usuario está inactivo.
 */
export async function login(
  input: LoginInput,
  prisma: PrismaClient = getPrisma(),
): Promise<LoginResult> {
  const usuarios = await findUsuariosPorIdentificador(prisma, input.identifier)

  if (usuarios.length > 1) {
    throw new AppError(
      'CONFLICT',
      'El identificador coincide con más de un usuario. Usa uno más específico.',
    )
  }

  const usuario = usuarios[0]

  if (!usuario || !usuario.activo) {
    throw new AppError('UNAUTHORIZED', 'Credenciales inválidas.')
  }

  if (!(await verifyPassword(usuario.passwordHash, input.password))) {
    throw new AppError('UNAUTHORIZED', 'Credenciales inválidas.')
  }

  const access = await signAccessToken(usuario.id)
  const refresh = createRefreshToken()

  await registrarInicioDeSesion(prisma, {
    usuarioId: usuario.id,
    tokenHash: refresh.tokenHash,
    expiraEn: refresh.expiraEn,
    ahora: new Date(),
  })

  return {
    accessToken: access.token,
    tokenType: 'Bearer',
    expiresIn: access.expiresIn,
    refresh,
  }
}

/**
 * Devuelve el perfil del usuario autenticado con sus roles y permisos
 * efectivos (RF-CORE-005).
 *
 * Vuelve a comprobar la vigencia del usuario porque el token puede haber sido
 * emitido antes de una desactivación (RN-CORE-006).
 *
 * @param usuarioId Identificador del usuario autenticado.
 * @param prisma Cliente inyectable para las pruebas.
 * @throws AppError `UNAUTHORIZED` si el usuario ya no existe o está inactivo.
 */
export async function getPerfil(
  usuarioId: string,
  prisma: PrismaClient = getPrisma(),
): Promise<MeResponse> {
  const usuario = await findUsuarioConRoles(prisma, usuarioId)

  if (!usuario || !usuario.activo) {
    throw new AppError('UNAUTHORIZED', 'La sesión no es válida.')
  }

  const roles = normalizeRoleCodes(
    usuario.roles.map((fila) => fila.rol.codigo),
  )

  return {
    id: usuario.id,
    username: usuario.username,
    email: usuario.email,
    debeCambiarPassword: usuario.debeCambiarPassword,
    persona: {
      nombres: usuario.persona.nombres,
      apellidos: usuario.persona.apellidos,
      tipoDocumento: usuario.persona.tipoDocumento,
      numeroDocumento: usuario.persona.numeroDocumento,
    },
    roles,
    permissions: getEffectivePermissions(roles),
  }
}

/**
 * Renueva el token de acceso y rota el refresh (RF-CORE-006).
 *
 * Una sesión revocada, vencida o de un usuario inactivo no puede renovarse. La
 * rotación revoca el refresh anterior, así que reutilizarlo devuelve `401`.
 *
 * @param refreshTokenPlano Valor recibido en la cookie `refresh_token`.
 * @param prisma Cliente inyectable para las pruebas.
 * @throws AppError `UNAUTHORIZED` si la sesión no es válida o perdió la carrera
 * contra otra renovación simultánea.
 */
export async function refreshSession(
  refreshTokenPlano: string,
  prisma: PrismaClient = getPrisma(),
): Promise<LoginResult> {
  const sesion = await findSesionPorHash(
    prisma,
    hashToken(refreshTokenPlano),
  )

  const invalida =
    !sesion ||
    sesion.revocadoEn !== null ||
    sesion.expiraEn.getTime() <= Date.now() ||
    !sesion.usuario.activo ||
    sesion.usuario.deletedAt !== null

  if (!sesion || invalida) {
    throw new AppError('UNAUTHORIZED', 'La sesión expiró o fue revocada.')
  }

  const access = await signAccessToken(sesion.usuarioId)
  const refresh = createRefreshToken()

  const rotada = await rotarSesion(prisma, {
    sesionId: sesion.id,
    usuarioId: sesion.usuarioId,
    tokenHash: refresh.tokenHash,
    expiraEn: refresh.expiraEn,
    ahora: new Date(),
  })

  if (!rotada) {
    throw new AppError('UNAUTHORIZED', 'La sesión expiró o fue revocada.')
  }

  return {
    accessToken: access.token,
    tokenType: 'Bearer',
    expiresIn: access.expiresIn,
    refresh,
  }
}

/**
 * Revoca el refresh de la sesión actual (RF-CORE-006).
 *
 * Es idempotente y no falla si la cookie no está presente: cerrar sesión dos
 * veces no debe romper la interfaz.
 *
 * @param usuarioId Usuario autenticado por el guard.
 * @param refreshTokenPlano Valor de la cookie, si existe.
 * @param prisma Cliente inyectable para las pruebas.
 */
export async function logout(
  usuarioId: string,
  refreshTokenPlano: string | undefined,
  prisma: PrismaClient = getPrisma(),
): Promise<void> {
  if (!refreshTokenPlano) {
    return
  }

  await revocarSesion(prisma, {
    tokenHash: hashToken(refreshTokenPlano),
    usuarioId,
    ahora: new Date(),
  })
}

/**
 * Solicita un restablecimiento de contraseña (RF-CORE-007).
 *
 * No revela si el correo existe: la ausencia de coincidencia termina sin error
 * y la capa HTTP responde siempre `202`. Solo se emite token para cuentas
 * vigentes.
 *
 * @param input Correo del usuario.
 * @param prisma Cliente inyectable para las pruebas.
 */
export async function forgotPassword(
  input: ForgotPasswordInput,
  prisma: PrismaClient = getPrisma(),
): Promise<void> {
  const usuario = await findUsuarioPorEmail(prisma, input.email)

  if (!usuario) {
    return
  }

  const token = createRecoveryToken()

  await emitirTokenRecuperacion(prisma, {
    usuarioId: usuario.id,
    tokenHash: token.tokenHash,
    expiraEn: token.expiraEn,
    ahora: new Date(),
  })
}

/**
 * Restablece la contraseña con un token de un solo uso (RF-CORE-007).
 *
 * Un token usado, expirado o desconocido devuelve el mismo `400`, sin distinguir
 * el motivo. Aplica la política de RN-CORE-017 y revoca todas las sesiones del
 * usuario para que un token robado no deje sesiones abiertas.
 *
 * @param input Token en claro y nueva contraseña.
 * @param prisma Cliente inyectable para las pruebas.
 * @throws AppError `VALIDATION_ERROR` si el token no es usable o la contraseña
 * incumple la política.
 */
export async function resetPassword(
  input: ResetPasswordInput,
  prisma: PrismaClient = getPrisma(),
): Promise<void> {
  const ahora = new Date()
  const registro = await findTokenRecuperacion(
    prisma,
    hashToken(input.token),
  )

  const invalido =
    !registro ||
    registro.usadoEn !== null ||
    registro.expiraEn.getTime() <= ahora.getTime() ||
    !registro.usuario.activo ||
    registro.usuario.deletedAt !== null

  if (!registro || invalido) {
    throw new AppError(
      'VALIDATION_ERROR',
      'El enlace de recuperación no es válido o expiró.',
    )
  }

  assertPasswordPolicy(input.password, [
    registro.usuario.username,
    registro.usuario.email,
    registro.usuario.persona.numeroDocumento,
  ])

  const passwordHash = await hashPassword(input.password)
  const consumido = await consumirTokenRecuperacion(prisma, {
    tokenId: registro.id,
    usuarioId: registro.usuarioId,
    passwordHash,
    ahora,
  })

  if (!consumido) {
    throw new AppError(
      'VALIDATION_ERROR',
      'El enlace de recuperación no es válido o expiró.',
    )
  }
}

/**
 * Emite un token de recuperación desde administración (Q4 de la spec).
 *
 * El MVP no envía correo, así que el operador con `core.usuarios.gestionar`
 * obtiene el token en claro una única vez. Emitir uno nuevo invalida el anterior.
 *
 * @param usuarioId Usuario destino.
 * @param prisma Cliente inyectable para las pruebas.
 * @throws AppError `NOT_FOUND` si el usuario no existe, está inactivo o fue
 * borrado lógicamente.
 */
export async function issueRecoveryToken(
  usuarioId: string,
  prisma: PrismaClient = getPrisma(),
): Promise<RecoveryTokenResponse> {
  const usuario = await findUsuarioVigente(prisma, usuarioId)

  if (!usuario) {
    throw new AppError(
      'NOT_FOUND',
      'El usuario no existe o no está vigente.',
    )
  }

  const token = createRecoveryToken()

  await emitirTokenRecuperacion(prisma, {
    usuarioId: usuario.id,
    tokenHash: token.tokenHash,
    expiraEn: token.expiraEn,
    ahora: new Date(),
  })

  return {
    token: token.token,
    expiresAt: token.expiraEn.toISOString(),
  }
}

/**
 * Cambia la contraseña del usuario autenticado (RF-CORE-017).
 *
 * Sirve para el cambio obligatorio tras el primer acceso con PIN temporal y
 * para el cambio voluntario. Aplica la política de RN-CORE-017 y, al completar,
 * desmarca `debeCambiarPassword` y revoca todas las sesiones, incluida la
 * actual: el usuario debe volver a iniciar sesión con la contraseña nueva.
 *
 * @param usuarioId Usuario autenticado por el guard.
 * @param input Contraseña actual y nueva.
 * @param prisma Cliente inyectable para las pruebas.
 * @throws AppError `UNAUTHORIZED` si la contraseña actual no es correcta o el
 * usuario dejó de estar vigente; `VALIDATION_ERROR` si la nueva incumple la
 * política.
 */
export async function changePassword(
  usuarioId: string,
  input: ChangePasswordInput,
  prisma: PrismaClient = getPrisma(),
): Promise<void> {
  const usuario = await findUsuarioConRoles(prisma, usuarioId)

  if (!usuario || !usuario.activo) {
    throw new AppError('UNAUTHORIZED', 'La sesión no es válida.')
  }

  if (!(await verifyPassword(usuario.passwordHash, input.currentPassword))) {
    throw new AppError('UNAUTHORIZED', 'La contraseña actual no es correcta.')
  }

  assertPasswordPolicy(input.newPassword, [
    usuario.username,
    usuario.email,
    usuario.persona.numeroDocumento,
  ])

  const passwordHash = await hashPassword(input.newPassword)
  const actualizado = await actualizarPasswordYRevocarSesiones(prisma, {
    usuarioId,
    passwordHash,
    ahora: new Date(),
  })

  if (!actualizado) {
    throw new AppError('UNAUTHORIZED', 'La sesión no es válida.')
  }
}
