import type {
  ActualizarHorarioInput,
  CrearHorarioInput,
  HorarioResponse,
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
import type {
  Prisma,
  PrismaClient,
} from '../../../generated/prisma/client.js'
import { auditarAccesoAcademico } from '../consulta-audit.js'
import { assertPermiso, type ActorAcademico } from '../scope.js'
import {
  bloquearDocente,
  bloquearSeccion,
  countHorarios,
  createHorario,
  existeAsignacionDocente,
  existeDocente,
  existeSolapamientoDocente,
  existeSolapamientoSeccion,
  findCursoParaHorario,
  findHorarioPorId,
  findHorarios,
  findSeccionParaHorario,
  softDeleteHorario,
  updateHorario,
  type HorarioRow,
} from './horario.repository.js'
import {
  construirAlcanceHorarios,
  type FiltrosConsultaHorarios,
} from './horario.scope.js'

const MENSAJE_SOLAPAMIENTO_SECCION =
  'La sección ya tiene un bloque de horario en ese rango.'

const MENSAJE_SOLAPAMIENTO_DOCENTE =
  'El docente ya tiene un bloque de horario en ese rango.'

const MENSAJE_ANIO =
  'La sección no pertenece al año académico indicado.'

const MENSAJE_NIVEL =
  'El curso no pertenece al nivel de la sección.'

const MENSAJE_ASIGNACION =
  'El docente no tiene asignación vigente en ese curso, sección y año.'

const MENSAJE_HORAS =
  'La hora de inicio debe ser anterior a la de fin.'

/**
 * Lista los horarios de un año con el alcance del solicitante (RF-ACAD-011).
 *
 * El Director y el SuperAdmin ven todo el año (el segundo con acceso
 * auditado); el docente, sus cursos y secciones; el apoderado, las secciones de
 * sus alumnos; el alumno, la propia. Los filtros fuera de alcance devuelven
 * `403`.
 *
 * @param filtros Filtros validados por Zod.
 * @param paginacion Página y tamaño ya validados por Zod.
 * @param actor Usuario autenticado con sus roles.
 * @param contexto IP y user-agent para la auditoría.
 * @param prisma Cliente inyectable para las pruebas.
 * @throws AppError `FORBIDDEN` si un filtro está fuera de alcance.
 */
export async function listarHorarios(
  filtros: FiltrosConsultaHorarios,
  paginacion: PaginationInput,
  actor: ActorAcademico,
  contexto: ContextoAuditoria = {},
  prisma: PrismaClient = getPrisma(),
): Promise<Paginated<HorarioResponse>> {
  assertPermiso(actor, 'academic.horarios.leer')

  const { where, datosAcceso, auditarAcceso } = await construirAlcanceHorarios(
    actor,
    filtros,
    prisma,
  )

  const total = await countHorarios(prisma, where)
  const data = await findHorarios(prisma, where, paginacion)

  if (auditarAcceso) {
    await auditarAccesoAcademico(
      prisma,
      actor,
      'HORARIO',
      { entidadId: null, datos: datosAcceso },
      contexto,
    )
  }

  return {
    data,
    meta: {
      page: paginacion.page,
      pageSize: paginacion.pageSize,
      total,
    },
  }
}

/** Valores efectivos de un bloque, ya resueltos para crear o actualizar. */
interface ValoresBloque {
  anioId: string
  seccionId: string
  cursoId: string
  docenteId: string | null
  diaSemana: number
  horaInicio: string
  horaFin: string
}

/**
 * Bloquea sección y docente y valida todas las reglas del bloque
 * (RN-ACAD-017, RN-ACAD-018).
 *
 * Los bloqueos se toman en orden determinista (sección y luego docente) para
 * que dos peticiones concurrentes no se interbloqueen. La sección debe
 * pertenecer al año, el curso al nivel de la sección y el docente, si se
 * indica, tener asignación vigente en curso, sección y año.
 *
 * @param bloque Valores que se van a persistir.
 * @param excluirId Horario que se edita, para excluirlo del solapamiento.
 * @throws AppError `NOT_FOUND`, `VALIDATION_ERROR` o `CONFLICT`.
 */
async function validarBloque(
  tx: Prisma.TransactionClient,
  bloque: ValoresBloque,
  excluirId?: string,
): Promise<void> {
  await bloquearSeccion(tx, bloque.seccionId)

  const seccion = await findSeccionParaHorario(tx, bloque.seccionId)

  if (!seccion) {
    throw new AppError('NOT_FOUND', 'La sección no existe.')
  }

  if (seccion.anioId !== bloque.anioId) {
    throw new AppError('VALIDATION_ERROR', undefined, [MENSAJE_ANIO])
  }

  if (bloque.docenteId) {
    await bloquearDocente(tx, bloque.docenteId)

    if (!(await existeDocente(tx, bloque.docenteId))) {
      throw new AppError('NOT_FOUND', 'El docente no existe.')
    }
  }

  const curso = await findCursoParaHorario(tx, bloque.cursoId)

  if (!curso) {
    throw new AppError('NOT_FOUND', 'El curso no existe.')
  }

  if (curso.nivelId !== seccion.nivelId) {
    throw new AppError('VALIDATION_ERROR', undefined, [MENSAJE_NIVEL])
  }

  if (
    bloque.docenteId &&
    !(await existeAsignacionDocente(
      tx,
      bloque.docenteId,
      bloque.cursoId,
      bloque.seccionId,
      bloque.anioId,
    ))
  ) {
    throw new AppError('VALIDATION_ERROR', undefined, [MENSAJE_ASIGNACION])
  }

  if (bloque.horaInicio >= bloque.horaFin) {
    throw new AppError('VALIDATION_ERROR', undefined, [MENSAJE_HORAS])
  }

  if (
    await existeSolapamientoSeccion(
      tx,
      bloque.seccionId,
      bloque,
      excluirId,
    )
  ) {
    throw new AppError('CONFLICT', MENSAJE_SOLAPAMIENTO_SECCION)
  }

  if (
    bloque.docenteId &&
    (await existeSolapamientoDocente(
      tx,
      bloque.docenteId,
      bloque,
      excluirId,
    ))
  ) {
    throw new AppError('CONFLICT', MENSAJE_SOLAPAMIENTO_DOCENTE)
  }
}

/** Traduce el choque del índice único a un conflicto genérico. */
function conflictoDeHorario(error: unknown): AppError | null {
  if (esConflictoDeUnicidad(error)) {
    return new AppError('CONFLICT', MENSAJE_SOLAPAMIENTO_SECCION)
  }

  return null
}

/**
 * Crea un bloque de horario (RF-ACAD-010).
 *
 * Exige `academic.horarios.gestionar`, valida las reglas del bloque y audita el
 * alta. Dos peticiones concurrentes sobre la misma sección se serializan con
 * bloqueos de fila, de modo que la segunda detecta el solapamiento
 * (RN-ACAD-017).
 *
 * @param input Datos validados por Zod.
 * @param actor Usuario autenticado con sus roles.
 * @param contexto IP y user-agent para la auditoría.
 * @param prisma Cliente inyectable para las pruebas.
 * @throws AppError `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_ERROR` o `CONFLICT`.
 */
export async function crearHorario(
  input: CrearHorarioInput,
  actor: ActorAcademico,
  contexto: ContextoAuditoria = {},
  prisma: PrismaClient = getPrisma(),
): Promise<HorarioResponse> {
  assertPermiso(actor, 'academic.horarios.gestionar')

  const bloque: ValoresBloque = {
    anioId: input.anioId,
    seccionId: input.seccionId,
    cursoId: input.cursoId,
    docenteId: input.docenteId ?? null,
    diaSemana: input.diaSemana,
    horaInicio: input.horaInicio,
    horaFin: input.horaFin,
  }

  try {
    return await prisma.$transaction(async (tx) => {
      await validarBloque(tx, bloque)

      const fila = await createHorario(tx, {
        ...bloque,
        docenteId: bloque.docenteId ?? undefined,
        createdBy: actor.id,
      })

      await registrarAuditoria(tx, {
        usuarioId: actor.id,
        accion: 'CREAR',
        entidad: 'HORARIO',
        entidadId: fila.id,
        datos: {
          anioId: fila.anioId,
          seccionId: fila.seccionId,
          cursoId: fila.cursoId,
          docenteId: fila.docenteId,
          diaSemana: fila.diaSemana,
          horaInicio: fila.horaInicio,
          horaFin: fila.horaFin,
        },
        ...contexto,
      })

      return fila
    })
  } catch (error) {
    const conflicto = conflictoDeHorario(error)

    if (conflicto) {
      throw conflicto
    }

    throw error
  }
}

/** Campos que cambiaron entre el bloque persistido y el nuevo. */
function cambiosDe(
  actual: HorarioRow,
  nuevo: ValoresBloque,
): Prisma.InputJsonObject {
  const campos: Array<keyof ValoresBloque> = [
    'anioId',
    'seccionId',
    'cursoId',
    'docenteId',
    'diaSemana',
    'horaInicio',
    'horaFin',
  ]

  return Object.fromEntries(
    campos
      .filter((campo) => actual[campo] !== nuevo[campo])
      .map((campo) => [campo, { anterior: actual[campo], nuevo: nuevo[campo] }]),
  )
}

/**
 * Actualiza un bloque de horario (RF-ACAD-010).
 *
 * Los campos ausentes conservan su valor; la validación se hace sobre los
 * valores efectivos, incluidas las horas (RN-ACAD-018, RN-ACAD-019).
 *
 * @param id Horario a actualizar.
 * @param input Campos a cambiar, validados por Zod.
 * @param actor Usuario autenticado con sus roles.
 * @param contexto IP y user-agent para la auditoría.
 * @param prisma Cliente inyectable para las pruebas.
 * @throws AppError `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_ERROR` o `CONFLICT`.
 */
export async function actualizarHorario(
  id: string,
  input: ActualizarHorarioInput,
  actor: ActorAcademico,
  contexto: ContextoAuditoria = {},
  prisma: PrismaClient = getPrisma(),
): Promise<HorarioResponse> {
  assertPermiso(actor, 'academic.horarios.gestionar')

  try {
    return await prisma.$transaction(async (tx) => {
      const actual = await findHorarioPorId(tx, id)

      if (!actual) {
        throw new AppError('NOT_FOUND', 'El horario no existe.')
      }

      const bloque: ValoresBloque = {
        anioId: input.anioId ?? actual.anioId,
        seccionId: input.seccionId ?? actual.seccionId,
        cursoId: input.cursoId ?? actual.cursoId,
        docenteId:
          input.docenteId === undefined ? actual.docenteId : input.docenteId,
        diaSemana: input.diaSemana ?? actual.diaSemana,
        horaInicio: input.horaInicio ?? actual.horaInicio,
        horaFin: input.horaFin ?? actual.horaFin,
      }

      await validarBloque(tx, bloque, id)

      const fila = await updateHorario(tx, {
        id,
        ...bloque,
        updatedBy: actor.id,
      })

      await registrarAuditoria(tx, {
        usuarioId: actor.id,
        accion: 'ACTUALIZAR',
        entidad: 'HORARIO',
        entidadId: fila.id,
        datos: cambiosDe(actual, bloque),
        ...contexto,
      })

      return fila
    })
  } catch (error) {
    const conflicto = conflictoDeHorario(error)

    if (conflicto) {
      throw conflicto
    }

    throw error
  }
}

/**
 * Elimina lógicamente un bloque de horario (RF-ACAD-010, RN-ACAD-020).
 *
 * Marca `deleted_at` y audita la baja; no borra la fila para conservar el
 * historial.
 *
 * @param id Horario a retirar.
 * @param actor Usuario autenticado con sus roles.
 * @param contexto IP y user-agent para la auditoría.
 * @param prisma Cliente inyectable para las pruebas.
 * @throws AppError `FORBIDDEN` o `NOT_FOUND`.
 */
export async function eliminarHorario(
  id: string,
  actor: ActorAcademico,
  contexto: ContextoAuditoria = {},
  prisma: PrismaClient = getPrisma(),
): Promise<void> {
  assertPermiso(actor, 'academic.horarios.gestionar')

  await prisma.$transaction(async (tx) => {
    const actual = await findHorarioPorId(tx, id)

    if (!actual) {
      throw new AppError('NOT_FOUND', 'El horario no existe.')
    }

    await softDeleteHorario(tx, id, actor.id)

    await registrarAuditoria(tx, {
      usuarioId: actor.id,
      accion: 'RETIRAR',
      entidad: 'HORARIO',
      entidadId: id,
      datos: {
        anioId: actual.anioId,
        seccionId: actual.seccionId,
        cursoId: actual.cursoId,
        diaSemana: actual.diaSemana,
        horaInicio: actual.horaInicio,
        horaFin: actual.horaFin,
      },
      ...contexto,
    })
  })
}
