import type { Permission } from '@intranet/shared'
import { getPrisma } from '../../core/db.js'
import { AppError } from '../../core/errors.js'
import { hasPermission, type AuthActor } from '../../core/rbac.js'
import { assertDocenteAssignedTo } from '../../core/auth/vinculo.js'
import type { PrismaClient } from '../../generated/prisma/client.js'

/**
 * Identidad mínima que consumen los servicios académicos.
 *
 * Los controladores la construyen desde `request.authUser`; las pruebas la
 * inyectan directamente.
 */
export type ActorAcademico = Pick<AuthActor, 'id' | 'roles'>

/**
 * Exige un permiso académico con el mismo criterio que `requirePermission`.
 *
 * Los servicios lo revalidan para que ninguna llamada interna omita el control
 * (RN-ACAD-023).
 *
 * @throws AppError `FORBIDDEN` si el actor no tiene el permiso.
 */
export function assertPermiso(
  actor: ActorAcademico,
  permission: Permission,
): void {
  if (!hasPermission(actor.roles, permission)) {
    throw new AppError('FORBIDDEN')
  }
}

/**
 * Resuelve la sección del alumno a partir de su matrícula `APROBADA` en el año
 * (RN-ACAD-008).
 *
 * @throws AppError `CONFLICT` si el alumno no tiene matrícula aprobada.
 */
export async function resolverSeccionDeAlumnoEnAnio(
  alumnoId: string,
  anioId: string,
  prisma: PrismaClient = getPrisma(),
): Promise<string> {
  const matricula = await prisma.matricula.findFirst({
    where: { alumnoId, anioId, estado: 'APROBADA', deletedAt: null },
    select: { seccionId: true },
  })

  if (!matricula) {
    throw new AppError(
      'CONFLICT',
      'El alumno no tiene matrícula aprobada en el año indicado.',
    )
  }

  return matricula.seccionId
}

/**
 * Exige que el docente tenga una asignación vigente para curso, sección y año
 * (RN-ACAD-007).
 *
 * No evalúa roles: el servicio decide cuándo aplicarlo.
 *
 * @throws AppError `FORBIDDEN` si no existe la asignación.
 */
export async function assertDocenteDeCursoSeccion(
  actor: ActorAcademico,
  cursoId: string,
  seccionId: string,
  anioId: string,
  prisma: PrismaClient = getPrisma(),
): Promise<void> {
  await assertDocenteAssignedTo(
    actor.id,
    { cursoId, seccionId, anioId },
    prisma,
  )
}
