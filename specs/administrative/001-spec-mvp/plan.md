# Plan MVP — Módulo Administrativo

**Versión:** 1.0.0
**Fecha:** 2026-11-13
**Spec:** `specs/administrative/001-spec-mvp/spec.md`
**Estado:** Aprobado

---

## 1. Arquitectura

### 1.1 Estructura de código (monorepo)

```
apps/
├─ api/
│  └─ src/
│     └─ modules/
│        └─ administrative/
│           ├─ pagos/
│           │  ├─ pago.controller.ts
│           │  ├─ pago.repository.ts
│           │  ├─ pago.routes.ts
│           │  ├─ pago.service.ts
│           │  └─ pago.scope.ts
│           ├─ matriculas/
│           │  ├─ matricula.controller.ts
│           │  ├─ matricula.repository.ts
│           │  ├─ matricula.routes.ts
│           │  ├─ matricula.service.ts
│           │  └─ matricula.scope.ts
│           └─ certificados/
│              ├─ certificado.controller.ts
│              ├─ certificado.repository.ts
│              ├─ certificado.routes.ts
│              ├─ certificado.service.ts
│              └─ certificado.scope.ts
└─ web/
   └─ src/
      └─ features/
         └─ administrative/
            ├─ pagos/
            │  ├─ PagosPage.tsx
            │  ├─ PagoForm.tsx
            │  ├─ EstadoCuentaPage.tsx
            │  └─ api.ts
            ├─ matriculas/
            │  ├─ MatriculasPage.tsx
            │  ├─ MatriculaForm.tsx
            │  └─ api.ts
            ├─ certificados/
            │  ├─ CertificadosPage.tsx
            │  ├─ CertificadoForm.tsx
            │  ├─ PlantillasPage.tsx
            │  ├─ PlantillaForm.tsx
            │  └─ api.ts
            └─ shared/
               ├─ formato.ts
               └─ PlantillaEditor.tsx
```

### 1.2 Flujo de datos

```
Web (React) → HTTP /api/v1 → Fastify (API) → Prisma → MySQL
                    ↑
              packages/shared (Zod schemas, DTOs, permissions)
```

- `apps/web` consume `packages/shared` para tipos y validación cliente
- `apps/api` usa `packages/shared` para validación servidor (Zod) y contratos
- Comunicación solo por HTTP `/api/v1`

---

## 2. Contratos de API (Zod schemas en `packages/shared`)

### 2.1 Pagos (`packages/shared/src/schemas/administrative/pago.ts`)

```typescript
// Tipos de concepto
const conceptoPagoSchema = z.enum([
  'CUOTA_MENSUAL', 'MATRICULA', 'CERTIFICADO', 'OTRO'
])

// Métodos de pago
const metodoPagoSchema = z.enum([
  'EFECTIVO', 'TRANSFERENCIA', 'DEPOSITO', 'OTRO'
])

// Estados
const estadoPagoSchema = z.enum(['REGISTRADO', 'ANULADO'])

// Input creación
export const crearPagoSchema = z.object({
  alumnoId: uuidSchema,
  concepto: conceptoPagoSchema,
  monto: z.number().positive().max(999999.99),
  moneda: z.literal('PEN'),
  fechaPago: z.iso.datetime(),
  metodo: metodoPagoSchema,
  comprobante: z.string().max(100).optional(),
  observaciones: z.string().max(500).optional(),
})

// Input anulación
export const anularPagoSchema = z.object({
  motivo: z.string().min(1).max(500),
})

// Filtros listado
export const listarPagosQuerySchema = paginationSchema.extend({
  alumnoId: uuidSchema.optional(),
  concepto: conceptoPagoSchema.optional(),
  fechaDesde: z.iso.date().optional(),
  fechaHasta: z.iso.date().optional(),
  estado: estadoPagoSchema.optional(),
  metodo: metodoPagoSchema.optional(),
})

// Response DTOs
export const pagoResponseSchema = z.object({
  id: uuidSchema,
  alumnoId: uuidSchema,
  concepto: conceptoPagoSchema,
  monto: z.number(),
  moneda: z.string(),
  fechaPago: z.string(),
  metodo: metodoPagoSchema,
  comprobante: z.string().nullable(),
  observaciones: z.string().nullable(),
  estado: estadoPagoSchema,
  anuladoMotivo: z.string().nullable(),
  anuladoPorId: uuidSchema.nullable(),
  anuladoAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const estadoCuentaResponseSchema = z.object({
  alumnoId: uuidSchema,
  totalesPorConcepto: z.array(z.object({
    concepto: conceptoPagoSchema,
    totalPagado: z.number(),
    totalPendiente: z.number(),
    cantidad: z.number().int(),
  })),
  totalGeneralPagado: z.number(),
  totalGeneralPendiente: z.number(),
})
```

### 2.2 Matrículas (`packages/shared/src/schemas/administrative/matricula.ts`)

```typescript
const estadoMatriculaSchema = z.enum([
  'SOLICITADA', 'APROBADA', 'RECHAZADA', 'RETIRADA', 'ANULADA'
])

export const solicitarMatriculaSchema = z.object({
  alumnoId: uuidSchema,
  seccionId: uuidSchema,
  anioId: uuidSchema,
  documentos: z.array(z.object({
    tipo: z.string(),
    archivoNombre: z.string(),
    archivoRuta: z.string(),
  })).optional(),
})

export const aprobarMatriculaSchema = z.object({
  observaciones: z.string().max(500).optional(),
})

export const rechazarMatriculaSchema = z.object({
  motivo: z.string().min(1).max(500),
})

export const retirarMatriculaSchema = z.object({
  motivo: z.string().min(1).max(500),
})

export const listarMatriculasQuerySchema = paginationSchema.extend({
  anioId: uuidSchema.optional(),
  nivelId: uuidSchema.optional(),
  gradoId: uuidSchema.optional(),
  seccionId: uuidSchema.optional(),
  estado: z.enum(['SOLICITADA', 'APROBADA', 'RECHAZADA', 'RETIRADA', 'ANULADA']).optional(),
  alumnoId: uuidSchema.optional(),
})

export const matriculaResponseSchema = z.object({
  id: uuidSchema,
  alumnoId: uuidSchema,
  seccionId: uuidSchema,
  anioId: uuidSchema,
  estado: estadoMatriculaSchema,
  fechaSolicitud: z.string(),
  fechaAprobacion: z.string().nullable(),
  fechaRetiro: z.string().nullable(),
  motivoRetiro: z.string().nullable(),
  observaciones: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})
```

### 2.3 Certificados (`packages/shared/src/schemas/administrative/certificado.ts`)

```typescript
const tipoCertificadoSchema = z.enum([
  'ESTUDIOS', 'MATRICULA', 'NO_ADEUDO', 'CONDUCTA', 'OTRO'
])

const estadoCertificadoSchema = z.enum([
  'BORRADOR', 'SOLICITADO', 'APROBADO', 'RECHAZADO', 'EMITIDO', 'ANULADO'
])

export const crearCertificadoSchema = z.object({
  tipo: tipoCertificadoSchema,
  alumnoId: uuidSchema,
  anioId: uuidSchema,
  plantillaId: uuidSchema.optional(),
  variables: z.record(z.string()).optional(),
})

export const solicitarCertificadoSchema = z.object({
  tipo: tipoCertificadoSchema,
  alumnoId: uuidSchema,
  anioId: uuidSchema,
  plantillaId: uuidSchema.optional(),
})

export const aprobarCertificadoSchema = z.object({
  plantillaId: uuidSchema.optional(),
  variables: z.record(z.string()).optional(),
})

export const rechazarCertificadoSchema = z.object({
  motivo: z.string().min(1).max(500),
})

export const plantillaCertificadoSchema = z.object({
  tipo: tipoCertificadoSchema,
  nombre: z.string().min(1).max(100),
  contenido: z.string().min(1), // HTML con variables {{variable}}
})

export const certificadoResponseSchema = z.object({
  id: uuidSchema,
  tipo: tipoCertificadoSchema,
  numero: z.string(),
  alumnoId: uuidSchema,
  anioId: uuidSchema,
  plantillaId: uuidSchema.nullable(),
  variables: z.record(z.string()).nullable(),
  estado: estadoCertificadoSchema,
  solicitadoPorId: uuidSchema.nullable(),
  solicitadoAt: z.string().nullable(),
  aprobadoPorId: uuidSchema.nullable(),
  aprobadoAt: z.string().nullable(),
  rechazadoMotivo: z.string().nullable(),
  pdfRuta: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const plantillaCertificadoResponseSchema = z.object({
  id: uuidSchema,
  tipo: z.string(),
  nombre: z.string(),
  contenido: z.string(),
  activa: z.boolean(),
  version: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
})
```

---

## 3. Base de Datos (Prisma Migration)

### 3.1 Migración `administrative_init`

```prisma
// Nuevos modelos
model Pago { ... }           // Ver spec.md sección 5
model Certificado { ... }
model PlantillaCertificado { ... }

// Extensiones a Matricula (ya existe en core)
model Matricula {
  // Campos nuevos añadidos a la existente
  estado         String   @default("SOLICITADA") @db.VarChar(20)
  fechaSolicitud DateTime @default(now()) @map("fecha_solicitud") @db.DateTime(3)
  fechaAprobacion DateTime? @map("fecha_aprobacion") @db.DateTime(3)
  fechaRetiro    DateTime? @map("fecha_retiro") @db.DateTime(3)
  motivoRetiro   String?  @map("motivo_retiro") @db.Text
  // ... campos existentes
}

// Índices nuevos
@@index([alumnoId, fechaPago])  // Pago
@@index([concepto])              // Pago
@@index([estado])                // Pago
@@unique([tipo, version])        // PlantillaCertificado
@@index([alumnoId, anioId])      // Certificado
@@index([tipo, anioId])          // Certificado
@@index([estado])                // Certificado
```

### 3.2 Seed de plantillas base

```typescript
// Plantillas por defecto (seed idempotente)
const plantillasBase = [
  { tipo: 'ESTUDIOS', nombre: 'Certificado de Estudios', version: 1, ... },
  { tipo: 'MATRICULA', nombre: 'Constancia de Matrícula', version: 1, ... },
  { tipo: 'NO_ADEUDO', nombre: 'Constancia de No Adeudo', version: 1, ... },
  { tipo: 'CONDUCTA', nombre: 'Certificado de Conducta', version: 1, ... },
]
```

---

## 4. Reglas de Negocio (Servicios)

### 4.1 PagoService

| Método | Validaciones | Auditoría |
|---|---|---|
| `crearPago` | Alumno existe, concepto válido, monto > 0, fecha ≤ hoy | CREAR |
| `anularPago` | Pago existe, estado REGISTRADO, motivo obligatorio | ANULAR (anterior/nuevo) |
| `listarPagos` | Filtros validados, paginación | ACCEDER |
| `estadoCuenta` | Alumno existe, vinculado (si PA/AL) | ACCEDER |

### 4.2 MatriculaService

| Método | Validaciones | Auditoría |
|---|---|---|
| `solicitarMatricula` | Alumno existe, sección con capacidad, año ACTIVO/PLANIFICADO, apoderado principal | CREAR |
| `aprobarMatricula` | Estado SOLICITADA, capacidad, apoderado principal | ACTUALIZAR |
| `rechazarMatricula` | Estado SOLICITADA, motivo obligatorio | ACTUALIZAR |
| `retirarMatricula` | Estado APROBADA, motivo obligatorio, libera cupo | ACTUALIZAR |
| `listarMatriculas` | Filtros + paginación | ACCEDER |

### 4.3 CertificadoService

| Método | Validaciones | Auditoría |
|---|---|---|
| `crearCertificado` | DI/SA, alumno existe, plantilla válida, variables resueltas | CREAR |
| `solicitarCertificado` | PA/AL vinculado, alumno existe | SOLICITAR |
| `aprobarCertificado` | DI/SA, estado SOLICITADO, genera PDF, numeración | APROBAR / EMITIR |
| `rechazarCertificado` | DI/SA, estado SOLICITADO, motivo | RECHAZAR |
| `descargarCertificado` | Permiso + vínculo, genera PDF si no existe | ACCEDER |
| `plantillasCRUD` | DI/SA | CREAR/ACTUALIZAR/ELIMINAR |

---

## 5. Scope / Autorización (por módulo)

### 5.1 PagoScope
- SA/DI: acceso total
- PA: solo pagos de sus alumnos vinculados
- AL: solo sus propios pagos
- DO: sin acceso

### 5.2 MatriculaScope
- SA/DI: todas las matrículas de la institución
- PA: matrículas de sus alumnos (estados SOLICITADA/APROBADA)
- AL: su propia matrícula
- DO: sin acceso

### 5.3 CertificadoScope
- SA/DI: emitir, aprobar, rechazar, listar todos, descargar todos
- PA/AL: solicitar, descargar propios
- DO: sin acceso

---

## 6. Pruebas

### 6.1 Cobertura objetivo
- Servicios: ≥ 80% (pagos, matrículas, certificados)
- Controladores: ≥ 70%
- Repositorios: ≥ 70%

### 6.2 Casos de prueba por servicio

| Servicio | Casos felices | Casos error/validación |
|---|---|---|
| PagoService | crear, anular, listar, estado cuenta | monto inválido, anular inexistente, alumno sin vínculo |
| MatriculaService | solicitar, aprobar, rechazar, retirar, listar | capacidad llena, sin apoderado principal, año cerrado |
| CertificadoService | emitir, solicitar, aprobar, rechazar, descargar, plantillas | plantilla inválida, variables faltantes, permisos |

### 6.3 Archivos de prueba
```
apps/api/test/administrative/
├─ pagos/
│  ├─ pago.scope.test.ts
│  ├─ pago.service.test.ts
│  ├─ pago.controller.test.ts
│  └─ api-pagos.test.ts
├─ matriculas/
│  ├─ matricula.scope.test.ts
│  ├─ matricula.service.test.ts
│  └─ api-matriculas.test.ts
└─ certificados/
   ├─ certificado.scope.test.ts
   ├─ certificado.service.test.ts
   ├─ certificado.controller.test.ts
   └─ api-certificados.test.ts
```

---

## 7. Frontend (Web)

### 7.1 Páginas
| Ruta | Componente | Permiso |
|---|---|---|
| `/administrative/pagos` | `PagosPage` | `administrative.pagos.leer` |
| `/administrative/pagos/nuevo` | `PagoForm` | `administrative.pagos.registrar` |
| `/administrative/estado-cuenta/:alumnoId` | `EstadoCuentaPage` | `administrative.pagos.leer` |
| `/administrative/matriculas` | `MatriculasPage` | `administrative.matriculas.leer` |
| `/administrative/matriculas/nueva` | `MatriculaForm` | `administrative.matriculas.gestionar` |
| `/administrative/certificados` | `CertificadosPage` | `administrative.certificados.leer` |
| `/administrative/certificados/nuevo` | `CertificadoForm` | `administrative.certificados.emitir` |
| `/administrative/plantillas` | `PlantillasPage` | `administrative.certificados.emitir` |

### 7.2 Componentes compartidos
- `PlantillaEditor.tsx` — editor HTML con preview variables
- `formato.ts` — `formatoMoneda`, `formatoFecha`, `formatoNumeroCertificado`
- `api.ts` — clientes tipados con `packages/shared`

---

## 8. Constitution Check

| Sección | Cumple | Evidencia |
|---|---|---|
| Precedencia (§I) | ✔ | spec.md aprobada antes de plan.md |
| SDD (§II) | ✔ | Requerimientos, modelo, criterios, trazabilidad RF |
| Arquitectura (§III) | ✔ | Monorepo, shared, API REST, sin acoplamiento |
| Datos (§IV) | ✔ | UUID, DECIMAL(10,2), auditoría, soft delete, UTC |
| RBAC (§V) | ✔ | Permisos en rbac-matrix.md, códigos en shared |
| Privacidad (§VI) | ✔ | Sin PII en logs/URLs, auditoría con redaction |
| Pruebas (§VII) | ✔ | 70%+ cobertura, casos feliz+error, gate obligatorio |
| UX (§VIII) | ✔ | es-PE, mobile-first, WCAG 2.1 AA, estados carga/vacío/error |
| Operación (§IX) | ✔ | Migraciones Prisma, health check, logs sin PII |
| Gobernanza (§X) | ✔ | Spec versionada, ADR pendiente almacenamiento, glosario actualizado |

### Decisiones técnicas pendientes (ADRs)
1. **Almacenamiento de PDFs certificados** — Local vs S3 vs BD (requiere ADR antes de T011)
2. **Numeración certificados** — Por institución vs global (resuelto: por institución + tipo + año)

---

## 9. Trazabilidad RF → Tareas (resumen)

| RF | Tareas estimadas |
|---|---|
| RF-ADM-001 a 004 (Pagos) | T001–T008 |
| RF-ADM-005 a 010 (Matrículas) | T009–T016 |
| RF-ADM-011 a 014 (Certificados) | T017–T028 |
| Transversal (schemas, permisos, migración) | T001–T004 |

**Total estimado:** ~32 tareas atómicas

---

## 10. Riesgos y Dependencias

| Riesgo | Mitigación |
|---|---|
| Capacidad de sección en matrícula | Validación en servicio + índice único parcial simulado |
| Numeración certificados concurrente | Transacción Prisma + contador atómico |
| Almacenamiento PDFs producción | ADR antes de implementar T011 |
| Seed plantillas idempotente | Upsert por `tipo + version` |

---

**Fin del plan.** Próximo paso: crear `tasks.md` con tareas atómicas T001–T032.