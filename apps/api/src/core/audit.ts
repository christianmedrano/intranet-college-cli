import type { FastifyRequest } from 'fastify'
import type { Prisma } from '../generated/prisma/client.js'

/** Valor que reemplaza a cualquier dato sensible en la auditoría. */
export const TEXTO_REDACTADO = '[REDACTADO]'

/**
 * Claves cuyo valor nunca se persiste en `Auditoria.datos`.
 *
 * La comparación normaliza mayúsculas y separadores, de modo que
 * `password_hash`, `passwordHash` y `Password-Hash` se tratan igual. La lista
 * cubre credenciales y datos personales (PII) de la Ley N.° 29733.
 */
export const CLAVES_SENSIBLES = [
  'password',
  'passwordhash',
  'token',
  'tokenhash',
  'refreshtoken',
  'accesstoken',
  'pin',
  'pintemporal',
  'nombres',
  'apellidos',
  'tipodocumento',
  'numerodocumento',
  'fechanacimiento',
  'telefono',
  'emailcontacto',
  'direccion',
  'email',
  'username',
] as const

/** Acciones auditables de las operaciones sensibles del MVP. */
export type AccionAuditoria =
  | 'CREAR'
  | 'ACTUALIZAR'
  | 'VINCULAR'
  | 'APROBAR'
  | 'RETIRAR'

/** Contexto de la petición que acompaña al registro de auditoría. */
export interface ContextoAuditoria {
  ip?: string | null
  userAgent?: string | null
}

/** Datos mínimos que debe aportar cada operación auditada. */
export interface RegistroAuditoriaInput extends ContextoAuditoria {
  usuarioId: string | null
  accion: AccionAuditoria
  entidad: string
  entidadId?: string | null
  datos?: Prisma.InputJsonObject | null
}

function normalizarClave(clave: string): string {
  return clave.replace(/[_-]/g, '').toLowerCase()
}

const CLAVES_SENSIBLES_NORMALIZADAS = new Set(
  CLAVES_SENSIBLES.map(normalizarClave),
)

function esObjeto(valor: Prisma.InputJsonValue): valor is Prisma.InputJsonObject {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

/** Redacta recursivamente los valores de las claves sensibles. */
function redactarValor(valor: Prisma.InputJsonValue): Prisma.InputJsonValue {
  if (Array.isArray(valor)) {
    return valor.map((elemento) => redactarValor(elemento))
  }

  if (esObjeto(valor)) {
    return redactarDatos(valor)
  }

  return valor
}

/**
 * Sustituye por {@link TEXTO_REDACTADO} el valor de toda clave sensible.
 *
 * La estructura y el resto de valores se conservan para que la auditoría
 * demuestre qué cambió sin almacenar PII ni credenciales (RF-CORE-016,
 * RN-CORE-013).
 *
 * @param datos Objeto plano con los datos a auditar.
 * @returns Copia redactada, lista para `Auditoria.datos`.
 */
export function redactarDatos(
  datos: Prisma.InputJsonObject,
): Prisma.InputJsonObject {
  const resultado: Record<string, Prisma.InputJsonValue | null> = {}

  for (const [clave, valor] of Object.entries(datos)) {
    if (valor === undefined) {
      continue
    }

    if (CLAVES_SENSIBLES_NORMALIZADAS.has(normalizarClave(clave))) {
      resultado[clave] = TEXTO_REDACTADO
    } else if (valor === null) {
      resultado[clave] = null
    } else {
      resultado[clave] = redactarValor(valor)
    }
  }

  return resultado
}

/**
 * Extrae de la petición la IP y el user-agent para la auditoría.
 *
 * @param request Petición de Fastify.
 */
export function contextoDePeticion(
  request: FastifyRequest,
): ContextoAuditoria {
  const userAgent = request.headers['user-agent']

  return {
    ip: request.ip,
    userAgent: typeof userAgent === 'string' ? userAgent : null,
  }
}

/**
 * Inserta un registro de auditoría dentro de la transacción de la operación
 * (RF-CORE-016, RN-CORE-012).
 *
 * Recibir un `TransactionClient` es intencional: si la operación sensible falla
 * y se revierte, su auditoría también se revierte. La tabla no se actualiza ni
 * se borra desde el código de la aplicación.
 *
 * @param db Cliente transaccional de Prisma.
 * @param registro Usuario, acción, entidad y datos ya depurados.
 */
export async function registrarAuditoria(
  db: Prisma.TransactionClient,
  registro: RegistroAuditoriaInput,
): Promise<void> {
  await db.auditoria.create({
    data: {
      usuarioId: registro.usuarioId,
      accion: registro.accion,
      entidad: registro.entidad,
      entidadId: registro.entidadId ?? null,
      ip: registro.ip ?? null,
      userAgent: registro.userAgent ?? null,
      ...(registro.datos ? { datos: redactarDatos(registro.datos) } : {}),
    },
  })
}
