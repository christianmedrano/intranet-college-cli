import {
  registrarAuditoria,
  type ContextoAuditoria,
} from '../../core/audit.js'
import type { Prisma, PrismaClient } from '../../generated/prisma/client.js'
import type { ActorAcademico } from './scope.js'

/** Entidades académicas cuyo acceso se audita (RF-ACAD-013). */
export type EntidadAccesoAcademico =
  | 'CALIFICACION'
  | 'NOTA_FINAL_PERIODO'
  | 'ASISTENCIA'

/** Recurso consultado y datos no personales que lo describen. */
export interface AccesoAcademico {
  entidadId: string | null
  datos: Prisma.InputJsonObject
}

/**
 * Registra el acceso de un SuperAdmin a un listado académico (RF-ACAD-003,
 * RN-ACAD-022).
 *
 * Solo guarda identificadores y filtros: nunca nombres, documentos ni el
 * contenido de los registros.
 *
 * @param prisma Cliente inyectable para las pruebas.
 * @param actor SuperAdmin que consulta.
 * @param entidad Entidad consultada.
 * @param acceso Identificador del recurso y filtros aplicados.
 * @param contexto IP y user-agent de la petición.
 */
export async function auditarAccesoAcademico(
  prisma: PrismaClient,
  actor: ActorAcademico,
  entidad: EntidadAccesoAcademico,
  acceso: AccesoAcademico,
  contexto: ContextoAuditoria,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await registrarAuditoria(tx, {
      usuarioId: actor.id,
      accion: 'ACCEDER',
      entidad,
      entidadId: acceso.entidadId,
      datos: acceso.datos,
      ...contexto,
    })
  })
}
