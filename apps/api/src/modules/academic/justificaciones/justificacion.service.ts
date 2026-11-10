import type {
  CrearJustificacionInput,
  JustificacionResponse,
  RechazarJustificacionInput,
  ResolverJustificacionInput,
} from '@intranet/shared'
import {
  registrarAuditoria,
  type ContextoAuditoria,
} from '../../../core/audit.js'
import { assertApoderadoOfAlumno } from '../../../core/auth/vinculo.js'
import { getPrisma } from '../../../core/db.js'
import { AppError } from '../../../core/errors.js'
import type { PrismaClient } from '../../../generated/prisma/client.js'
import {
  findAsistenciaPorId,
  findMatriculaAprobadaPorFecha,
  updateAsistencia,
} from '../asistencias/asistencia.repository.js'
import {
  assertPermiso,
  esAdministrativoAcademico,
  type ActorAcademico,
} from '../scope.js'
import {
  createJustificacion,
  esTutorDeSeccion,
  existeSolicitudAbierta,
  findJustificacionPorId,
  resolverJustificacion,
  type JustificacionRow,
} from './justificacion.repository.js'

const MENSAJE_NO_FALTA =
  'Solo se justifica una asistencia en estado de falta injustificada.'

const MENSAJE_SOLICITUD_ABIERTA =
  'La asistencia ya tiene una solicitud de justificación abierta.'

const MENSAJE_RESUELTA = 'La solicitud ya fue resuelta.'

const MENSAJE_AUTOR = 'Nadie puede resolver su propia solicitud.'

const MENSAJE_TUTOR =
  'Solo el docente tutor de la sección o el Director pueden resolver la solicitud.'

const MENSAJE_MATRICULA =
  'El alumno no tiene matrícula aprobada en el año de la asistencia.'

/**
 * Registra la solicitud de justificación de una falta (RF-ACAD-006).
 *
 * Solo el apoderado vinculado puede solicitarla, sobre una asistencia en estado
 * `FALTA_INJUSTIFICADA` y sin otra solicitud abierta (RN-ACAD-011, RN-ACAD-012,
 * RN-ACAD-026).
 *
 * @param asistenciaId Asistencia que se desea justificar.
 * @param input Motivo validado por Zod.
 * @param actor Usuario autenticado con sus roles.
 * @param contexto IP y user-agent para la auditoría.
 * @param prisma Cliente inyectable para las pruebas.
 * @throws AppError `FORBIDDEN`, `NOT_FOUND` o `CONFLICT`.
 */
export async function solicitarJustificacion(
  asistenciaId: string,
  input: CrearJustificacionInput,
  actor: ActorAcademico,
  contexto: ContextoAuditoria = {},
  prisma: PrismaClient = getPrisma(),
): Promise<JustificacionResponse> {
  assertPermiso(actor, 'academic.asistencias.solicitar')

  const asistencia = await findAsistenciaPorId(prisma, asistenciaId)

  if (!asistencia) {
    throw new AppError('NOT_FOUND', 'La asistencia no existe.')
  }

  await assertApoderadoOfAlumno(actor.id, asistencia.alumnoId, prisma)

  if (asistencia.estado !== 'FALTA_INJUSTIFICADA') {
    throw new AppError('CONFLICT', MENSAJE_NO_FALTA)
  }

  if (await existeSolicitudAbierta(prisma, asistenciaId)) {
    throw new AppError('CONFLICT', MENSAJE_SOLICITUD_ABIERTA)
  }

  return prisma.$transaction(async (tx) => {
    const fila = await createJustificacion(tx, {
      asistenciaId,
      solicitanteUsuarioId: actor.id,
      motivo: input.motivo,
    })

    await registrarAuditoria(tx, {
      usuarioId: actor.id,
      accion: 'CREAR',
      entidad: 'JUSTIFICACION_FALTA',
      entidadId: fila.id,
      datos: { asistenciaId: fila.asistenciaId },
      ...contexto,
    })

    return fila
  })
}

/**
 * Comprueba que el actor pueda resolver la solicitud.
 *
 * La aprobación y el rechazo son exclusivos del docente tutor de la sección o
 * del Director (RN-ACAD-012); nadie resuelve su propia solicitud.
 *
 * @throws AppError `CONFLICT` si ya está resuelta; `FORBIDDEN` si no autoriza.
 */
async function assertPuedeResolver(
  actor: ActorAcademico,
  justificacion: JustificacionRow,
  prisma: PrismaClient,
): Promise<void> {
  if (justificacion.estado !== 'SOLICITADA') {
    throw new AppError('CONFLICT', MENSAJE_RESUELTA)
  }

  if (justificacion.solicitanteUsuarioId === actor.id) {
    throw new AppError('FORBIDDEN', MENSAJE_AUTOR)
  }

  if (esAdministrativoAcademico(actor)) {
    return
  }

  const asistencia = await findAsistenciaPorId(prisma, justificacion.asistenciaId)

  if (!asistencia) {
    throw new AppError('NOT_FOUND', 'La asistencia no existe.')
  }

  const matricula = await findMatriculaAprobadaPorFecha(
    prisma,
    asistencia.alumnoId,
    asistencia.fecha,
  )

  if (!matricula) {
    throw new AppError('CONFLICT', MENSAJE_MATRICULA)
  }

  const esTutor = await esTutorDeSeccion(
    prisma,
    actor.id,
    matricula.seccionId,
    matricula.anioId,
  )

  if (!esTutor) {
    throw new AppError('FORBIDDEN', MENSAJE_TUTOR)
  }
}

/**
 * Aprueba una solicitud de justificación (RF-ACAD-006).
 *
 * Cambia la asistencia de `FALTA_INJUSTIFICADA` a `FALTA_JUSTIFICADA` en la
 * misma transacción y deja la resolución auditada (RN-ACAD-012).
 *
 * @param id Solicitud a aprobar.
 * @param input Comentario opcional.
 * @param actor Usuario autenticado con sus roles.
 * @param contexto IP y user-agent para la auditoría.
 * @param prisma Cliente inyectable para las pruebas.
 * @throws AppError `FORBIDDEN`, `NOT_FOUND` o `CONFLICT`.
 */
export async function aprobarJustificacion(
  id: string,
  input: ResolverJustificacionInput,
  actor: ActorAcademico,
  contexto: ContextoAuditoria = {},
  prisma: PrismaClient = getPrisma(),
): Promise<JustificacionResponse> {
  assertPermiso(actor, 'academic.asistencias.justificar')

  const justificacion = await findJustificacionPorId(prisma, id)

  if (!justificacion) {
    throw new AppError('NOT_FOUND', 'La solicitud no existe.')
  }

  await assertPuedeResolver(actor, justificacion, prisma)

  return prisma.$transaction(async (tx) => {
    const fila = await resolverJustificacion(tx, {
      id,
      estado: 'APROBADA',
      resueltoPor: actor.id,
      resueltoEn: new Date(),
      motivoResolucion: input.comentario,
    })

    await updateAsistencia(tx, {
      id: fila.asistenciaId,
      estado: 'FALTA_JUSTIFICADA',
      updatedBy: actor.id,
    })

    await registrarAuditoria(tx, {
      usuarioId: actor.id,
      accion: 'APROBAR',
      entidad: 'JUSTIFICACION_FALTA',
      entidadId: fila.id,
      datos: {
        asistenciaId: fila.asistenciaId,
        estado: {
          anterior: 'FALTA_INJUSTIFICADA',
          nuevo: 'FALTA_JUSTIFICADA',
        },
      },
      ...contexto,
    })

    return fila
  })
}

/**
 * Rechaza una solicitud de justificación (RF-ACAD-006).
 *
 * El motivo del rechazo es obligatorio; la asistencia permanece en
 * `FALTA_INJUSTIFICADA` (RN-ACAD-012).
 *
 * @param id Solicitud a rechazar.
 * @param input Motivo del rechazo.
 * @param actor Usuario autenticado con sus roles.
 * @param contexto IP y user-agent para la auditoría.
 * @param prisma Cliente inyectable para las pruebas.
 * @throws AppError `FORBIDDEN`, `NOT_FOUND` o `CONFLICT`.
 */
export async function rechazarJustificacion(
  id: string,
  input: RechazarJustificacionInput,
  actor: ActorAcademico,
  contexto: ContextoAuditoria = {},
  prisma: PrismaClient = getPrisma(),
): Promise<JustificacionResponse> {
  assertPermiso(actor, 'academic.asistencias.justificar')

  const justificacion = await findJustificacionPorId(prisma, id)

  if (!justificacion) {
    throw new AppError('NOT_FOUND', 'La solicitud no existe.')
  }

  await assertPuedeResolver(actor, justificacion, prisma)

  return prisma.$transaction(async (tx) => {
    const fila = await resolverJustificacion(tx, {
      id,
      estado: 'RECHAZADA',
      resueltoPor: actor.id,
      resueltoEn: new Date(),
      motivoResolucion: input.motivo,
    })

    await registrarAuditoria(tx, {
      usuarioId: actor.id,
      accion: 'RECHAZAR',
      entidad: 'JUSTIFICACION_FALTA',
      entidadId: fila.id,
      datos: { asistenciaId: fila.asistenciaId, motivo: input.motivo },
      ...contexto,
    })

    return fila
  })
}
