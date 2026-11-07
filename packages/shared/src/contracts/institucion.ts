/**
 * Datos públicos de la institución (RF-CORE-001).
 *
 * Se omiten las marcas de auditoría y el borrado lógico: el cliente solo
 * necesita los datos editables de la única institución del despliegue.
 */
export interface InstitucionResponse {
  id: string
  nombre: string
  direccion: string | null
  telefono: string | null
  email: string | null
  logoUrl: string | null
}
