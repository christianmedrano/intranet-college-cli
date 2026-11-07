import type { PersonaResponse } from '@intranet/shared'
import type { Prisma } from '../../../generated/prisma/client.js'
import { aFechaISO, aFechaUTC } from '../estructura/fechas.js'

/** Campos de `Persona` expuestos por los contratos públicos. */
export const CAMPOS_PERSONA = {
  id: true,
  nombres: true,
  apellidos: true,
  tipoDocumento: true,
  numeroDocumento: true,
  fechaNacimiento: true,
  telefono: true,
  emailContacto: true,
  direccion: true,
} as const

/** Fila interna de persona; `fechaNacimiento` llega como `Date` de MySQL. */
export interface PersonaRow {
  id: string
  nombres: string
  apellidos: string
  tipoDocumento: string
  numeroDocumento: string
  fechaNacimiento: Date | null
  telefono: string | null
  emailContacto: string | null
  direccion: string | null
}

/** Proyecta la fila interna al contrato público. */
export function toPersonaResponse(fila: PersonaRow): PersonaResponse {
  return {
    id: fila.id,
    nombres: fila.nombres,
    apellidos: fila.apellidos,
    tipoDocumento: fila.tipoDocumento,
    numeroDocumento: fila.numeroDocumento,
    fechaNacimiento: fila.fechaNacimiento
      ? aFechaISO(fila.fechaNacimiento)
      : null,
    telefono: fila.telefono,
    emailContacto: fila.emailContacto,
    direccion: fila.direccion,
  }
}

export interface CrearPersonaData {
  nombres: string
  apellidos: string
  tipoDocumento: string
  numeroDocumento: string
  fechaNacimiento?: string | null
  telefono?: string | null
  emailContacto?: string | null
  direccion?: string | null
  createdBy: string
}

/**
 * Crea una persona. Debe ejecutarse dentro de la transacción que crea la
 * entidad de rol, para que no queden personas huérfanas (RF-CORE-012/013/014).
 */
export async function createPersona(
  db: Prisma.TransactionClient,
  datos: CrearPersonaData,
): Promise<PersonaRow> {
  return db.persona.create({
    data: {
      nombres: datos.nombres,
      apellidos: datos.apellidos,
      tipoDocumento: datos.tipoDocumento,
      numeroDocumento: datos.numeroDocumento,
      fechaNacimiento:
        datos.fechaNacimiento === null || datos.fechaNacimiento === undefined
          ? null
          : aFechaUTC(datos.fechaNacimiento),
      telefono: datos.telefono ?? null,
      emailContacto: datos.emailContacto ?? null,
      direccion: datos.direccion ?? null,
      createdBy: datos.createdBy,
    },
    select: CAMPOS_PERSONA,
  })
}

export interface ActualizarPersonaData {
  nombres?: string
  apellidos?: string
  tipoDocumento?: string
  numeroDocumento?: string
  fechaNacimiento?: string | null
  telefono?: string | null
  emailContacto?: string | null
  direccion?: string | null
  updatedBy: string
}

/**
 * Actualiza solo los campos enviados de la persona.
 *
 * `undefined` conserva el valor; `null` vacía los campos que lo admiten.
 */
export async function updatePersonaPorId(
  db: Prisma.TransactionClient,
  id: string,
  datos: ActualizarPersonaData,
): Promise<PersonaRow> {
  return db.persona.update({
    where: { id },
    data: {
      ...(datos.nombres !== undefined ? { nombres: datos.nombres } : {}),
      ...(datos.apellidos !== undefined ? { apellidos: datos.apellidos } : {}),
      ...(datos.tipoDocumento !== undefined
        ? { tipoDocumento: datos.tipoDocumento }
        : {}),
      ...(datos.numeroDocumento !== undefined
        ? { numeroDocumento: datos.numeroDocumento }
        : {}),
      ...(datos.fechaNacimiento !== undefined
        ? {
            fechaNacimiento: datos.fechaNacimiento
              ? aFechaUTC(datos.fechaNacimiento)
              : null,
          }
        : {}),
      ...(datos.telefono !== undefined ? { telefono: datos.telefono } : {}),
      ...(datos.emailContacto !== undefined
        ? { emailContacto: datos.emailContacto }
        : {}),
      ...(datos.direccion !== undefined ? { direccion: datos.direccion } : {}),
      updatedBy: datos.updatedBy,
    },
    select: CAMPOS_PERSONA,
  })
}
