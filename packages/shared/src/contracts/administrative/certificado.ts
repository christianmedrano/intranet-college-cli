/** Tipos de certificado. */
export type TipoCertificado = 'ESTUDIOS' | 'MATRICULA' | 'NO_ADEUDO' | 'CONDUCTA' | 'OTRO'

/** Estados de un certificado. */
export type EstadoCertificado = 'BORRADOR' | 'SOLICITADO' | 'APROBADO' | 'RECHAZADO' | 'EMITIDO' | 'ANULADO'

/**
 * Contrato de respuesta para certificado (RF-ADM-011 a RF-ADM-013).
 */
export interface CertificadoResponse {
  id: string
  tipo: 'ESTUDIOS' | 'MATRICULA' | 'NO_ADEUDO' | 'CONDUCTA' | 'OTRO'
  numero: string
  alumnoId: string
  anioId: string
  plantillaId: string | null
  variables: Record<string, string> | null
  estado: 'BORRADOR' | 'SOLICITADO' | 'APROBADO' | 'RECHAZADO' | 'EMITIDO' | 'ANULADO'
  solicitadoPorId: string | null
  solicitadoAt: string | null
  aprobadoPorId: string | null
  aprobadoAt: string | null
  rechazadoMotivo: string | null
  pdfRuta: string | null
  createdAt: string
  updatedAt: string
}

/**
 * Listado paginado de certificados.
 */
export interface PaginatedCertificadosResponse {
  data: Array<{
    id: string
    tipo: string
    numero: string
    alumnoId: string
    anioId: string
    plantillaId: string | null
    variables: Record<string, string> | null
    estado: string
    solicitadoPorId: string | null
    solicitadoAt: string | null
    aprobadoPorId: string | null
    aprobadoAt: string | null
    rechazadoMotivo: string | null
    pdfRuta: string | null
    createdAt: string
    updatedAt: string
  }>
  meta: {
    page: number
    pageSize: number
    total: number
  }
}

/**
 * Plantilla de certificado (RF-ADM-014).
 */
export interface PlantillaCertificadoResponse {
  id: string
  tipo: 'ESTUDIOS' | 'MATRICULA' | 'NO_ADEUDO' | 'CONDUCTA' | 'OTRO'
  nombre: string
  contenido: string
  activa: boolean
  version: number
  createdAt: string
  updatedAt: string
}

/**
 * Listado paginado de plantillas.
 */
export interface PaginatedPlantillasResponse {
  data: Array<{
    id: string
    tipo: string
    nombre: string
    contenido: string
    activa: boolean
    version: number
    createdAt: string
    updatedAt: string
  }>
  meta: {
    page: number
    pageSize: number
    total: number
  }
}