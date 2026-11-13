import fs from 'fs';

const content = `import { z } from 'zod'
import { paginationSchema, uuidSchema } from '../base.js'

/** Valores válidos para tipo de certificado (para validación en runtime). */
const TIPO_CERTIFICADO_VALUES_LIST = ['ESTUDIOS', 'MATRICULA', 'NO_ADEUDO', 'CONDUCTA', 'OTRO'] as const

/** Schema para tipo de certificado (validación en runtime). */
const tipoCertificadoSchema = z.string().refine(
  (val) => ['ESTUDIOS', 'MATRICULA', 'NO_ADEUDO', 'CONDUCTA', 'OTRO'].includes(val),
  { message: 'Tipo de certificado inválido' }
)

/** Tipos de certificado (literal union para TypeScript). */
export type TipoCertificado = 'ESTUDIOS' | 'MATRICULA' | 'NO_ADEUDO' | 'CONDUCTA' | 'OTRO'

/** Estados de un certificado (RF-ADM-011 a RF-ADM-013). */
const ESTADO_CERTIFICADO_VALUES_LIST = ['BORRADOR', 'SOLICITADO', 'APROBADO', 'RECHAZADO', 'EMITIDO', 'ANULADO'] as const

/** Schema para estado de certificado (validación en runtime). */
const estadoCertificadoSchema = z.string().refine(
  (val) => ['BORRADOR', 'SOLICITADO', 'APROBADO', 'RECHAZADO', 'EMITIDO', 'ANULADO'].includes(val),
  { message: 'Estado de certificado inválido' }
)

/** Estados de un certificado (literal union para TypeScript). */
export type EstadoCertificado = 'BORRADOR' | 'SOLICITADO' | 'APROBADO' | 'RECHAZADO' | 'EMITIDO' | 'ANULADO'

/** Tipos de certificado (literal union para TypeScript). */
export type TipoCertificado = 'ESTUDIOS' | 'MATRICULA' | 'NO_ADEUDO' | 'CONDUCTA' | 'OTRO'

/** Schema para tipo de certificado (validación en runtime). */
const tipoCertificadoSchema = z.string().refine(
  (val) => ['ESTUDIOS', 'MATRICULA', 'NO_ADEUDO', 'CONDUCTA', 'OTRO'].includes(val),
  { message: 'Tipo de certificado inválido' }
)

/** Schema para estado de certificado (validación en runtime). */
const estadoCertificadoSchema = z.string().refine(
  (val) => ['BORRADOR', 'SOLICITADO', 'APROBADO', 'RECHAZADO', 'EMITIDO', 'ANULADO'].includes(val),
  { message: 'Estado de certificado inválido' }
)

/** Tipos de certificado (literal union para TypeScript). */
export type TipoCertificado = 'ESTUDIOS' | 'MATRICULA' | 'NO_ADEUDO' | 'CONDUCTA' | 'OTRO'

/** Estados de un certificado (literal union para TypeScript). */
export type EstadoCertificado = 'BORRADOR' | 'SOLICITADO' | 'APROBADO' | 'RECHAZADO' | 'EMITIDO' | 'ANULADO'

/**
 * Emisión de certificado por director/administrador (RF-ADM-011, RN-ADM-011 a RN-ADM-014).
 *
 * Requiere alumno, año, tipo. Plantilla opcional (usa la base si no se envía).
 * Variables opcionales para la plantilla.
 */
export const crearCertificadoSchema = z.object({
  tipo: z.string().refine(
    (val) => ['ESTUDIOS', 'MATRICULA', 'NO_ADEUDO', 'CONDUCTA', 'OTRO'].includes(val),
    { message: 'Tipo de certificado inválido' }
  ),
  alumnoId: uuidSchema,
  anioId: uuidSchema,
  plantillaId: uuidSchema.optional(),
  variables: z.record(z.string()).optional(),
})

export type CrearCertificadoInput = z.infer<typeof crearCertificadoSchema>

/**
 * Solicitud de certificado por apoderado/alumno (RF-ADM-012).
 */
export const solicitarCertificadoSchema = z.object({
  tipo: z.string().refine(
    (val) => ['ESTUDIOS', 'MATRICULA', 'NO_ADEUDO', 'CONDUCTA', 'OTRO'].includes(val),
    { message: 'Tipo de certificado inválido' }
  ),
  alumnoId: uuidSchema,
  anioId: uuidSchema,
  plantillaId: uuidSchema.optional(),
})

export type SolicitarCertificadoInput = z.infer<typeof solicitarCertificadoSchema>

/**
 * Aprobación de certificado por director (RF-ADM-013).
 *
 * Genera PDF, asigna número correlativo y pasa a EMITIDO.
 */
export const aprobarCertificadoSchema = z.object({
  plantillaId: uuidSchema.optional(),
  variables: z.record(z.string()).optional(),
})

export type AprobarCertificadoInput = z.infer<typeof aprobarCertificadoSchema>

/**
 * Rechazo de solicitud de certificado (RF-ADM-013).
 */
export const rechazarCertificadoSchema = z.object({
  motivo: z.string().min(1, 'El motivo es obligatorio').max(500, 'El motivo es demasiado largo'),
})

export type RechazarCertificadoInput = z.infer<typeof rechazarCertificadoSchema>

/**
 * Plantilla de certificado (RF-ADM-014, RN-ADM-012, RN-ADM-014).
 *
 * Contenido HTML con variables {{variable}}.
 * Versionado por tipo + version.
 */
export const plantillaCertificadoSchema = z.object({
  tipo: z.string().refine(
    (val) => ['ESTUDIOS', 'MATRICULA', 'NO_ADEUDO', 'CONDUCTA', 'OTRO'].includes(val),
    { message: 'Tipo de certificado inválido' }
  ),
  nombre: z.string().min(1, 'El nombre es obligatorio').max(100, 'El nombre es demasiado largo'),
  contenido: z.string().min(1, 'El contenido es obligatorio'),
  activa: z.boolean().default(true),
})

export type PlantillaCertificadoInput = z.infer<typeof plantillaCertificadoSchema>

/**
 * Actualización parcial de plantilla.
 */
export const actualizarPlantillaSchema = z.object({
  nombre: z.string().min(1).max(100).optional(),
  contenido: z.string().min(1).optional(),
  activa: z.boolean().optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'Debe enviar al menos un campo para actualizar',
})

export type ActualizarPlantillaInput = z.infer<typeof actualizarPlantillaSchema>

/**
 * Filtros para listado de certificados.
 */
export const listarCertificadosQuerySchema = z.object({
  tipo: z.string().refine(
    (val) => ['ESTUDIOS', 'MATRICULA', 'NO_ADEUDO', 'CONDUCTA', 'OTRO'].includes(val),
    { message: 'Tipo de certificado inválido' }
  ).optional(),
  alumnoId: uuidSchema.optional(),
  anioId: uuidSchema.optional(),
  estado: z.string().refine(
    (val) => ['BORRADOR', 'SOLICITADO', 'APROBADO', 'RECHAZADO', 'EMITIDO', 'ANULADO'].includes(val),
    { message: 'Estado de certificado inválido' }
  ).optional(),
  alumnoId: uuidSchema.optional(),
  anioId: uuidSchema.optional(),
})

export type ListarCertificadosQuery = z.infer<typeof listarCertificadosQuerySchema>

/**
 * Respuesta de un certificado (RF-ADM-011 a RF-ADM-013).
 */
export const certificadoResponseSchema = z.object({
  id: uuidSchema,
  tipo: z.string().refine(
    (val) => ['ESTUDIOS', 'MATRICULA', 'NO_ADEUDO', 'CONDUCTA', 'OTRO'].includes(val),
    { message: 'Tipo de certificado inválido' }
  ),
  numero: z.string(),
  alumnoId: uuidSchema,
  anioId: uuidSchema,
  plantillaId: uuidSchema.nullable(),
  variables: z.record(z.string()).nullable(),
  estado: z.string().refine(
    (val) => ['BORRADOR', 'SOLICITADO', 'APROBADO', 'RECHAZADO', 'EMITIDO', 'ANULADO'].includes(val),
    { message: 'Estado de certificado inválido' }
  ),
  solicitadoPorId: uuidSchema.nullable(),
  solicitadoAt: z.string().nullable(),
  aprobadoPorId: uuidSchema.nullable(),
  aprobadoAt: z.string().nullable(),
  rechazadoMotivo: z.string().nullable(),
  pdfRuta: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type CertificadoResponsePayload = z.infer<typeof certificadoResponseSchema>

/** Esquema interno para un certificado en lista paginada. */
const certificadoEnListaSchema = z.object({
  id: uuidSchema,
  tipo: z.string(),
  numero: z.string(),
  alumnoId: uuidSchema,
  anioId: uuidSchema,
  plantillaId: uuidSchema.nullable(),
  variables: z.record(z.string()).nullable(),
  estado: z.string(),
  solicitadoPorId: uuidSchema.nullable(),
  solicitadoAt: z.string().nullable(),
  aprobadoPorId: uuidSchema.nullable(),
  aprobadoAt: z.string().nullable(),
  rechazadoMotivo: z.string().nullable(),
  pdfRuta: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

/**
 * Listado paginado de certificados.
 */
export const paginatedCertificadosSchema = z.object({
  data: z.array(certificadoEnListaSchema),
  meta: z.object({
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1),
    total: z.number().int().min(0),
  }),
})

export type PaginatedCertificadosPayload = z.infer<typeof paginatedCertificadosSchema>

/**
 * Plantilla de certificado (RF-ADM-014, RN-ADM-012, RN-ADM-014).
 *
 * Contenido HTML con variables {{variable}}.
 * Versionado por tipo + version.
 */
export const plantillaCertificadoResponseSchema = z.object({
  id: uuidSchema,
  tipo: z.string().refine(
    (val) => ['ESTUDIOS', 'MATRICULA', 'NO_ADEUDO', 'CONDUCTA', 'OTRO'].includes(val),
    { message: 'Tipo de certificado inválido' }
  ),
  nombre: z.string(),
  contenido: z.string(),
  activa: z.boolean(),
  version: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type PlantillaCertificadoResponsePayload = z.infer<typeof plantillaCertificadoResponseSchema>

/**
 * Listado paginado de plantillas.
 */
export const paginatedPlantillasSchema = z.object({
  data: z.array(z.object({
    id: uuidSchema,
    tipo: z.string(),
    nombre: z.string(),
    contenido: z.string(),
    activa: z.boolean(),
    version: z.number().int(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })),
  meta: z.object({
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1),
    total: z.number().int().min(0),
  }),
})

export type PaginatedPlantillasPayload = z.infer<typeof paginatedPlantillasSchema>
`;

fs.writeFileSync('packages/shared/src/schemas/administrative/certificado.ts', content, 'utf8');
console.log('File written successfully');