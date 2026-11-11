import type { AnuncioTipo, AnuncioEstado, AdjuntoAnuncioResponse } from '../../schemas/communication/anuncio.js'
import type { RoleCode } from '../../domain/permissions.js'

/** Anuncio devuelto por la API (RF-COM-001 a RF-COM-003). */
export interface AnuncioResponse {
  id: string
  institucionId: string
  autorId: string
  titulo: string
  cuerpo: string
  tipo: AnuncioTipo
  estado: AnuncioEstado
  audienciaNiveles: string[]
  audienciaGrados: string[]
  audienciaSecciones: string[]
  audienciaRoles: RoleCode[]
  publicadoEn: string | null
  expiraEn: string | null
  createdAt: string
  updatedAt: string
  adjuntos: AdjuntoAnuncioResponse[]
}

/** Listado paginado de anuncios. */
export interface PaginatedAnunciosResponse {
  data: AnuncioResponse[]
  meta: {
    page: number
    pageSize: number
    total: number
  }
}