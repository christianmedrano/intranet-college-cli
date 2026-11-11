import type {
  AlertaAsistenciaResponse,
  Paginated,
  PaginationInput,
} from '@intranet/shared'
import type { Prisma } from '../../../generated/prisma/client.js'
import type { PrismaClient } from '../../../generated/prisma/client.js'
import type { ContextoAuditoria } from '../../../core/audit.js'
import { getPrisma } from '../../../core/db.js'
import { auditarAccesoAcademico } from '../consulta-audit.js'
import { assertPermiso, type ActorAcademico } from '../scope.js'
import { findUmbralPorAnio } from '../umbral/umbral.repository.js'
import {
  countAlertas,
  countFaltasInjustificadas,
  deleteAlerta,
  deleteAlertasBajoUmbral,
  findAlertas,
  findAlumnoIdsConFaltas,
  upsertAlerta,
} from './alerta.repository.js'
import {
  construirAlcanceAlertas,
  type FiltrosConsultaAlertas,
} from './alerta.scope.js'

/**
 * Lista las alertas de inasistencias con el alcance del solicitante
 * (RF-ACAD-009).
 *
 * El Director y el SuperAdmin ven todas (el segundo con acceso auditado); el
 * docente, las de sus secciones y años; el apoderado, las de sus alumnos; el
 * alumno, la propia.
 *
 * @param filtros Filtros validados por Zod.
 * @param paginacion Página y tamaño ya validados por Zod.
 * @param actor Usuario autenticado con sus roles.
 * @param contexto IP y user-agent para la auditoría.
 * @param prisma Cliente inyectable para las pruebas.
 * @throws AppError `FORBIDDEN` si un filtro está fuera de alcance.
 */
export async function listarAlertas(
  filtros: FiltrosConsultaAlertas,
  paginacion: PaginationInput,
  actor: ActorAcademico,
  contexto: ContextoAuditoria = {},
  prisma: PrismaClient = getPrisma(),
): Promise<Paginated<AlertaAsistenciaResponse>> {
  assertPermiso(actor, 'academic.asistencias.leer')

  const { where, datosAcceso, auditarAcceso } = await construirAlcanceAlertas(
    actor,
    filtros,
    prisma,
  )

  const total = await countAlertas(prisma, where)
  const data = await findAlertas(prisma, where, paginacion)

  if (auditarAcceso) {
    await auditarAccesoAcademico(
      prisma,
      actor,
      'ALERTA_ASISTENCIA',
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

/** Rango de fechas del año vigente, o `null` si no existe. */
async function rangoDelAnio(
  prisma: Prisma.TransactionClient,
  anioId: string,
): Promise<{ fechaInicio: Date; fechaFin: Date } | null> {
  return prisma.anioAcademico.findFirst({
    where: { id: anioId, deletedAt: null },
    select: { fechaInicio: true, fechaFin: true },
  })
}

/**
 * Recalcula la alerta de un alumno en un año (RN-ACAD-015, RN-ACAD-016).
 *
 * - Sin umbral configurado no hay alerta y se elimina cualquiera previa
 *   (RN-ACAD-014).
 * - Con faltas injustificadas `>=` umbral se crea o actualiza la alerta.
 * - Por debajo del umbral se elimina.
 *
 * Debe ejecutarse dentro de la transacción que cambia la asistencia o el
 * umbral, para que la alerta nunca quede desincronizada.
 *
 * @param prisma Cliente transaccional.
 * @param alumnoId Alumno afectado.
 * @param anioId Año de la alerta.
 * @returns La alerta vigente o `null` si no corresponde.
 */
export async function recalcularAlerta(
  prisma: Prisma.TransactionClient,
  alumnoId: string,
  anioId: string,
): Promise<AlertaAsistenciaResponse | null> {
  const rango = await rangoDelAnio(prisma, anioId)

  if (!rango) {
    return null
  }

  const umbral = await findUmbralPorAnio(prisma, anioId)

  if (!umbral) {
    await deleteAlerta(prisma, alumnoId, anioId)
    return null
  }

  const faltas = await countFaltasInjustificadas(
    prisma,
    alumnoId,
    rango.fechaInicio,
    rango.fechaFin,
  )

  if (faltas >= umbral.faltasParaAlerta) {
    return upsertAlerta(prisma, {
      alumnoId,
      anioId,
      faltasInjustificadas: faltas,
      umbral: umbral.faltasParaAlerta,
    })
  }

  await deleteAlerta(prisma, alumnoId, anioId)
  return null
}

/**
 * Recalcula las alertas de todo un año tras cambiar el umbral (RF-ACAD-009).
 *
 * Elimina primero las alertas que quedaron por debajo del nuevo umbral y luego
 * recalcula a los alumnos con faltas injustificadas, de modo que bajar el umbral
 * también genera las alertas que correspondan.
 *
 * @param prisma Cliente transaccional.
 * @param anioId Año cuyo umbral cambió.
 */
export async function recalcularAlertasDelAnio(
  prisma: Prisma.TransactionClient,
  anioId: string,
): Promise<void> {
  const rango = await rangoDelAnio(prisma, anioId)

  if (!rango) {
    return
  }

  const umbral = await findUmbralPorAnio(prisma, anioId)

  if (!umbral) {
    await prisma.alertaAsistencia.deleteMany({ where: { anioId } })
    return
  }

  await deleteAlertasBajoUmbral(prisma, anioId, umbral.faltasParaAlerta)

  const alumnoIds = await findAlumnoIdsConFaltas(
    prisma,
    rango.fechaInicio,
    rango.fechaFin,
  )

  for (const alumnoId of alumnoIds) {
    await recalcularAlerta(prisma, alumnoId, anioId)
  }
}
