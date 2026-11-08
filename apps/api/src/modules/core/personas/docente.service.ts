import type {
  ActualizarDocenteInput,
  CrearDocenteInput,
  DocenteResponse,
  Paginated,
  PaginationInput,
} from '@intranet/shared'
import {
  registrarAuditoria,
  type ContextoAuditoria,
} from '../../../core/audit.js'
import { getPrisma } from '../../../core/db.js'
import { AppError } from '../../../core/errors.js'
import { esConflictoDeUnicidad } from '../../../core/prisma-errors.js'
import type { PrismaClient } from '../../../generated/prisma/client.js'
import {
  countDocentes,
  createDocenteRecord,
  findDocentePorId,
  findDocentes,
  toDocenteResponse,
  updateDocenteRecord,
} from './docente.repository.js'
import {
  createPersona,
  updatePersonaPorId,
} from './persona.repository.js'

/** Mensaje único para documento, código o persona ya vinculada. */
const MENSAJE_CONFLICTO =
  'Ya existe un registro con ese documento o código de docente.'

/**
 * Lista los docentes vigentes con su persona (RF-CORE-013).
 *
 * @param paginacion Página y tamaño ya validados por Zod.
 * @param prisma Cliente inyectable para las pruebas.
 */
export async function listarDocentes(
  paginacion: PaginationInput,
  prisma: PrismaClient = getPrisma(),
): Promise<Paginated<DocenteResponse>> {
  const total = await countDocentes(prisma)
  const filas = await findDocentes(prisma, paginacion)

  return {
    data: filas.map(toDocenteResponse),
    meta: {
      page: paginacion.page,
      pageSize: paginacion.pageSize,
      total,
    },
  }
}

/**
 * Crea una persona y su registro de docente en una sola transacción
 * (RF-CORE-013).
 *
 * No crea cuenta de usuario ni expone credenciales.
 *
 * @throws AppError `CONFLICT` si el documento, el código o la persona ya
 * existen.
 */
export async function crearDocente(
  input: CrearDocenteInput,
  usuarioId: string,
  contexto: ContextoAuditoria = {},
  prisma: PrismaClient = getPrisma(),
): Promise<DocenteResponse> {
  try {
    return await prisma.$transaction(async (tx) => {
      const persona = await createPersona(tx, {
        ...input.persona,
        createdBy: usuarioId,
      })

      const fila = await createDocenteRecord(tx, {
        personaId: persona.id,
        codigoDocente: input.codigoDocente,
        especialidad: input.especialidad,
        createdBy: usuarioId,
      })

      await registrarAuditoria(tx, {
        usuarioId,
        accion: 'CREAR',
        entidad: 'DOCENTE',
        entidadId: fila.id,
        datos: {
          personaId: persona.id,
          codigoDocente: input.codigoDocente,
        },
        ...contexto,
      })

      return toDocenteResponse(fila)
    })
  } catch (error) {
    if (esConflictoDeUnicidad(error)) {
      throw new AppError('CONFLICT', MENSAJE_CONFLICTO)
    }

    throw error
  }
}

/**
 * Actualiza parcialmente al docente y su persona (RF-CORE-013).
 *
 * @throws AppError `NOT_FOUND` si el docente no existe; `CONFLICT` si el nuevo
 * documento o código choca con otro registro.
 */
export async function actualizarDocente(
  id: string,
  input: ActualizarDocenteInput,
  usuarioId: string,
  contexto: ContextoAuditoria = {},
  prisma: PrismaClient = getPrisma(),
): Promise<DocenteResponse> {
  const actual = await findDocentePorId(prisma, id)

  if (!actual) {
    throw new AppError('NOT_FOUND', 'El docente no existe.')
  }

  try {
    return await prisma.$transaction(async (tx) => {
      if (input.persona) {
        await updatePersonaPorId(tx, actual.persona.id, {
          ...input.persona,
          updatedBy: usuarioId,
        })
      }

      const fila = await updateDocenteRecord(tx, id, {
        codigoDocente: input.codigoDocente,
        especialidad: input.especialidad,
        updatedBy: usuarioId,
      })

      await registrarAuditoria(tx, {
        usuarioId,
        accion: 'ACTUALIZAR',
        entidad: 'DOCENTE',
        entidadId: id,
        datos: {
          camposActualizados: Object.keys(input),
          ...(input.persona
            ? { camposPersona: Object.keys(input.persona) }
            : {}),
        },
        ...contexto,
      })

      return toDocenteResponse(fila)
    })
  } catch (error) {
    if (esConflictoDeUnicidad(error)) {
      throw new AppError('CONFLICT', MENSAJE_CONFLICTO)
    }

    throw error
  }
}
