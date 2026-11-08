/**
 * Valor JSON genérico almacenado en `Auditoria.datos`.
 *
 * Se modela sin `any` para que el contrato sea seguro tanto en la API como en
 * el cliente. La API ya garantiza que las claves sensibles llegan redactadas.
 */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [clave: string]: JsonValue | undefined }

/**
 * Registro de auditoría expuesto por `GET /auditoria` (RF-CORE-016).
 *
 * Es de solo lectura: no existe contrato de creación, edición ni borrado.
 */
export interface AuditoriaResponse {
  id: string
  usuarioId: string | null
  accion: string
  entidad: string
  entidadId: string | null
  datos: JsonValue | null
  ip: string | null
  userAgent: string | null
  createdAt: string
}
