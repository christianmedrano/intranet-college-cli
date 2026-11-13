import {
  matriculaAdminResponseSchema,
  paginatedMatriculasAdminSchema,
  type SolicitarMatriculaInput,
  type AprobarMatriculaInput,
  type RechazarMatriculaInput,
  type RetirarMatriculaInput,
  type ListarMatriculasAdminQuery,
  type MatriculaAdminResponsePayload,
  type PaginatedMatriculasAdminPayload,
} from '@intranet/shared'
import { apiRequest } from '../../../shared/api/client'

// Re-export types for consumers
export type { MatriculaAdminResponsePayload, PaginatedMatriculasAdminPayload }

/**
 * Solicita una matrícula para un alumno (RF-ADM-005).
 *
 * Requiere: alumnoId, seccionId, anioId y, opcionalmente, documentos.
 * El backend valida capacidad de la sección, apoderado principal y año activo.
 */
export async function solicitarMatricula(
  input: SolicitarMatriculaInput,
): Promise<MatriculaAdminResponsePayload> {
  return apiRequest('/administrative/matriculas', matriculaAdminResponseSchema, {
    method: 'POST',
    body: input,
  })
}

/**
 * Aprueba una matrícula en estado SOLICITADA (RF-ADM-006).
 *
 * Requiere el permiso `administrative.matriculas.gestionar`.
 */
export async function aprobarMatricula(
  id: string,
  input: AprobarMatriculaInput = {},
): Promise<MatriculaAdminResponsePayload> {
  return apiRequest(`/administrative/matriculas/${id}/aprobar`, matriculaAdminResponseSchema, {
    method: 'PATCH',
    body: input,
  })
}

/**
 * Rechaza una matrícula con un motivo obligatorio (RF-ADM-007).
 */
export async function rechazarMatricula(
  id: string,
  input: RechazarMatriculaInput,
): Promise<MatriculaAdminResponsePayload> {
  return apiRequest(`/administrative/matriculas/${id}/rechazar`, matriculaAdminResponseSchema, {
    method: 'PATCH',
    body: input,
  })
}

/**
 * Retira una matrícula aprobada y libera el cupo de la sección (RF-ADM-008).
 */
export async function retirarMatricula(
  id: string,
  input: RetirarMatriculaInput,
): Promise<MatriculaAdminResponsePayload> {
  return apiRequest(`/administrative/matriculas/${id}/retirar`, matriculaAdminResponseSchema, {
    method: 'PATCH',
    body: input,
  })
}

/**
 * Listado paginado de matrículas con filtros (RF-ADM-010).
 *
 * El backend segmenta el alcance según el rol:
 * - Director/SuperAdmin: todas las matrículas
 * - Apoderado: solo las de sus alumnos vinculados
 * - Alumno: solo la propia
 */
export async function listarMatriculas(
  query: Partial<ListarMatriculasAdminQuery> = {},
): Promise<PaginatedMatriculasAdminPayload> {
  const params = new URLSearchParams()
  if (query.page) params.set('page', String(query.page))
  if (query.pageSize) params.set('pageSize', String(query.pageSize))
  if (query.anioId) params.set('anioId', query.anioId)
  if (query.nivelId) params.set('nivelId', query.nivelId)
  if (query.gradoId) params.set('gradoId', query.gradoId)
  if (query.seccionId) params.set('seccionId', query.seccionId)
  if (query.estado) params.set('estado', query.estado)
  if (query.alumnoId) params.set('alumnoId', query.alumnoId)

  return apiRequest(`/administrative/matriculas?${params.toString()}`, paginatedMatriculasAdminSchema)
}
