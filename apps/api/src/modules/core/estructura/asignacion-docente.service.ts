import type {
  ActualizarAsignacionDocenteInput,
  AsignacionDocenteResponse,
  CrearAsignacionDocenteInput,
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
import { findDocentePorId } from '../personas/docente.repository.js'
import {
  bloquearAsignacionesDeSeccion,
  countAsignacionesDocente,
  createAsignacionDocente,
  findAsignacionDocentePorId,
  findAsignacionesDocente,
  findOtroTutorDeSeccion,
  updateAsignacionDocente,
  type FiltrosAsignacionDocente,
} from './asignacion-docente.repository.js'
import { findAnioAcademicoPorId } from './anio-academico.repository.js'
import { findCursoPorId } from './curso.repository.js'
import { findGradoPorId } from './grado.repository.js'
import { institucionActual } from './institucion-actual.js'
import { findSeccionPorId } from './seccion.repository.js'

/** Mensaje único para la violación de `(docente, curso, sección, año)`. */
const MENSAJE_CONFLICTO =
  'El docente ya está asignado a ese curso, sección y año.'

/** Mensaje cuando la sección ya tiene un tutor vigente. */
const MENSAJE_TUTOR =
  'La sección ya tiene un docente tutor para ese año.'

/**
 * Comprueba que el docente exista y esté vigente.
 *
 * @throws AppError `NOT_FOUND` si no cumple alguna condición.
 */
async function assertDocenteVigente(
  docenteId: string,
  prisma: PrismaClient,
): Promise<void> {
  const docente = await findDocentePorId(prisma, docenteId)

  if (!docente) {
    throw new AppError('NOT_FOUND', 'El docente no existe.')
  }
}

/**
 * Comprueba que el curso exista y pertenezca a la institución.
 *
 * @throws AppError `NOT_FOUND` si no cumple alguna condición.
 */
async function assertCursoVigente(
  cursoId: string,
  institucionId: string,
  prisma: PrismaClient,
) {
  const curso = await findCursoPorId(prisma, cursoId, institucionId)

  if (!curso) {
    throw new AppError('NOT_FOUND', 'El curso no existe.')
  }

  return curso
}

/**
 * Comprueba que la sección exista y pertenezca a la institución.
 *
 * @throws AppError `NOT_FOUND` si no cumple alguna condición.
 */
async function assertSeccionVigente(
  seccionId: string,
  institucionId: string,
  prisma: PrismaClient,
) {
  const seccion = await findSeccionPorId(prisma, seccionId, institucionId)

  if (!seccion) {
    throw new AppError('NOT_FOUND', 'La sección no existe.')
  }

  return seccion
}

/**
 * Comprueba que el año exista y pertenezca a la institución.
 *
 * @throws AppError `NOT_FOUND` si no cumple alguna condición.
 */
async function assertAnioVigente(
  anioId: string,
  institucionId: string,
  prisma: PrismaClient,
): Promise<void> {
  const anio = await findAnioAcademicoPorId(prisma, anioId)

  if (!anio || anio.institucionId !== institucionId) {
    throw new AppError('NOT_FOUND', 'El año académico no existe.')
  }
}

/**
 * Lista las asignaciones docente–curso–sección–año (RF-CORE-011).
 *
 * @param filtros Docente, curso, sección y/o año; si se envían, deben existir.
 * @param paginacion Página y tamaño ya validados por Zod.
 * @param prisma Cliente inyectable para las pruebas.
 * @throws AppError `NOT_FOUND` si un filtro apunta a un registro inexistente.
 */
export async function listarAsignacionesDocente(
  filtros: FiltrosAsignacionDocente,
  paginacion: PaginationInput,
  prisma: PrismaClient = getPrisma(),
): Promise<Paginated<AsignacionDocenteResponse>> {
  const institucion = await institucionActual(prisma)

  if (filtros.docenteId !== undefined) {
    await assertDocenteVigente(filtros.docenteId, prisma)
  }

  if (filtros.cursoId !== undefined) {
    await assertCursoVigente(filtros.cursoId, institucion.id, prisma)
  }

  if (filtros.seccionId !== undefined) {
    await assertSeccionVigente(filtros.seccionId, institucion.id, prisma)
  }

  if (filtros.anioId !== undefined) {
    await assertAnioVigente(filtros.anioId, institucion.id, prisma)
  }

  const total = await countAsignacionesDocente(prisma, institucion.id, filtros)
  const data = await findAsignacionesDocente(
    prisma,
    institucion.id,
    filtros,
    paginacion,
  )

  return {
    data,
    meta: {
      page: paginacion.page,
      pageSize: paginacion.pageSize,
      total,
    },
  }
}

/**
 * Crea una asignación docente–curso–sección–año (RF-CORE-011).
 *
 * La sección debe pertenecer al año indicado, y el curso al nivel del grado de
 * la sección: una asignación incoherente nunca llegaría a usarse y rompería el
 * guard de vínculo docente. Si se marca como tutor, se comprueba que no exista
 * otro tutor vigente en la misma sección y año.
 *
 * @param input Datos validados por Zod.
 * @param usuarioId Usuario que crea el registro.
 * @param contexto IP y user-agent para la auditoría.
 * @param prisma Cliente inyectable para las pruebas.
 * @throws AppError `NOT_FOUND` si alguna ficha no existe; `VALIDATION_ERROR` si
 * la sección o el curso no son coherentes; `CONFLICT` si la combinación ya
 * existe o la sección ya tiene tutor.
 */
export async function crearAsignacion(
  input: CrearAsignacionDocenteInput,
  usuarioId: string,
  contexto: ContextoAuditoria = {},
  prisma: PrismaClient = getPrisma(),
): Promise<AsignacionDocenteResponse> {
  const institucion = await institucionActual(prisma)

  await assertDocenteVigente(input.docenteId, prisma)
  const curso = await assertCursoVigente(
    input.cursoId,
    institucion.id,
    prisma,
  )
  const seccion = await assertSeccionVigente(
    input.seccionId,
    institucion.id,
    prisma,
  )
  await assertAnioVigente(input.anioId, institucion.id, prisma)

  if (seccion.anioId !== input.anioId) {
    throw new AppError('VALIDATION_ERROR', undefined, [
      'anioId: la sección no pertenece al año indicado',
    ])
  }

  const grado = await findGradoPorId(prisma, seccion.gradoId, institucion.id)

  if (!grado) {
    throw new AppError('NOT_FOUND', 'El grado no existe.')
  }

  if (grado.nivelId !== curso.nivelId) {
    throw new AppError('VALIDATION_ERROR', undefined, [
      'cursoId: el curso no pertenece al nivel de la sección',
    ])
  }

  const esTutor = input.esTutor ?? false

  try {
    return await prisma.$transaction(async (tx) => {
      if (esTutor) {
        await bloquearAsignacionesDeSeccion(
          tx,
          input.seccionId,
          input.anioId,
        )

        if (await findOtroTutorDeSeccion(tx, input.seccionId, input.anioId)) {
          throw new AppError('CONFLICT', MENSAJE_TUTOR)
        }
      }

      const fila = await createAsignacionDocente(tx, {
        docenteId: input.docenteId,
        cursoId: input.cursoId,
        seccionId: input.seccionId,
        anioId: input.anioId,
        esTutor,
        createdBy: usuarioId,
      })

      if (esTutor) {
        await registrarAuditoria(tx, {
          usuarioId,
          accion: 'CREAR',
          entidad: 'ASIGNACION_DOCENTE',
          entidadId: fila.id,
          datos: { esTutor: true, seccionId: input.seccionId },
          ...contexto,
        })
      }

      return fila
    })
  } catch (error) {
    if (esConflictoDeUnicidad(error)) {
      throw new AppError('CONFLICT', MENSAJE_CONFLICTO)
    }

    throw error
  }
}

/**
 * Actualiza la marca de tutor de una asignación (RF-CORE-011).
 *
 * Solo se cambia `esTutor`; docente, curso, sección y año son inmutables. Si se
 * marca como tutor, se bloquean las asignaciones de la sección y se comprueba
 * que no exista otro tutor vigente. El cambio se audita con el valor anterior
 * y el nuevo.
 *
 * @param id Asignación a actualizar.
 * @param input Nueva marca de tutor.
 * @param usuarioId Usuario que actualiza.
 * @param contexto IP y user-agent para la auditoría.
 * @param prisma Cliente inyectable para las pruebas.
 * @throws AppError `NOT_FOUND` si la asignación no existe o está fuera de la
 * institución; `CONFLICT` si la sección ya tiene otro tutor.
 */
export async function actualizarAsignacion(
  id: string,
  input: ActualizarAsignacionDocenteInput,
  usuarioId: string,
  contexto: ContextoAuditoria = {},
  prisma: PrismaClient = getPrisma(),
): Promise<AsignacionDocenteResponse> {
  const institucion = await institucionActual(prisma)

  return prisma.$transaction(async (tx) => {
    const actual = await findAsignacionDocentePorId(tx, id, institucion.id)

    if (!actual) {
      throw new AppError('NOT_FOUND', 'La asignación no existe.')
    }

    if (input.esTutor) {
      await bloquearAsignacionesDeSeccion(tx, actual.seccionId, actual.anioId)

      if (
        await findOtroTutorDeSeccion(tx, actual.seccionId, actual.anioId, id)
      ) {
        throw new AppError('CONFLICT', MENSAJE_TUTOR)
      }
    }

    const fila = await updateAsignacionDocente(tx, {
      id,
      esTutor: input.esTutor,
      updatedBy: usuarioId,
    })

    await registrarAuditoria(tx, {
      usuarioId,
      accion: 'ACTUALIZAR',
      entidad: 'ASIGNACION_DOCENTE',
      entidadId: id,
      datos: {
        esTutor: {
          anterior: actual.esTutor,
          nuevo: input.esTutor,
        },
      },
      ...contexto,
    })

    return fila
  })
}
