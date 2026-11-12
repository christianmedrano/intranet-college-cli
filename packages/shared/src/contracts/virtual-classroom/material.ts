import type { AdjuntoVirtualResponse } from '../../schemas/virtual-classroom/adjunto.js'

/**
 * Material devuelto por la API (RF-VIR-001 a RF-VIR-005).
 *
 * `adjuntos` es un array vacío cuando no hay adjuntos.
 */
export interface MaterialResponse {
  id: string
  cursoId: string
  seccionId: string
  periodoId: string
  docenteId: string
  titulo: string
  descripcion: string | null
  archivoNombre: string
  archivoMime: string
  tamanoBytes: number
  createdAt: string
  updatedAt: string
  adjuntos: AdjuntoVirtualResponse[]
}

export interface PaginatedMaterialesResponse {
  data: MaterialResponse[]
  meta: {
    page: number
    pageSize: number
    total: number
  }
}