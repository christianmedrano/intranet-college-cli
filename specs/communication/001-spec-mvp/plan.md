# Plan MVP — Módulo de Comunicación

**Versión:** 1.0.0
**Fecha:** 2026-11-11
**Spec:** `specs/communication/001-spec-mvp/spec.md`
**Estado:** Aprobado

---

## 1. Arquitectura

### 1.1 Estructura de código (monorepo)

```
apps/
├─ api/
│  └─ src/
│     └─ modules/
│        └─ communication/
│           ├─ anuncios/
│           │  ├─ anuncio.controller.ts
│           │  ├─ anuncio.repository.ts
│           │  ├─ anuncio.routes.ts
│           │  ├─ anuncio.scope.ts
│           │  └─ anuncio.service.ts
│           ├─ adjuntos/
│           │  ├─ adjunto.controller.ts
│           │  ├─ adjunto.repository.ts
│           │  └─ adjunto.service.ts
│           └─ mensajeria/
│              ├─ hilo.repository.ts
│              ├─ mensaje.controller.ts
│              ├─ mensaje.repository.ts
│              ├─ mensaje.routes.ts
│              ├─ mensaje.scope.ts
│              └─ mensaje.service.ts
└─ web/
   └─ src/
      └─ features/
         └─ communication/
            ├─ anuncios/
            │  ├─ AnunciosPage.tsx
            │  ├─ AnuncioForm.tsx
            │  ├─ AnuncioDetalle.tsx
            │  ├─ api.ts
            │  └─ AnunciosPage.test.tsx
            ├─ mensajeria/
            │  ├─ MensajeriaPage.tsx
            │  ├─ MensajeForm.tsx
            │  ├─ api.ts
            │  └─ MensajeriaPage.test.tsx
            └─ shared/
               ├─ formato.ts
               └─ adjuntos.ts
```

### 1.2 Dependencias

- `apps/api` → `packages/shared` (tipos, schemas Zod, contratos)
- `apps/web` → `packages/shared` (tipos, schemas Zod, contratos)
- `apps/api` módulo `communication` usa:
  - `core.auth` (guards, JWT)
  - `core.rbac` (permisos)
  - `core.audit` (auditoría obligatoria)
  - `core.db` (Prisma client)
  - `academic.scope` (vínculos docente/apoderado/alumno con secciones)

### 1.3 Flujo de una petición

1. Cliente → `/api/v1/anuncios` o `/api/v1/secciones/:id/mensajes`
2. Fastify valida JWT → resuelve usuario + roles + permisos unidos
3. Guard RBAC verifica permiso (`communication.anuncios.gestionar`, etc.)
4. `scope.ts` resuelve vínculo con recurso (sección, nivel, grado, rol)
5. Controller valida entrada con Zod
6. Service aplica reglas de negocio (segmentación, hilos, adjuntos)
6. Repository accede a MySQL vía Prisma
7. Auditoría dentro de transacción si hay escritura
8. Respuesta con DTO de `packages/shared`

---

## 2. Contratos de API (Zod en `packages/shared`)

### 2.1 Esquemas de entrada

```typescript
// packages/shared/src/schemas/communication/anuncio.ts
export const crearAnuncioSchema = z.object({
  titulo: z.string().trim().min(1).max(200),
  cuerpo: z.string().trim().min(1).max(10000),
  tipo: z.enum(['INSTITUCIONAL', 'SECCION']),
  estado: z.enum(['BORRADOR', 'PUBLICADO']).default('BORRADOR'),
  audienciaNiveles: z.array(uuidSchema).optional(),
  audienciaGrados: z.array(uuidSchema).optional(),
  audienciaSecciones: z.array(uuidSchema).optional(),
  audienciaRoles: z.array(roleCodeSchema).optional(),
  expiraEn: z.iso.datetime().optional(),
}).refine(
  (d) => d.tipo === 'SECCION' || (d.audienciaNiveles?.length ?? 0) + (d.audienciaGrados?.length ?? 0) + (d.audienciaSecciones?.length ?? 0) + (d.audienciaRoles?.length ?? 0) > 0,
  { message: 'Anuncio institucional requiere al menos una audiencia', path: ['audienciaNiveles'] }
)

export const actualizarAnuncioSchema = crearAnuncioSchema.partial().extend({
  estado: z.enum(['BORRADOR', 'PUBLICADO', 'EXPIRADO', 'ARCHIVADO']).optional(),
})

export const listarAnunciosQuerySchema = paginationSchema.extend({
  tipo: z.enum(['INSTITUCIONAL', 'SECCION']).optional(),
  estado: z.enum(['BORRADOR', 'PUBLICADO', 'EXPIRADO', 'ARCHIVADO']).optional(),
  nivelId: uuidSchema.optional(),
  gradoId: uuidSchema.optional(),
  seccionId: uuidSchema.optional(),
  rol: roleCodeSchema.optional(),
  desde: z.iso.datetime().optional(),
  hasta: z.iso.datetime().optional(),
})

// packages/shared/src/schemas/communication/mensaje.ts
export const crearMensajeSchema = z.object({
  cuerpo: z.string().trim().min(1).max(5000),
})

export const listarMensajesQuerySchema = paginationSchema.extend({
  seccionId: uuidSchema,
})
```

### 2.2 Contratos de respuesta

```typescript
// packages/shared/src/contracts/communication/anuncio.ts
export interface AnuncioResponse {
  id: string
  institucionId: string
  autorId: string
  titulo: string
  cuerpo: string
  tipo: 'INSTITUCIONAL' | 'SECCION'
  estado: 'BORRADOR' | 'PUBLICADO' | 'EXPIRADO' | 'ARCHIVADO'
  audienciaNiveles: string[]
  audienciaGrados: string[]
  audienciaSecciones: string[]
  audienciaRoles: RoleCode[]
  publicadoEn: string | null
  expiraEn: string | null
  createdAt: string
  updatedAt: string
  adjuntos: AdjuntoResponse[]
}

export interface PaginatedAnunciosResponse {
  data: AnuncioResponse[]
  meta: PaginationMeta
}

// packages/shared/src/contracts/communication/mensaje.ts
export interface MensajeResponse {
  id: string
  hiloId: string
  autorId: string
  autorNombre: string
  autorRol: RoleCode
  cuerpo: string
  createdAt: string
  updatedAt: string
  adjuntos: AdjuntoResponse[]
}

export interface PaginatedMensajesResponse {
  data: MensajeResponse[]
  meta: PaginationMeta
}

// packages/shared/src/contracts/communication/adjunto.ts
export interface AdjuntoResponse {
  id: string
  nombreOriginal: string
  url: string
  tipoMime: string
  tamanoBytes: number
  createdAt: string
}
```

---

## 3. Migraciones de base de datos (Prisma)

```prisma
// apps/api/prisma/schema.prisma (añadir al final)

model Anuncio {
  id                   String   @id @default(uuid())
  institucionId        String
  autorId              String
  titulo               String   @db.VarChar(200)
  cuerpo               String   @db.Text
  tipo                 AnuncioTipo
  estado               AnuncioEstado @default(BORRADOR)
  audienciaNiveles     String[] @default([])
  audienciaGrados      String[] @default([])
  audienciaSecciones   String[] @default([])
  audienciaRoles       RoleCode[] @default([])
  publicadoEn          DateTime?
  expiraEn             DateTime?
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt
  deletedAt            DateTime?

  adjuntos             AdjuntoAnuncio[]
  @@index([institucionId, estado])
  @@index([tipo, estado])
  @@index([publicadoEn])
  @@map("anuncios")
}

model AdjuntoAnuncio {
  id               String   @id @default(uuid())
  anuncioId        String
  nombreOriginal   String   @db.VarChar(255)
  nombreAlmacenado String   @db.VarChar(500)
  tipoMime         String   @db.VarChar(100)
  tamanoBytes      Int
  createdAt        DateTime @default(now())

  anuncio          Anuncio  @relation(fields: [anuncioId], references: [id], onDelete: Cascade)
  @@map("adjuntos_anuncio")
}

model HiloMensajeria {
  id        String   @id @default(uuid())
  seccionId String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  mensajes  MensajeSeccion[]
  @@map("hilos_mensajeria")
}

model MensajeSeccion {
  id        String   @id @default(uuid())
  hiloId    String
  autorId   String
  cuerpo    String   @db.Text
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime?

  hilo      HiloMensajeria @relation(fields: [hiloId], references: [id], onDelete: Cascade)
  adjuntos  AdjuntoMensaje[]
  @@index([hiloId, createdAt])
  @@map("mensajes_seccion")
}

model AdjuntoMensaje {
  id               String   @id @default(uuid())
  mensajeId        String
  nombreOriginal   String   @db.VarChar(255)
  nombreAlmacenado String   @db.VarChar(500)
  tipoMime         String   @db.VarChar(100)
  tamanoBytes      Int
  createdAt        DateTime @default(now())

  mensaje          MensajeSeccion @relation(fields: [mensajeId], references: [id], onDelete: Cascade)
  @@map("adjuntos_mensaje")
}

enum AnuncioTipo {
  INSTITUCIONAL
  SECCION
}

enum AnuncioEstado {
  BORRADOR
  PUBLICADO
  EXPIRADO
  ARCHIVADO
}
```

Migración: `prisma migrate dev --name communication_init`

---

## 4. Implementación por capas

### 4.1 Backend (`apps/api`)

| Archivo | Responsabilidad |
|---|---|
| `anuncio.routes.ts` | Rutas CRUD anuncios + adjuntos; guards de permiso |
| `anuncio.scope.ts` | `construirAlcanceAnuncios(actor, filtros)` — segmentación por vínculo |
| `anuncio.service.ts` | Reglas: audiencia, estado, expiración, auditoría |
| `anuncio.repository.ts` | Prisma queries + mapeo a DTO |
| `anuncio.controller.ts` | Validación Zod, llamada a service, respuesta HTTP |
| `mensaje.routes.ts` | Rutas hilo sección + mensajes + adjuntos |
| `mensaje.scope.ts` | `construirAlcanceMensajes(actor, seccionId)` — tutor + apoderados vinculados |
| `mensaje.service.ts` | Reglas: hilo único por sección, autor válido, adjuntos |
| `mensaje.repository.ts` | Prisma queries + mapeo a DTO |
| `mensaje.controller.ts` | Validación Zod, llamada a service |
| `adjunto.service.ts` | Subida/borrado adjuntos (compartido anuncios/mensajes) |

### 4.2 Frontend (`apps/web`)

| Archivo | Responsabilidad |
|---|---|
| `anuncios/api.ts` | Cliente tipado (listar, crear, actualizar, adjuntos) |
| `anuncios/AnunciosPage.tsx` | Lista con filtros, paginación, estados carga/vacío/error |
| `anuncios/AnuncioForm.tsx` | Crear/editar anuncio (segmentación, rich text, adjuntos) |
| `anuncios/AnuncioDetalle.tsx` | Vista de anuncio con adjuntos |
| `mensajeria/api.ts` | Cliente tipado (listar/enviar mensajes, adjuntos) |
| `mensajeria/MensajeriaPage.tsx` | Hilo de sección con lista de mensajes, formulario envío |
| `mensajeria/MensajeForm.tsx` | Formulario mensaje (rich text, adjuntos) |
| `shared/formato.ts` | Helpers: `mensajeError`, `truncarTexto`, `formatoFecha` |
| `shared/adjuntos.ts` | Componente `AdjuntosUpload`, validación cliente |

### 4.3 Shared (`packages/shared`)

- `schemas/communication/anuncio.ts`
- `schemas/communication/mensaje.ts`
- `schemas/communication/adjunto.ts`
- `contracts/communication/anuncio.ts`
- `contracts/communication/mensaje.ts`
- `contracts/communication/adjunto.ts`
- Exportar en `packages/shared/src/index.ts`

---

## 5. Pruebas

### 5.1 API (Vitest + Supertest)

| Archivo | Cobertura |
|---|---|
| `anuncio.service.test.ts` | Crear institucional/sección, segmentación, estado, expiración |
| `anuncio.scope.test.ts` | Alcance: DI ve todo, DO tutor ve sus secciones, PA ve vinculados, AL ve su rol |
| `anuncio.controller.test.ts` | 403 sin permiso, 400 validación, 201/200 feliz |
| `mensaje.service.test.ts` | Hilo único por sección, tutor+apoderados, Director auditado |
| `mensaje.scope.test.ts` | Vínculo apoderado-alumno-sección |
| `adjunto.service.test.ts` | Tipos permitidos, tamaño máximo, borrado lógico |

### 5.2 Frontend (Testing Library)

| Archivo | Cobertura |
|---|---|
| `AnunciosPage.test.tsx` | Carga, vacío, error, filtros, paginación, crear/editar |
| `AnuncioForm.test.tsx` | Validación segmentación, rich text, adjuntos |
| `MensajeriaPage.test.tsx` | Lista mensajes, envío, adjuntos, roles |
| `MensajeForm.test.tsx` | Validación cuerpo, adjuntos |

### 5.3 E2E (Playwright - futuro)

- Flujo: Director crea anuncio → apoderado lo ve → tutor responde en hilo

---

## 6. Constitution Check

| Sección | Cumple | Observación |
|---|---|---|
| **§I Precedencia** | ✅ | Spec aprobada antes del plan |
| **§II SDD** | ✅ | Spec → Plan → Tasks → Código |
| **§III Arquitectura** | ✅ | Monorepo, shared, API first, MySQL/Prisma |
| **§III Stack** | ✅ | React, Fastify, Prisma, Zod, Vitest, Playwright |
| **§III Dependencias** | ✅ | Solo stack aprobado; adjuntos reutiliza aula virtual |
| **§III Prohibiciones** | ✅ | Sin lógica en UI, sin any, sin localStorage |
| **§IV Datos** | ✅ | UUID, auditoría, borrado lógico, UTC, DECIMAL, migraciones |
| **§IV Integridad** | ✅ | Borrado lógico en anuncios/mensajes/adjuntos |
| **§IV Escala** | N/A | No aplica a comunicación |
| **§IV Períodos** | N/A | No aplica a comunicación |
| **§V RBAC** | ✅ | Permisos `communication.*` alineados con matriz |
| **§V Auth** | ✅ | JWT, refresh cookie, rate limit (core) |
| **§V Validación** | ✅ | Zod en borde, CORS, errores sin trazas |
| **§V Auditoría** | ✅ | Lectura/escritura auditada (SuperAdmin/Director) |
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
| RF-COM-001 | T001: Endpoint crear anuncio institucional; T002: Servicio + scope; T003: Tests API |
| RF-COM-002 | T004: Endpoint crear anuncio sección; T005: Validación tutor; T006: Tests |
| RF-COM-003 | T007: Listar anuncios con scope; T008: Filtros + paginación; T009: Tests |
| RF-COM-004 | T010: Hilo mensajería por sección; T011: Enviar mensaje; T012: Tests |
| RF-COM-005 | T013: Listar mensajes hilo; T014: Scope tutor/apoderado/Director; T015: Tests |
| RF-COM-006 | T016: Adjuntos anuncios; T017: Adjuntos mensajes; T018: Validación tipos/tamaño |
| Frontend | T019: AnunciosPage + AnuncioForm; T020: MensajeriaPage + MensajeForm; T021: Tests UI |
| Shared | T022: Schemas + contratos communication en packages/shared |

---

## 8. Riesgos y dependencias

| Riesgo | Mitigación |
|---|---|
| Almacenamiento adjuntos indefinido | Reutilizar configuración aula virtual; decidir en ADR antes de T016 |
| Rich text (Markdown vs HTML) | Definir en spec §10.1; usar librería ligera (`marked` + sanitize) |
| Notificaciones in-app | MVP sin push/email; badge simple en header (futura task) |
| Mensajería sin hilos 1:1 | Confirmado: hilo grupal único por sección (RN-COM-012) |

---

## 9. Próximos pasos

1. **Aprobar este plan** → crear `tasks.md` con tareas atómicas T001–T022
2. Ejecutar `prisma migrate dev --name communication_init`
3. Implementar `packages/shared` schemas/contratos (T022)
4. Backend: anuncios → mensajería → adjuntos
5. Frontend: anuncios → mensajería
6. Gate completo antes de cerrar