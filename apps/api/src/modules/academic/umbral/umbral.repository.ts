import type { Prisma } from '../../../generated/prisma/client.js'

/** Fila interna del umbral de un año. */
export interface UmbralRow {
  anioId: string
  faltasParaAlerta: number
}

/** Busca el umbral de un año; `null` si no está configurado (RN-ACAD-014). */
export async function findUmbralPorAnio(
  prisma: Prisma.TransactionClient,
  anioId: string,
): Promise<UmbralRow | null> {
  return prisma.umbralAsistencia.findUnique({
    where: { anioId },
    select: { anioId: true, faltasParaAlerta: true },
  })
}

export interface GuardarUmbralData {
  anioId: string
  faltasParaAlerta: number
  updatedBy: string
}

/** Crea o reemplaza el umbral del año (RF-ACAD-008). */
export async function upsertUmbral(
  prisma: Prisma.TransactionClient,
  datos: GuardarUmbralData,
): Promise<UmbralRow> {
  return prisma.umbralAsistencia.upsert({
    where: { anioId: datos.anioId },
    create: {
      anioId: datos.anioId,
      faltasParaAlerta: datos.faltasParaAlerta,
      createdBy: datos.updatedBy,
    },
    update: {
      faltasParaAlerta: datos.faltasParaAlerta,
      updatedBy: datos.updatedBy,
    },
    select: { anioId: true, faltasParaAlerta: true },
  })
}
