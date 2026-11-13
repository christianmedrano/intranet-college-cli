# Plan MVP — Módulo Aula Virtual

**Versión:** 1.0.0
**Fecha:** 2026-11-12
**Spec:** `specs/virtual-classroom/001-spec-mvp/spec.md`
**Estado:** Aprobado

---

## 1. Arquitectura

### 1.1 Estructura de código (monorepo)

```
apps/
├─ api/
│  └─ src/
│     └─ modules/
│        └─ virtual-classroom/
│           ├─ materiales/
│           │  ├─ material.controller.ts
│           │  ├─ material.repository.ts
│           │  ├─ material.routes.ts
│           │  ├─ material.scope.ts
│           │  └─ material.service.ts
│           └─ adjuntos/
│              ├─ adjunto.repository.ts
│              ├─ adjunto.service.ts
│              └─ adjunto.controller.ts
└─ web/
   └─ src/
      └─ features/
         └─ virtual-classroom/
            ├─ materiales/
            │  ├─ MaterialesPage.tsx
│           │  ├─ MaterialForm.tsx
│           │  ├─ MaterialDetalle.tsx
│           │  ├─ api.ts
│           │  └── *.test.tsx
            ├─ adjuntos/
            │  └── api.ts
            └─ shared/
               └── formato.ts
```

### 1.2 Dependencias

- `apps/api` → `packages/shared` (tipos, schemas Zod, contratos)
- `apps/web` → `packages/shared` (tipos, schemas Zod, contratos)
- `apps/api` módulo `virtual-classroom` usa:
  - `core.auth` (guards, JWT)
  - `core.rbac` (permisos)
  - `core.audit` (auditoría obligatoria)
  - `core.db` (Prisma client)
  - `academic.scope` (vínculos docente/apoderado/alumno con curso/sección)
  - `communication.adjuntos` servicio compartido para subida/descarga

### 1.3 Flujo de una petición

1. Cliente → `/api/v1/virtual/materiales` o `/api/v1/virtual/materiales/:id`
2. Fastify valida JWT → resuelve usuario + roles + permisos unidos
3. Guard RBAC verifica permiso (`virtual.leer`, `virtual.gestionar`)
4. Scope resuelve vínculo con recurso (curso/sección/período/docente)
5. Controller valida entrada con Zod
6. Service aplica reglas de negocio
6. Repository accede a MySQL vía Prisma
7. Auditoría dentro de transacción si hay escritura
8. Respuesta con DTO de `packages/shared`

---

## 2. Contratos de API (Zod en `packages/shared`)

### 2.1 Esquemas de entrada

```typescript
// packages/shared/src/schemas/virtual-classroom/material.ts
import { z } from 'zod'
import { paginationMetaSchema, paginationSchema, uuidSchema } from '../base.js'
import { tipoMimeVirtualSchema } from './adjunto.js'

const tipoMimeVirtualSchema = z.enum([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/jpeg',
  'image/png',
  'image/webp',
])

/** Tamaño máximo por defecto (10 MB), configurable en core.config. */
export const TAMANO_MAXIMO_BYTES = 10 * 1024 * 1024

/** Valida tipo MIME contra lista blanca. */
export function esTipoMimePermitido(mime: string): boolean {
  return ['application/pdf',
    'application/msword',
    'application/vnd.openxmlformatsofficedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformatsofficedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformatsofficedocument.presentationml.presentation',
    'image/jpeg',
    'image/png',
    'image/webp'
  ].includes(mime)
}

/** Creación de material (RF-VIR-001). */
export const crearMaterialSchema = z.object({
  cursoId: uuidSchema,
  seccionId: uuidSchema,
  periodoId: uuidSchema,
  titulo: z.string().trim().min(1, 'El título es obligatorio').max(200),
  descripcion: z.string().trim().max(5000).optional(),
  archivoNombre: z.string().min(1),
  archivoMime: tipoMimeVirtualSchema,
  tamanoBytes: z.number().int().positive(),
}).refine(
  (data) => data.tamanoBytes <= 10 * 1024 * 1024,
  { message: 'El archivo supera el tamaño máximo permitido', path: ['tamanoBytes'] },
)

export type CrearMaterialInput = z.infer<typeof crearMaterialSchema>

/** Actualización parcial de material. */
export const actualizarMaterialSchema = crearMaterialSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar',
  })

export type ActualizarMaterialInput = z.infer<typeof actualizarMaterialSchema>

/** Filtros de listado (RF-VIR-004). */
export const listarMaterialesQuerySchema = paginationSchema.extend({
  cursoId: uuidSchema.optional(),
  seccionId: uuidSchema.optional(),
  periodoId: uuidSchema.optional(),
  docenteId: uuidSchema.optional(),
})

export type ListarMaterialesQuery = z.infer<typeof listarMaterialesQuerySchema>
```

### 2.2 Schemas de adjuntos

```typescript
// packages/shared/src/schemas/virtual-classroom/adjunto.ts
import { z } from 'zod'
import { uuidSchema } from '../base.js'

export const adjuntoVirtualMetadatosSchema = z.object({
  nombreOriginal: z.string().min(1).max(255),
  tipoMime: z.string().min(1).max(100),
  tamanoBytes: z.number().int().positive(),
})

export type AdjuntoVirtualMetadatosInput = z.infer<typeof adjuntoVirtualMetadatosSchema>

/** Respuesta genérica de adjunto. */
export const adjuntoVirtualResponseSchema = z.object({
  id: uuidSchema,
  materialId: uuidSchema,
  nombreOriginal: z.string(),
  url: z.string().url(),
  tipoMime: z.string(),
  tamanoBytes: z.number().int().nonnegative(),
  createdAt: z.string(),
})

export type AdjuntoVirtualResponsePayload = z.infer<typeof adjuntoVirtualResponseSchema>
```

### 2.3 Contratos de respuesta

```typescript
// packages/shared/src/contracts/virtual-classroom/material.ts
import type { PaginationMeta } from '../../schemas/base.js'

export interface MaterialResponse {
  id: string
  cursoId: string
  seccionId: string
  periodoId: string
  docenteId: string
  titulo: string
  descripcion: string | null
  archivoNombre: string
  archivoMime: string
  tamanoBytes: number
  createdAt: string
  updatedAt: string
  adjuntos: AdjuntoVirtualResponse[]
}

export interface PaginatedMaterialesResponse {
  data: MaterialMaterialResponse[]
  meta: PaginationMeta
}
```

---

## 3. Migraciones de base de datos (Prisma)

```prisma
// apps/api/prisma/schema.prisma

model MaterialVirtual {
  id              String  @id @default(uuid()) @db.Char(36)
  cursoId         String  @map("curso_id") @db.Char(36)
  seccionId       String  @map("seccion_id") @db.Char(36)
  periodoId       String  @map("periodo_id") @db.Char(36)
  docenteId       String  @map("docente_id") @db.Char(36)
  titulo          String  @db.VarChar(200)
  descripcion     String? @db.Text
  archivoNombre   String  @map("archivo_nombre") @db.VarChar(255)
  archivoRuta     String  @map("archivo_ruta") @db.VarChar(500)
  archivoMime     String  @map("archivo_mime") @db.VarChar(100)
  tamanoBytes     Int     @map("tamano_bytes")

  createdAt       DateTime  @default(now()) @map("created_at") @db.DateTime(3)
  updatedAt       DateTime  @updatedAt @map("updated_at") @db.DateTime(3)
  createdBy       String?   @map("created_by") @db.Char(36)
  updatedBy       String?   @map("updated_by") @db.Char(36)
  deletedAt       DateTime? @map("deleted_at") @db.DateTime(3)

  curso           Curso            @relation(fields: [cursoId], references: [id], onDelete: Restrict)
  seccion         Seccion          @relation(fields: [seccionId], references: [id], onDelete: Restrict)
  periodo         PeriodoAcademico @relation(fields: [periodoId], references: [id], onDelete: Restrict)
  docente         Docente          @relation(fields: [docenteId], references: [id], onDelete: Restrict)
  adjuntos        AdjuntoVirtual[]

  @@index([cursoId, seccionId, periodoId])
  @@index([docenteId])
  @@index([cursoId, seccionId, periodoId, docenteId, titulo], name: "materiales_docente_curso_seccion_periodo_titulo_key")
  @@map("materiales_virtuales")
}

model AdjuntoVirtual {
  id              String  @id @default(uuid()) @db.Char(36)
  materialId      String  @map("material_id") @db.Char(36)
  nombreOriginal  String  @map("nombre_original") @db.VarChar(255)
  nombreAlmacenado String  @map("nombre_almacenado") @db.VarChar(500)
  tipoMime        String  @map("tipo_mime") @db.VarChar(100)
  tamanoBytes     Int     @map("tamano_bytes")

  createdAt DateTime @default(now()) @map("created_at") @db.DateTime(3)

  material MaterialVirtual @relation(fields: [materialId], references: [id], onDelete: Cascade)

  @@map("adjuntos_virtuales")
}
```

Migración: `prisma migrate dev --name virtual_classroom_init`

---

## 4. Implementación por capas

### 4.1 Backend (`apps/api`)

| Archivo | Responsabilidad |
|---|---|
| `material.routes.ts` | Rutas CRUD + descarga + adjuntos; guards de permiso |
| `material.scope.ts` | `construirAlcanceMateriales(actor, filtros)` — vínculo docente/curso/sección/alumno |
| `material.service.ts` | Reglas: audiencia, duplicados, validación adjunto, auditoría |
| `material.controller.ts` | Validación Zod, llamada service, respuesta HTTP |
| `material.repository.ts` | Prisma queries + mapeo a DTO |
| `adjunto.service.ts` | Subida/borrado adjuntos (reutiliza lógica communication) |
| `adjunto.repository.ts` | Prisma queries adjuntos |

### 4.2 Frontend (`apps/web`)

| Archivo | Responsabilidad |
|---|---|
| `materiales/api.ts` | Cliente tipado (listar, crear, actualizar, eliminar, adjuntos, descarga) |
| `MaterialesPage.tsx` | Lista con filtros, paginación, estados carga/vacío/error |
| `MaterialForm.tsx` | Crear/editar material (título, descripción, curso, sección, período, adjunto) |
| `MaterialDetalle.tsx` | Vista completa con adjuntos + botón descarga |
| `shared/formato.ts` | Helpers: `mensajeError`, `formatoFecha`, `truncarTexto` |
| `shared/AdjuntosUpload.tsx` | Reutiliza componente de communication |
| `shared/adjuntos.ts` | Tipos adjuntos + validación cliente |

### 4.3 Shared (`packages/shared`)

- `schemas/virtual-classroom/material.ts`
- `schemas/virtual-classroom/adjunto.ts`
- `contracts/virtual-classroom/material.ts`
- `contracts/virtual-classroom/adjunto.ts`
- Exportar en `packages/shared/src/index.ts`

---

## 5. Pruebas

### 5.1 API (Vitest + Supertest)

| Archivo | Cobertura |
|---|---|
| `material.service.test.ts` | Crear, actualizar, eliminar, duplicados, validación adjunto |
| `material.scope.test.ts` | Alcance: DI ve todo, DO ve sus cursos, PA/AL ven vinculados |
| `material.controller.test.ts` | 403 sin permiso, 400 validación, 201/200 feliz |
| `adjunto.service.test.ts` | Tipos permitidos, tamaño máximo, vínculo material |

### 5.2 Frontend (Testing Library)

| Archivo | Cobertura |
|---|---|
| `MaterialesPage.test.tsx` | Carga, vacío, error, filtros, paginación, crear/editar |
| `MaterialForm.test.tsx` | Validación campos, adjunto, mensajes español |
| `AdjuntosUpload.test.tsx` | Validación MIME/tamaño, preview, límite archivos |

### 5.3 E2E (Playwright - futuro)

- Flujo: Docente sube material → Alumno descarga

---

## 6. Constitution Check

| Sección | Cumple | Observación |
|---|---|---|
| **§I Precedencia** | ✅ | Spec aprobada antes del plan |
| **§II SDD** | ✅ | Spec → Plan → Tasks → Código |
| **§III Arquitectura** | ✅ | Monorepo, shared, API first, MySQL/Prisma |
| **§III Stack** | ✅ | React, Fastify, Prisma, Zod, Vitest, Playwright |
| **§III Dependencias** | ✅ | Solo stack aprobado; adjuntos comparte infraestructura communication |
| **§III Prohibiciones** | ✅ | Sin lógica en UI, sin any, sin localStorage |
| **§IV Datos** | ✅ | UUID, auditoría, borrado lógico, UTC, DECIMAL, migraciones |
| **§IV Integridad** | ✅ | Borrado lógico en Materiales/Adjuntos |
| **§IV Períodos** | ✅ | Sin hardcodear 3/4 períodos |
| **§V RBAC** | ✅ | Permisos `virtual.*` alineados con matriz |
| **§V Auth** | ✅ | JWT, refresh cookie, rate limit (core) |
| **§V Validación** | ✅ | Zod en borde, CORS, errores sin trazas |
| **§V Auditoría** | ✅ | Lectura/escritura auditada (DI/SA) |
| **§VI Privacidad** | ✅ | Sin PII en logs/URLs, minimización |
| **§VII Tipado** | ✅ | Strict, noUncheckedIndexedAccess, no any |
| **§VII Tests** | ✅ | Caso feliz + error, gate obligatorio |
| **§VII Estrategia** | ✅ | Dominio, API, UI, E2E definidos |
| **§VIII UX** | ✅ | Mobile-first, WCAG 2.1 AA, es-PE, estados obligatorios |
| **§IX Operación** | ✅ | Node LTS, .env validado, git convencional, health check |

---

## 7. Trazabilidad RF → Tareas (para `tasks.md`)

| RF | Tareas estimadas |
|---|---|
| RF-VIR-001 | T001–T003 |
| RF-VIR-002 | T004–T005 |
| RF-VIR-003 | T006–T007 |
| RF-VIR-004 | T008–T010 |
| RF-VIR-005 | T011–T012 |

---

## 8. Riesgos y dependencias

| Riesgo | Mitigación |
|---|---|
| Almacenamiento adjuntos indefinido en prod | ADR antes de implementar; reutilizar config communication |
| Tamaño máximo archivos > 10 MB problemático para algunos PDFs | Configurable via `VIRTUAL_MAX_FILE_SIZE` (env) |
| Sin previsualización PDF en UI | Confirmado: solo descarga en MVP |
| Seed datos para E2E | Requiere docente/alumno/apoderado con cursos/matriculas |

---

## 9. Próximos pasos

1. **Crear `tasks.md`** con tareas atómicas T001–T014
2. **Ejecutar migración** `prisma migrate dev --name virtual_classroom_init`
3. **Implementar `packages/shared`** schemas/contratos
4. **Backend**: repository → scope → service → controller → routes
5. **Frontend**: shared → api → formularios → páginas → tests
6. **Gate completo** antes de cerrar