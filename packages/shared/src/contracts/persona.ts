/**
 * Datos personales comunes a alumnos, docentes y apoderados (spec core §6).
 *
 * La fecha de nacimiento viaja como `YYYY-MM-DD`, sin hora, porque en el
 * modelo es `DATE`. Se omiten las marcas de auditoría y el borrado lógico.
 */
export interface PersonaResponse {
  id: string
  nombres: string
  apellidos: string
  tipoDocumento: string
  numeroDocumento: string
  fechaNacimiento: string | null
  telefono: string | null
  emailContacto: string | null
  direccion: string | null
}
