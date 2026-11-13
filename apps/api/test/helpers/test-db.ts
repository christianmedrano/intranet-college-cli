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
  'certificado',
  'pago',
  'plantilla_certificado',
  'asignacion_docente',
  'matricula',
  'apoderado_alumno',
  'justificacion_falta',
  'alerta_asistencia',
  'umbral_asistencia',
  'horario',
  'calificacion',
  'nota_final_periodo',
  'asistencia',
  'adjuntos_virtuales',
  'materiales_virtuales',
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
  // 'institucion' se excluye deliberadamente: debe persistir entre tests
  // para que el guard de autenticación siempre encuentre una institución.
  'rol',
] as const

/**
 * Vacía la base de pruebas antes de cada caso (excepto la institución) y asegura
 * que exista una institución por defecto con ID fijo.
 *
 * @param prisma Cliente creado con {@link createTestPrisma}.
 */
export async function limpiarBaseDePruebas(
  prisma: PrismaClient,
): Promise<void> {
  for (const tabla of TABLAS_EN_ORDEN_DE_BORRADO) {
    await prisma.$executeRawUnsafe(`DELETE FROM \`${tabla}\``)
  }

  // Borrar cualquier institución distinta de la fija; así `findInstitucionVigente`
  // (que ordena por createdAt ASC) siempre devuelve la de prueba.
  await prisma.$executeRawUnsafe(
    `DELETE FROM \`institucion\` WHERE \`id\` <> '00000000-0000-4000-8000-000000000001'`,
  )

  // Asegurar que exista la institución por defecto con ID fijo (requerida por el guard de autenticación).
  // Los tests NO deben crear sus propias instituciones; deben usar esta.
  await prisma.institucion.upsert({
    where: { id: '00000000-0000-4000-8000-000000000001' },
    create: { id: '00000000-0000-4000-8000-000000000001', nombre: 'Institución de Prueba' },
    update: {},
  })
}
