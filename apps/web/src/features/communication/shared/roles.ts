/**
 * Etiquetas en español de los códigos de rol (RF-COM-005).
 *
 * El backend devuelve el código (`DOCENTE`); la interfaz muestra el nombre
 * legible. Se usa un `Map` para no recurrir a aserciones de tipo.
 */
const ETIQUETAS_ROL = new Map<string, string>([
  ['SUPER_ADMIN', 'SuperAdmin'],
  ['DIRECTOR', 'Director'],
  ['DOCENTE', 'Docente'],
  ['APODERADO', 'Apoderado'],
  ['ALUMNO', 'Alumno'],
])

/** Devuelve la etiqueta legible del rol; si no se reconoce, el código original. */
export function etiquetaRol(codigo: string): string {
  return ETIQUETAS_ROL.get(codigo) ?? codigo
}
