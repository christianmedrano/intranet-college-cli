import type {
  ActualizarAlumnoInput,
  AlumnoResponse,
  CrearAlumnoInput,
  Paginated,
  PaginationInput,
} from '@intranet/shared'
import { getPrisma } from '../../../core/db.js'
import { AppError } from '../../../core/errors.js'
import { esConflictoDeUnicidad } from '../../../core/prisma-errors.js'
import type { PrismaClient } from '../../../generated/prisma/client.js'
import {
  countAlumnos,
  createAlumnoRecord,
  findAlumnoPorId,
  findAlumnos,
  toAlumnoResponse,
  updateAlumnoRecord,
} from './alumno.repository.js'
import {
  createPersona,
  updatePersonaPorId,
} from './persona.repository.js'

/** Mensaje único para documento, código o persona ya vinculada. */
const MENSAJE_CONFLICTO =
  'Ya existe un registro con ese documento o código de alumno.'

/**
 * Lista los alumnos vigentes con su persona y apoderados (RF-CORE-012).
 *
 * @param paginacion Página y tamaño ya validados por Zod.
 * @param prisma Cliente inyectable para las pruebas.
 */
export async function listarAlumnos(
  paginacion: PaginationInput,
  prisma: PrismaClient = getPrisma(),
): Promise<Paginated<AlumnoResponse>> {
  const total = await countAlumnos(prisma)
  const filas = await findAlumnos(prisma, paginacion)

  return {
    data: filas.map(toAlumnoResponse),
    meta: {
      page: paginacion.page,
      pageSize: paginacion.pageSize,
      total,
    },
  }
}

/**
 * Crea una persona y su registro de alumno en una sola transacción
 * (RF-CORE-012).
 *
 * No crea cuenta de usuario: el alumno puede no tener acceso al sistema.
 *
 * @throws AppError `CONFLICT` si el documento, el código o la persona ya
 * existen.
 */
export async function crearAlumno(
  input: CrearAlumnoInput,
  usuarioId: string,
  prisma: PrismaClient = getPrisma(),
): Promise<AlumnoResponse> {
  try {
    return await prisma.$transaction(async (tx) => {
      const persona = await createPersona(tx, {
        ...input.persona,
        createdBy: usuarioId,
      })

      const fila = await createAlumnoRecord(tx, {
        personaId: persona.id,
        codigoAlumno: input.codigoAlumno,
        fechaIngreso: input.fechaIngreso,
        observaciones: input.observaciones,
        createdBy: usuarioId,
      })

      return toAlumnoResponse(fila)
    })
  } catch (error) {
    if (esConflictoDeUnicidad(error)) {
      throw new AppError('CONFLICT', MENSAJE_CONFLICTO)
    }

    throw error
  }
}

/**
 * Actualiza parcialmente al alumno y su persona (RF-CORE-012).
 *
 * @throws AppError `NOT_FOUND` si el alumno no existe; `CONFLICT` si el nuevo
 * documento o código choca con otro registro.
 */
export async function actualizarAlumno(
  id: string,
  input: ActualizarAlumnoInput,
  usuarioId: string,
  prisma: PrismaClient = getPrisma(),
): Promise<AlumnoResponse> {
  const actual = await findAlumnoPorId(prisma, id)

  if (!actual) {
    throw new AppError('NOT_FOUND', 'El alumno no existe.')
  }

  try {
    return await prisma.$transaction(async (tx) => {
      if (input.persona) {
        await updatePersonaPorId(tx, actual.persona.id, {
          ...input.persona,
          updatedBy: usuarioId,
        })
      }

      const fila = await updateAlumnoRecord(tx, id, {
        codigoAlumno: input.codigoAlumno,
        fechaIngreso: input.fechaIngreso,
        observaciones: input.observaciones,
        updatedBy: usuarioId,
      })

      return toAlumnoResponse(fila)
    })
  } catch (error) {
    if (esConflictoDeUnicidad(error)) {
      throw new AppError('CONFLICT', MENSAJE_CONFLICTO)
    }

    throw error
  }
}
