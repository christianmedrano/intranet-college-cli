import {
  registrarAuditoria,
  type ContextoAuditoria,
} from '../../../core/audit.js'
import type { PrismaClient } from '../../../generated/prisma/client.js'
import type { ActorAcademico } from '../scope.js'

/**
 * Registra el acceso de un SuperAdmin a un listado académico (RF-ACAD-003,
 * RN-ACAD-022).
 *
 * Solo guarda identificadores: nunca nombres, documentos ni el contenido de las
 * calificaciones.
 *
 * @param prisma Cliente inyectable para las pruebas.
 * @param actor SuperAdmin que consulta.
 * @param entidad Entidad consultada.
 * @param periodoId Período consultado, usado como identificador del recurso.
 * @param contexto IP y user-agent de la petición.
 */
export async function auditarAccesoAcademico(
  prisma: PrismaClient,
  actor: ActorAcademico,
  entidad: 'CALIFICACION' | 'NOTA_FINAL_PERIODO',
  periodoId: string,
  contexto: ContextoAuditoria,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await registrarAuditoria(tx, {
      usuarioId: actor.id,
      accion: 'ACCEDER',
      entidad,
      entidadId: periodoId,
      datos: { periodoId },
      ...contexto,
    })
  })
}
