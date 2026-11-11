import type { AdjuntoMensajeResponse } from '../../schemas/communication/mensaje.js'

/** Mensaje devuelto por la API (RF-COM-004, RF-COM-005). */
export interface MensajeResponse {
  id: string
  hiloId: string
  autorId: string
  autorNombre: string
  autorRol: string
  cuerpo: string
  createdAt: string
  updatedAt: string
  adjuntos: AdjuntoMensajeResponse[]
}

/** Listado paginado de mensajes. */
export interface PaginatedMensajesResponse {
  data: MensajeResponse[]
  meta: {
    page: number
    pageSize: number
    total: number
  }
}