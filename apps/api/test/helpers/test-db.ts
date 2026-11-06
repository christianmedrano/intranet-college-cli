import { PrismaMariaDb } from '@prisma/adapter-mariadb'
import { PrismaClient } from '../../src/generated/prisma/client.js'

/** Sufijo obligatorio para evitar borrar por error una base que no sea de pruebas. */
const SUFIJO_BASE_PRUEBAS = '_test'

/**
 * Crea un cliente Prisma aislado contra `TEST_DATABASE_URL`.
 *
 * No reutiliza `DATABASE_URL` a propósito: las pruebas borran datos y nunca
 * deben alcanzar la base de desarrollo.
 *
 * @throws Error si la variable falta o si el nombre de la base no termina en
 * `_test`.
 */
export function createTestPrisma(): PrismaClient {
  const url = process.env.TEST_DATABASE_URL

  if (!url) {
    throw new Error(
      'TEST_DATABASE_URL no está definida. Copia apps/api/.env.example y apunta la variable a una base terminada en "_test".',
    )
  }

  const nombreBase = new URL(url).pathname.replace(/^\//, '')

  if (!nombreBase.endsWith(SUFIJO_BASE_PRUEBAS)) {
    throw new Error(
      `TEST_DATABASE_URL debe apuntar a una base terminada en "${SUFIJO_BASE_PRUEBAS}" (actual: "${nombreBase}").`,
    )
  }

  return new PrismaClient({ adapter: new PrismaMariaDb(url) })
}

/**
 * Tablas en orden de borrado seguro: primero las hijas, después las padres.
 *
 * Se actualiza al agregar modelos. No se usa `TRUNCATE` porque es DDL y provoca
 * un commit implícito en MySQL, lo que rompería una limpieza transaccional.
 */
const TABLAS_EN_ORDEN_DE_BORRADO = [
  'auditoria',
  'sesion_refresh',
  'token_recuperacion',
  'usuario_rol',
  'asignacion_docente',
  'matricula',
  'apoderado_alumno',
  'periodo_academico',
  'seccion',
  'curso',
  'grado',
  'nivel',
  'alumno',
  'docente',
  'apoderado',
  'usuario',
  'persona',
  'anio_academico',
  'institucion',
  'rol',
] as const

/**
 * Vacía la base de pruebas antes de cada caso.
 *
 * @param prisma Cliente creado con {@link createTestPrisma}.
 */
export async function limpiarBaseDePruebas(
  prisma: PrismaClient,
): Promise<void> {
  for (const tabla of TABLAS_EN_ORDEN_DE_BORRADO) {
    await prisma.$executeRawUnsafe(`DELETE FROM \`${tabla}\``)
  }
}
