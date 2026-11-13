import { z } from 'zod'
import { paginationSchema, uuidSchema } from '../base.js'

/** Estados de una matrícula administrativa (RF-ADM-005 a RF-ADM-010). */
export const estadoMatriculaAdminSchema = z.enum([
  'SOLICITADA',
  'APROBADA',
  'RECHAZADA',
  'RETIRADA',
  'ANULADA',
])

export type EstadoMatriculaAdmin = z.infer<typeof estadoMatriculaAdminSchema>

/**
 * Solicitud de matrícula por apoderado (RF-ADM-005).
 *
 * El apoderado principal solicita matrícula para su alumno en una sección
 * de un año académico activo.
 */
export const solicitarMatriculaSchema = z.object({
  alumnoId: uuidSchema,
  seccionId: uuidSchema,
  anioId: uuidSchema,
  documentos: z.array(z.object({
    tipo: z.string().min(1),
    archivoNombre: z.string().min(1),
    archivoRuta: z.string().min(1),
  })).optional(),
})

export type SolicitarMatriculaInput = z.infer<typeof solicitarMatriculaSchema>

/**
 * Aprobación de matrícula por director/administrador (RF-ADM-006).
 *
 * Valida: capacidad de sección, apoderado principal, año activo.
 */
export const aprobarMatriculaSchema = z.object({
  observaciones: z.string().max(500).optional(),
})

export type AprobarMatriculaInput = z.infer<typeof aprobarMatriculaSchema>

/**
 * Rechazo de matrícula por director/administrador (RF-ADM-007).
 */
export const rechazarMatriculaSchema = z.object({
  motivo: z.string().min(1, 'El motivo es obligatorio').max(500, 'El motivo es demasiado largo'),
})

export type RechazarMatriculaInput = z.infer<typeof rechazarMatriculaSchema>

/**
 * Retiro de matrícula aprobada (RF-ADM-008, RN-ADM-009).
 *
 * Libera cupo en la sección. Requiere motivo.
 */
export const retirarMatriculaSchema = z.object({
  motivo: z.string().min(1, 'El motivo es obligatorio').max(500, 'El motivo es demasiado largo'),
})

export type RetirarMatriculaInput = z.infer<typeof retirarMatriculaSchema>

/**
 * Filtros para listado de matrículas (RF-ADM-010).
 */
export const listarMatriculasAdminQuerySchema = paginationSchema.extend({
  anioId: uuidSchema.optional(),
  nivelId: uuidSchema.optional(),
  gradoId: uuidSchema.optional(),
  seccionId: uuidSchema.optional(),
  estado: estadoMatriculaAdminSchema.optional(),
  alumnoId: uuidSchema.optional(),
})

export type ListarMatriculasAdminQuery = z.infer<typeof listarMatriculasAdminQuerySchema>

/**
 * Respuesta de una matrícula (RF-ADM-005 a RF-ADM-010).
 */
export const matriculaAdminResponseSchema = z.object({
  id: uuidSchema,
  alumnoId: uuidSchema,
  seccionId: uuidSchema,
  anioId: uuidSchema,
  estado: estadoMatriculaAdminSchema,
  fechaSolicitud: z.string(),
  fechaAprobacion: z.string().nullable(),
  fechaRetiro: z.string().nullable(),
  motivoRetiro: z.string().nullable(),
  observaciones: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type MatriculaAdminResponsePayload = z.infer<typeof matriculaAdminResponseSchema>

/**
 * Listado paginado de matrículas.
 */
export const paginatedMatriculasAdminSchema = z.object({
  data: z.array(matriculaAdminResponseSchema),
  meta: paginationSchema.extend({ total: z.number().int().min(0) }).omit({ pageSize: true, page: true }).extend({
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1),
    total: z.number().int().min(0),
  }),
})

export type PaginatedMatriculasAdminPayload = z.infer<typeof paginatedMatriculasAdminSchema>