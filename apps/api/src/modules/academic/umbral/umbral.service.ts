import type {
  UmbralAsistenciaInput,
  UmbralAsistenciaResponse,
} from '@intranet/shared'
import {
  registrarAuditoria,
  type ContextoAuditoria,
} from '../../../core/audit.js'
import { getPrisma } from '../../../core/db.js'
import { AppError } from '../../../core/errors.js'
import type { PrismaClient } from '../../../generated/prisma/client.js'
import { findAnioAcademicoPorId } from '../../core/estructura/anio-academico.repository.js'
import { recalcularAlertasDelAnio } from '../alertas/alerta.service.js'
import { assertPermiso, type ActorAcademico } from '../scope.js'
import {
  findUmbralPorAnio,
  upsertUmbral,
} from './umbral.repository.js'

/**
 * Consulta el umbral de inasistencias de un año (RF-ACAD-008).
 *
 * Devuelve `faltasParaAlerta: null` cuando el año no lo tiene configurado; en
 * ese caso no se generan alertas (RN-ACAD-013, RN-ACAD-014).
 *
 * @param anioId Año académico consultado.
 * @param actor Usuario autenticado; debe poder gestionar la estructura.
 * @param prisma Cliente inyectable para las pruebas.
 * @throws AppError `NOT_FOUND` si el año no existe; `FORBIDDEN` sin permiso.
 */
export async function obtenerUmbral(
  anioId: string,
  actor: ActorAcademico,
  prisma: PrismaClient = getPrisma(),
): Promise<UmbralAsistenciaResponse> {
  assertPermiso(actor, 'core.estructura.gestionar')

  const anio = await findAnioAcademicoPorId(prisma, anioId)

  if (!anio) {
    throw new AppError('NOT_FOUND', 'El año académico no existe.')
  }

  const umbral = await findUmbralPorAnio(prisma, anioId)

  return {
    anioId,
    faltasParaAlerta: umbral?.faltasParaAlerta ?? null,
  }
}

/**
 * Configura el umbral de inasistencias de un año (RF-ACAD-008).
 *
 * En la misma transacción guarda el umbral, lo audita y recalcula las alertas
 * del año: las que quedan por debajo del nuevo umbral se eliminan y las que lo
 * alcanzan se generan (RN-ACAD-015, RN-ACAD-016).
 *
 * @param anioId Año académico a configurar.
 * @param input Umbral entero positivo validado por Zod.
 * @param actor Usuario autenticado; debe poder gestionar la estructura.
 * @param contexto IP y user-agent para la auditoría.
 * @param prisma Cliente inyectable para las pruebas.
 * @throws AppError `NOT_FOUND` si el año no existe; `FORBIDDEN` sin permiso.
 */
export async function guardarUmbral(
  anioId: string,
  input: UmbralAsistenciaInput,
  actor: ActorAcademico,
  contexto: ContextoAuditoria = {},
  prisma: PrismaClient = getPrisma(),
): Promise<UmbralAsistenciaResponse> {
  assertPermiso(actor, 'core.estructura.gestionar')

  const anio = await findAnioAcademicoPorId(prisma, anioId)

  if (!anio) {
    throw new AppError('NOT_FOUND', 'El año académico no existe.')
  }

  const anterior = await findUmbralPorAnio(prisma, anioId)

  return prisma.$transaction(async (tx) => {
    const umbral = await upsertUmbral(tx, {
      anioId,
      faltasParaAlerta: input.faltasParaAlerta,
      updatedBy: actor.id,
    })

    await registrarAuditoria(tx, {
      usuarioId: actor.id,
      accion: anterior ? 'ACTUALIZAR' : 'CREAR',
      entidad: 'UMBRAL_ASISTENCIA',
      entidadId: umbral.anioId,
      datos: {
        anioId,
        faltasParaAlerta: {
          anterior: anterior?.faltasParaAlerta ?? null,
          nuevo: umbral.faltasParaAlerta,
        },
      },
      ...contexto,
    })

    await recalcularAlertasDelAnio(tx, anioId)

    return umbral
  })
}
