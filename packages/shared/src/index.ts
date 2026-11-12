// Contratos, tipos de dominio y schemas Zod compartidos entre web y api.
// Fuente de verdad: specs/core/001-spec-mvp/spec.md

export * from './schemas/base.js'
export * from './schemas/auth.js'
export * from './schemas/institucion.js'
export * from './schemas/anio-academico.js'
export * from './schemas/periodo-academico.js'
export * from './schemas/nivel.js'
export * from './schemas/grado.js'
export * from './schemas/seccion.js'
export * from './schemas/curso.js'
export * from './schemas/persona.js'
export * from './schemas/alumno.js'
export * from './schemas/docente.js'
export * from './schemas/apoderado.js'
export * from './schemas/usuario.js'
export * from './schemas/matricula.js'
export * from './schemas/asignacion-docente.js'
export * from './schemas/auditoria.js'
export * from './schemas/academic/base.js'
export * from './schemas/academic/calificacion.js'
export * from './schemas/academic/nota-final.js'
export * from './schemas/academic/asistencia.js'
export * from './schemas/academic/justificacion.js'
export * from './schemas/academic/umbral-asistencia.js'
export * from './schemas/academic/alerta-asistencia.js'
export * from './schemas/academic/horario.js'
export * from './schemas/communication/anuncio.js'
export * from './schemas/communication/mensaje.js'
export * from './schemas/communication/adjunto.js'
export {
  crearMaterialSchema,
  actualizarMaterialSchema,
  listarMaterialesQuerySchema,
  materialResponseSchema,
  paginatedMaterialesSchema,
  materialDescargaSchema,
  adjuntoDescargaSchema,
  tipoMimeVirtualSchema,
  TAMANO_MAXIMO_BYTES_VIR,
  esTipoMimePermitidoVir,
  type CrearMaterialInput,
  type ActualizarMaterialInput,
  type ListarMaterialesQuery,
  type MaterialResponsePayload,
  type PaginatedMaterialesPayload,
  type MaterialDescargaPayload,
  type AdjuntoDescargaPayload,
} from './schemas/virtual-classroom/material.js'
export {
  adjuntoVirtualMetadatosSchema,
  adjuntoVirtualResponseSchema,
  type AdjuntoVirtualResponse,
  type AdjuntoVirtualMetadatosInput,
  type AdjuntoVirtualResponsePayload,
} from './schemas/virtual-classroom/adjunto.js'
export * from './contracts/base.js'
export * from './contracts/auth.js'
export * from './contracts/institucion.js'
export * from './contracts/anio-academico.js'
export * from './contracts/periodo-academico.js'
export * from './contracts/nivel.js'
export * from './contracts/grado.js'
export * from './contracts/seccion.js'
export * from './contracts/curso.js'
export * from './contracts/persona.js'
export * from './contracts/alumno.js'
export * from './contracts/docente.js'
export * from './contracts/apoderado.js'
export * from './contracts/usuario.js'
export * from './contracts/matricula.js'
export * from './contracts/asignacion-docente.js'
export * from './contracts/auditoria.js'
export * from './contracts/academic/calificacion.js'
export * from './contracts/academic/asistencia.js'
export * from './contracts/academic/justificacion.js'
export * from './contracts/academic/umbral-asistencia.js'
export * from './contracts/academic/alerta-asistencia.js'
export * from './contracts/academic/horario.js'
export * from './contracts/communication/anuncio.js'
export * from './contracts/communication/mensaje.js'
export * from './contracts/communication/adjunto.js'
export * from './contracts/virtual-classroom/material.js'
export * from './contracts/virtual-classroom/adjunto.js'
export * from './domain/permissions.js'
export * from './domain/academic.js'
