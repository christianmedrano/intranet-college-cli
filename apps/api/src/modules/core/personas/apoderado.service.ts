import type {
  ActualizarApoderadoInput,
  ApoderadoResponse,
  CrearApoderadoInput,
  Paginated,
  PaginationInput,
  VincularAlumnoInput,
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
  countApoderados,
  createApoderadoRecord,
  findApoderadoPorId,
  findApoderados,
  toApoderadoResponse,
  updateApoderadoRecord,
  vincularAlumnoRecord,
  type ResultadoVinculo,
} from './apoderado.repository.js'
import {
  createPersona,
  updatePersonaPorId,
} from './persona.repository.js'

/** Mensaje único para documento o persona ya vinculada. */
const MENSAJE_CONFLICTO =
  'Ya existe un registro con ese documento de apoderado.'

/**
 * Lista los apoderados vigentes con su persona y sus alumnos (RF-CORE-014).
 *
 * @param paginacion Página y tamaño ya validados por Zod.
 * @param prisma Cliente inyectable para las pruebas.
 */
export async function listarApoderados(
  paginacion: PaginationInput,
  prisma: PrismaClient = getPrisma(),
): Promise<Paginated<ApoderadoResponse>> {
  const total = await countApoderados(prisma)
  const filas = await findApoderados(prisma, paginacion)

  return {
    data: filas.map(toApoderadoResponse),
    meta: {
      page: paginacion.page,
      pageSize: paginacion.pageSize,
      total,
    },
  }
}

/**
 * Crea una persona y su registro de apoderado en una sola transacción
 * (RF-CORE-014).
 *
 * @throws AppError `CONFLICT` si el documento o la persona ya existen.
 */
export async function crearApoderado(
  input: CrearApoderadoInput,
  usuarioId: string,
  contexto: ContextoAuditoria = {},
  prisma: PrismaClient = getPrisma(),
): Promise<ApoderadoResponse> {
  try {
    return await prisma.$transaction(async (tx) => {
      const persona = await createPersona(tx, {
        ...input.persona,
        createdBy: usuarioId,
      })

      const fila = await createApoderadoRecord(tx, {
        personaId: persona.id,
        ocupacion: input.ocupacion,
        createdBy: usuarioId,
      })

      await registrarAuditoria(tx, {
        usuarioId,
        accion: 'CREAR',
        entidad: 'APODERADO',
        entidadId: fila.id,
        datos: { personaId: persona.id },
        ...contexto,
      })

      return toApoderadoResponse(fila)
    })
  } catch (error) {
    if (esConflictoDeUnicidad(error)) {
      throw new AppError('CONFLICT', MENSAJE_CONFLICTO)
    }

    throw error
  }
}

/**
 * Actualiza parcialmente al apoderado y su persona (RF-CORE-014).
 *
 * @throws AppError `NOT_FOUND` si el apoderado no existe; `CONFLICT` si el
 * nuevo documento choca con otro registro.
 */
export async function actualizarApoderado(
  id: string,
  input: ActualizarApoderadoInput,
  usuarioId: string,
  contexto: ContextoAuditoria = {},
  prisma: PrismaClient = getPrisma(),
): Promise<ApoderadoResponse> {
  const actual = await findApoderadoPorId(prisma, id)

  if (!actual) {
    throw new AppError('NOT_FOUND', 'El apoderado no existe.')
  }

  try {
    return await prisma.$transaction(async (tx) => {
      if (input.persona) {
        await updatePersonaPorId(tx, actual.persona.id, {
          ...input.persona,
          updatedBy: usuarioId,
        })
      }

      const fila = await updateApoderadoRecord(tx, id, {
        ocupacion: input.ocupacion,
        updatedBy: usuarioId,
      })

      await registrarAuditoria(tx, {
        usuarioId,
        accion: 'ACTUALIZAR',
        entidad: 'APODERADO',
        entidadId: id,
        datos: {
          camposActualizados: Object.keys(input),
          ...(input.persona
            ? { camposPersona: Object.keys(input.persona) }
            : {}),
        },
        ...contexto,
      })

      return toApoderadoResponse(fila)
    })
  } catch (error) {
    if (esConflictoDeUnicidad(error)) {
      throw new AppError('CONFLICT', MENSAJE_CONFLICTO)
    }

    throw error
  }
}

/**
 * Vincula un alumno a un apoderado (RF-CORE-014).
 *
 * @throws AppError `NOT_FOUND` si el apoderado o el alumno no existen;
 * `CONFLICT` si el vínculo entra en conflicto con datos existentes.
 */
export async function vincularAlumno(
  apoderadoId: string,
  input: VincularAlumnoInput,
  usuarioId: string,
  contexto: ContextoAuditoria = {},
  prisma: PrismaClient = getPrisma(),
): Promise<ResultadoVinculo> {
  const apoderado = await findApoderadoPorId(prisma, apoderadoId)

  if (!apoderado) {
    throw new AppError('NOT_FOUND', 'El apoderado no existe.')
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const resultado = await vincularAlumnoRecord(tx, {
        apoderadoId,
        alumnoId: input.alumnoId,
        parentesco: input.parentesco,
        esPrincipal: input.esPrincipal,
        createdBy: usuarioId,
      })

      await registrarAuditoria(tx, {
        usuarioId,
        accion: 'VINCULAR',
        entidad: 'APODERADO',
        entidadId: apoderadoId,
        datos: {
          alumnoId: input.alumnoId,
          parentesco: input.parentesco,
          esPrincipal: input.esPrincipal,
          creado: resultado.creado,
        },
        ...contexto,
      })

      return resultado
    })
  } catch (error) {
    if (esConflictoDeUnicidad(error)) {
      throw new AppError('CONFLICT', 'El vínculo ya existe.')
    }

    throw error
  }
}
