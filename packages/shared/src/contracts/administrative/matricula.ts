/** Estados de una matrícula administrativa. */
export type EstadoMatriculaAdmin = 'SOLICITADA' | 'APROBADA' | 'RECHAZADA' | 'RETIRADA' | 'ANULADA'

/**
 * Solicitud de matrícula por apoderado (RF-ADM-005).
 */
export interface SolicitarMatriculaInput {
  alumnoId: string
  seccionId: string
  anioId: string
  documentos?: Array<{
    tipo: string
    archivoNombre: string
    archivoRuta: string
  }>
}

/**
 * Aprobación de matrícula por director/administrador (RF-ADM-006).
 */
export interface AprobarMatriculaInput {
  observaciones?: string
}

/**
 * Rechazo de matrícula por director/administrador (RF-ADM-007).
 */
export interface RechazarMatriculaInput {
  motivo: string
}

/**
 * Retiro de matrícula aprobada (RF-ADM-008).
 */
export interface RetirarMatriculaInput {
  motivo: string
}

/**
 * Anulación de matrícula (RF-ADM-009).
 */
export interface AnularMatriculaInput {
  motivo: string
}

/**
 * Filtros para listado de matrículas (RF-ADM-010).
 */
export interface ListarMatriculasAdminQuery {
  anioId?: string
  nivelId?: string
  gradoId?: string
  seccionId?: string
  estado?: 'SOLICITADA' | 'APROBADA' | 'RECHAZADA' | 'RETIRADA' | 'ANULADA'
  alumnoId?: string
  page?: number
  pageSize?: number
}

/**
 * Contrato de respuesta para matrícula administrativa (RF-ADM-005 a RF-ADM-010).
 */
export interface MatriculaAdminResponse {
  id: string
  alumnoId: string
  seccionId: string
  anioId: string
  estado: 'SOLICITADA' | 'APROBADA' | 'RECHAZADA' | 'RETIRADA' | 'ANULADA'
  fechaSolicitud: string
  fechaAprobacion: string | null
  fechaRetiro: string | null
  motivoRetiro: string | null
  observaciones: string | null
  createdAt: string
  updatedAt: string
}

/**
 * Listado paginado de matrículas.
 */
export interface PaginatedMatriculasAdminResponse {
  data: MatriculaAdminResponse[]
  meta: {
    page: number
    pageSize: number
    total: number
  }
}