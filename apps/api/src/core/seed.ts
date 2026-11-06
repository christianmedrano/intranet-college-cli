import { z } from 'zod'
import { roleCodes, type RoleCode } from '@intranet/shared'
import { hashPassword } from './auth/password.js'
import { loadConfig } from './config.js'
import { getPrisma } from './db.js'

/**
 * UUID fijo de la institución de ejemplo.
 *
 * Es fijo a propósito: permite que el seed sea idempotente sin depender de una
 * búsqueda por nombre (que no es único en el modelo).
 */
export const SEED_INSTITUCION_ID = '00000000-0000-4000-8000-000000000001'

const NOMBRE_INSTITUCION_POR_DEFECTO = 'Institución Educativa de Ejemplo'

/** Nombres visibles de los roles. Fuente: `docs/constitution.md` §7 y spec core §3. */
const datosRol: Readonly<
  Record<RoleCode, { nombre: string; descripcion: string }>
> = {
  SUPER_ADMIN: {
    nombre: 'SuperAdmin',
    descripcion: 'Acceso total al sistema y a la configuración institucional',
  },
  DIRECTOR: {
    nombre: 'Director',
    descripcion: 'Gestión académica y administrativa de la institución',
  },
  DOCENTE: {
    nombre: 'Docente',
    descripcion: 'Docente asignado a cursos y secciones',
  },
  APODERADO: {
    nombre: 'Padre/Apoderado',
    descripcion: 'Padre, madre o tutor responsable de un alumno',
  },
  ALUMNO: {
    nombre: 'Alumno',
    descripcion: 'Estudiante matriculado en la institución',
  },
}

const superAdminSchema = z.object({
  SEED_ADMIN_USERNAME: z.string().min(3).max(60),
  SEED_ADMIN_PASSWORD: z.string().min(10, 'debe tener al menos 10 caracteres'),
  SEED_ADMIN_EMAIL: z.email().optional(),
  SEED_ADMIN_NOMBRES: z.string().min(1).max(100).default('Superadministrador'),
  SEED_ADMIN_APELLIDOS: z.string().min(1).max(100).default('Sistema'),
  SEED_ADMIN_TIPO_DOCUMENTO: z.string().min(2).max(20).default('DNI'),
  SEED_ADMIN_DOCUMENTO: z.string().min(4).max(30).default('00000000'),
})

export interface SeedResult {
  /** Roles sincronizados (siempre `roleCodes.length`). */
  roles: number
  /** Identificador de la institución de ejemplo. */
  institucionId: string
  /** `true` si el SuperAdmin se creó en esta ejecución. */
  superAdminCreado: boolean
}

/**
 * Carga los datos mínimos para operar en desarrollo.
 *
 * Idempotente: se puede ejecutar cuantas veces sea necesario. Nunca sobrescribe
 * la contraseña de un SuperAdmin existente ni los datos editados de la
 * institución.
 *
 * @returns Resumen de lo aplicado, sin datos personales.
 * @throws Error si el entorno es producción o falta la configuración del
 * SuperAdmin. La constitución (§6) prohíbe datos semilla en producción.
 */
export async function runSeed(): Promise<SeedResult> {
  const config = loadConfig()

  if (config.NODE_ENV === 'production') {
    throw new Error(
      'El seed no se ejecuta en producción (Constitución §6).',
    )
  }

  const admin = leerConfiguracionSuperAdmin()
  const prisma = getPrisma()

  for (const codigo of roleCodes) {
    const { nombre, descripcion } = datosRol[codigo]
    await prisma.rol.upsert({
      where: { codigo },
      create: { codigo, nombre, descripcion },
      update: { nombre, descripcion },
    })
  }

  const institucion = await prisma.institucion.upsert({
    where: { id: SEED_INSTITUCION_ID },
    create: {
      id: SEED_INSTITUCION_ID,
      nombre: NOMBRE_INSTITUCION_POR_DEFECTO,
    },
    // No se sobrescriben los datos que un administrador haya editado.
    update: {},
  })

  const rolSuperAdmin = await prisma.rol.findUniqueOrThrow({
    where: { codigo: 'SUPER_ADMIN' },
  })

  const existente = await prisma.usuario.findUnique({
    where: { username: admin.SEED_ADMIN_USERNAME },
  })

  let usuarioId: string
  let superAdminCreado = false

  if (existente) {
    usuarioId = existente.id
  } else {
    const personaConDocumento = await prisma.persona.findUnique({
      where: {
        tipoDocumento_numeroDocumento: {
          tipoDocumento: admin.SEED_ADMIN_TIPO_DOCUMENTO,
          numeroDocumento: admin.SEED_ADMIN_DOCUMENTO,
        },
      },
      include: { usuario: true },
    })

    if (personaConDocumento?.usuario) {
      throw new Error(
        'SEED_ADMIN_DOCUMENTO ya pertenece a otro usuario; usa otro documento.',
      )
    }

    const creado = await prisma.usuario.create({
      data: {
        username: admin.SEED_ADMIN_USERNAME,
        email: admin.SEED_ADMIN_EMAIL,
        passwordHash: await hashPassword(admin.SEED_ADMIN_PASSWORD),
        debeCambiarPassword: true,
        persona: personaConDocumento
          ? { connect: { id: personaConDocumento.id } }
          : {
              create: {
                nombres: admin.SEED_ADMIN_NOMBRES,
                apellidos: admin.SEED_ADMIN_APELLIDOS,
                tipoDocumento: admin.SEED_ADMIN_TIPO_DOCUMENTO,
                numeroDocumento: admin.SEED_ADMIN_DOCUMENTO,
              },
            },
      },
    })

    usuarioId = creado.id
    superAdminCreado = true
  }

  await prisma.usuarioRol.upsert({
    where: {
      usuarioId_rolId: { usuarioId, rolId: rolSuperAdmin.id },
    },
    create: { usuarioId, rolId: rolSuperAdmin.id },
    update: {},
  })

  return {
    roles: roleCodes.length,
    institucionId: institucion.id,
    superAdminCreado,
  }
}

/**
 * Lee y valida las variables del SuperAdmin.
 *
 * Las cadenas vacías se tratan como ausentes para que un `.env` con
 * `SEED_ADMIN_EMAIL=` no rompa el seed.
 */
function leerConfiguracionSuperAdmin(): z.infer<typeof superAdminSchema> {
  const limpio = Object.fromEntries(
    Object.entries(process.env).map(([clave, valor]) => [
      clave,
      valor?.trim() === '' ? undefined : valor,
    ]),
  )

  const parsed = superAdminSchema.safeParse(limpio)

  if (!parsed.success) {
    const detalle = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ')

    throw new Error(
      `Configuración del seed inválida (${detalle}). Define SEED_ADMIN_USERNAME y SEED_ADMIN_PASSWORD en apps/api/.env.`,
    )
  }

  const admin = parsed.data

  if (
    admin.SEED_ADMIN_PASSWORD === admin.SEED_ADMIN_USERNAME ||
    admin.SEED_ADMIN_PASSWORD === admin.SEED_ADMIN_DOCUMENTO
  ) {
    throw new Error(
      'SEED_ADMIN_PASSWORD no puede ser igual al usuario ni al documento (RN-CORE-017).',
    )
  }

  return admin
}
