// Contratos, tipos de dominio y schemas Zod compartidos entre web y api.
// Fuente de verdad: specs/core/001-spec-mvp/spec.md

// Base schemas
export * from './schemas/base.js'

// Auth schemas
export * from './schemas/auth.js'

// Institución schemas
export * from './schemas/institucion.js'
export * from './schemas/anio-academico.js'
export * from './schemas/periodo-academico.js'

// Academic schemas
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

// Academic module schemas
export * from './schemas/academic/base.js'
export * from './schemas/academic/calificacion.js'
export * from './schemas/academic/nota-final.js'
export * from './schemas/academic/asistencia.js'
export * from './schemas/academic/justificacion.js'
export * from './schemas/academic/umbral-asistencia.js'
export * from './schemas/academic/alerta-asistencia.js'
export * from './schemas/academic/horario.js'

// Communication schemas
export * from './schemas/communication/anuncio.js'
export * from './schemas/communication/mensaje.js'
export * from './schemas/communication/adjunto.js'

// Administrative schemas
export * from './schemas/administrative/pago.js'
export {
  tipoCertificadoSchema,
  estadoCertificadoSchema,
  type TipoCertificado,
  type EstadoCertificado,
  crearCertificadoSchema,
  solicitarCertificadoSchema,
  aprobarCertificadoSchema,
  rechazarCertificadoSchema,
  plantillaCertificadoSchema,
  actualizarPlantillaSchema,
  listarCertificadosQuerySchema,
  type CrearCertificadoInput,
  type SolicitarCertificadoInput,
  type AprobarCertificadoInput,
  type RechazarCertificadoInput,
  type PlantillaCertificadoInput,
  type ActualizarPlantillaInput,
  type ListarCertificadosQuery,
  certificadoResponseSchema,
  type CertificadoResponsePayload,
  paginatedCertificadosSchema,
  type PaginatedCertificadosPayload,
  plantillaCertificadoResponseSchema,
  type PlantillaCertificadoResponsePayload,
  paginatedPlantillasSchema,
  type PaginatedPlantillasPayload,
} from './schemas/administrative/certificado.js'
export {
  estadoMatriculaAdminSchema,
  solicitarMatriculaSchema,
  aprobarMatriculaSchema,
  rechazarMatriculaSchema,
  retirarMatriculaSchema,
  listarMatriculasAdminQuerySchema,
  type EstadoMatriculaAdmin,
  type SolicitarMatriculaInput,
  type AprobarMatriculaInput,
  type RechazarMatriculaInput,
  type RetirarMatriculaInput,
  type ListarMatriculasAdminQuery,
  matriculaAdminResponseSchema,
  type MatriculaAdminResponsePayload,
  paginatedMatriculasAdminSchema,
  type PaginatedMatriculasAdminPayload,
} from './schemas/administrative/matricula.js'

// Virtual-classroom schemas - from material.js (primary)
export {
  tipoMimeVirtualSchema,
  type TipoMimeVirtual,
  TAMANO_MAXIMO_BYTES_VIR,
  esTipoMimePermitidoVir,
  crearMaterialSchema,
  type CrearMaterialInput,
  actualizarMaterialSchema,
  type ActualizarMaterialInput,
  listarMaterialesQuerySchema,
  type ListarMaterialesQuery,
  adjuntoVirtualResponseSchema,
  type AdjuntoVirtualResponsePayload,
  materialResponseSchema,
  type MaterialResponsePayload,
  paginatedMaterialesSchema,
  type PaginatedMaterialesPayload,
  materialDescargaSchema,
  type MaterialDescargaPayload,
  adjuntoDescargaSchema,
  type AdjuntoDescargaPayload,
} from './schemas/virtual-classroom/material.js'

// Virtual-classroom adjunto.js - only export unique items
export {
  adjuntoVirtualMetadatosSchema,
  type AdjuntoVirtualMetadatosInput,
  type AdjuntoVirtualResponse,
} from './schemas/virtual-classroom/adjunto.js'

// Contracts
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

// Administrative contracts
export * from './contracts/administrative/pago.js'
export {
  type TipoCertificado as TipoCertificadoContract,
  type EstadoCertificado as EstadoCertificadoContract,
  type CertificadoResponse,
  type PaginatedCertificadosResponse,
  type PlantillaCertificadoResponse,
  type PaginatedPlantillasResponse,
} from './contracts/administrative/certificado.js'
export {
  type MatriculaAdminResponse,
  type PaginatedMatriculasAdminResponse,
  type SolicitarMatriculaInput as SolicitarMatriculaInputContract,
  type AprobarMatriculaInput as AprobarMatriculaInputContract,
  type RechazarMatriculaInput as RechazarMatriculaInputContract,
  type RetirarMatriculaInput as RetirarMatriculaInputContract,
  type AnularMatriculaInput,
  type ListarMatriculasAdminQuery as ListarMatriculasAdminQueryContract,
} from './contracts/administrative/matricula.js'

// Domain
export * from './domain/permissions.js'
export * from './domain/academic.js'