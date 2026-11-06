import { loginSchema } from '@intranet/shared'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { setRefreshCookie } from '../../../core/auth/cookies.js'
import { AppError } from '../../../core/errors.js'
import { login } from './auth.service.js'

/**
 * `POST /auth/login`
 *
 * Valida el cuerpo, delega en el servicio y entrega el refresh en cookie
 * `httpOnly`. El cuerpo nunca contiene el refresh token.
 */
export async function loginController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const parsed = loginSchema.safeParse(request.body)

  if (!parsed.success) {
    throw new AppError(
      'VALIDATION_ERROR',
      undefined,
      parsed.error.issues.map(
        (issue) => `${issue.path.join('.') || 'cuerpo'}: ${issue.message}`,
      ),
    )
  }

  const resultado = await login(parsed.data)

  setRefreshCookie(reply, resultado.refresh)

  reply.code(200).send({
    accessToken: resultado.accessToken,
    tokenType: resultado.tokenType,
    expiresIn: resultado.expiresIn,
  })
}
