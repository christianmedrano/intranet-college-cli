# Especificación MVP — Módulo Aula Virtual

| Campo | Valor |
|---|---|
| ID | `VIR-001` |
| Módulo | `virtual-classroom` |
| Versión | `1.0.0` |
| Estado | `borrador` |
| Autor | |
| Fecha | `2026-11-12` |

---

## 1. Contexto

El módulo "Aula Virtual" implementa el repositorio de materiales pedagógicos por curso y período académico, permitiendo a docentes publicar recursos (PDF, DOCX, XLSX, PPTX, imágenes) y a alumnos/apoderados consultarlos y descargarlos. Es el quinto componente del MVP (Inicial, Primaria, Secundaria).

**Problema:** Falta un repositorio centralizado y controlado por curso/sección/período para materiales académicos, con control de acceso por vínculo (docente de curso, alumno/apoderado matriculado) y auditoría completa.

---

## 2. Alcance

### Incluye
- Registro y actualización de materiales por docente (su curso/período)
- Consulta y descarga por alumno/apoderado (según matrícula vigente)
- Consultad completa por Director/SuperAdmin (auditada)
- Gestión de adjuntos (subida, listado, eliminación)
- Eliminación lógica con auditoría
- Almacenamiento local en desarrollo, preparación para S3 en producción

### No incluye
- Reproductor multimedia nativo
- Comentarios/valoraciones en materiales
- Sincronización con LMS externos
- Notificaciones push/email (MVP)
- Previsualización en navegador (solo descarga)
- Versionado de materiales

---

## 3. Actores y permisos

| Acción | SA | DI | DO | PA | AL |
|---|---|---|---|---|---|
| Subir/editar material | ✖ | ✔ | ⚠¹ | ✖ | ✖ |
| Consultar material | ✔² | ✔ | ⚠⁴ | ⚠⁵ | ⚠⁵ |
| Eliminar material | ✔ | ✔ | ⚠⁴ | ✖ | ✖ |

¹ Docente solo en sus cursos/secciones asignados y período vigente
² SuperAdmin acceso auditado
⁴ Docente vinculado al curso/sección/año
⁵ Apoderado/alumno solo si el alumno está matriculado en el curso/sección del material

**Códigos de permiso** (incorporados a `packages/shared`):

| Código | SA | DI | DO | PA | AL | Restricción |
|---|---|---|---|---|---|---|
| `virtual.leer` | ✔ auditado | ✔ | ✔ vinculado | ✔ vinculado | ✔ vinculado | - |
| `virtual.gestionar` | ✖ | ✔ | ✔ vinculado | ✖ | ✖ | Docente solo sus cursos/secciones |
| `virtual.eliminar` | ✔ | ✔ | ⚠⁴ | ✖ | ✖ | Docente solo sus materiales |

---

## 4. Requerimientos funcionales

### RF-VIR-001 — Subir material
**Descripción:** Docente crea material con título, descripción, curso, sección, período y archivo adjunto.

**Criterios de aceptación:**
- **Dado** docente con asignación vigente en curso/sección/año
- **Cuando** sube archivo PDF/DOCX/XLSX/PPTX/imagen ≤ tamaño máximo
- **Entonces** `201 CREATED`, archivo guardado con nombre seguro, auditoría `CREAR`

- **Dado** docente sin asignación en ese curso/sección/año
- **Cuando** intenta subir material
- **Entonces** `403 FORBIDDEN`

- **Dado** archivo tipo no permitido o > tamaño máximo
- **Cuando** se sube
- **Entonces** `400 VALIDATION_ERROR`

### RF-VIR-002 — Actualizar material
**Descripción:** Docente edita título, descripción o reemplaza archivo de su material.

**Criterios de aceptación:**
- **Dado** docente dueño del material
- **Cuando** actualiza metadatos o archivo
- **Entonces** `200 OK`, actualizado, auditoría `ACTUALIZAR` con `{anterior, nuevo}`

- **Dado** docente no dueño
- **Cuando** intenta editar
- **Entonces** `403 FORBIDDEN`

### RF-VIR-003 — Eliminar material (baja lógica)
**Descripción:** Docente/Director elimina material marcando `deleted_at`.

**Criterios de aceptación:**
- **Dado** docente dueño o Director
- **Cuando** elimina material
- **Entonces** `204 NO CONTENT`, `deleted_at` seteado, auditoría `ELIMINAR`

### RF-VIR-004 — Listar materiales
**Descripción:** Listado paginado con filtros con alcance por vínculo.

**Criterios de aceptación:**
- **Dado** alumno/apoderado
- **Cuando** lista materiales
- **Entonces** ve solo los de sus cursos/secciones matriculados

- **Dado** docente
- **Cuando** lista
- **Entonces** ve sus materiales + acceso lectura completo Director

### RF-VIR-005 — Descargar material
**Descripción:** Descarga directa del archivo con control de acceso.

**Criterios de aceptación:**
- **Dado** usuario con vínculo al curso/sección del material
- **Cuando** descarga
- **Entonces** `200 OK`, `Content-Disposition: attachment`, auditoría `ACCEDER`

- **Dado** sin vínculo
- **Cuando** intenta descargar
- **Entonces** `403 FORBIDDEN`

---

## 5. Reglas de negocio

| ID | Regla |
|---|---|
| RN-VIR-001 | Solo docente con `AsignacionDocente` vigente (`esTutor` o asignación curso/sección) puede crear/editar en ese curso/sección/año. |
| RN-VIR-002 | Material es único por `docenteId + cursoId + seccionId + periodoId + titulo` (validado en servicio). |
| RN-VIR-003 | Eliminación es lógica (`deleted_at`); archivo físico se conserva para auditoría/historia. |
| RN-VIR-004 | Descarga requiere `virtual.leer` + vínculo (matrícula alumno, asignación docente, o rol DI/SA). |
| RN-VIR-005 | Subida valida MIME ∈ {PDF, DOCX, XLSX, PPTX, JPEG, PNG, WEBP} y tamaño ≤ `VIRTUAL_MAX_FILE_SIZE` (default 10 MB, configurable). |
| RN-VIR-006 | Archivo almacenado con nombre seguro (UUID + extensión original) en ruta no predecible: `/uploads/virtual/{cursoId}/{seccionId}/{periodoId}/{uuid}.{ext}`. |
| RN-VIR-007 | Sin pasarela de subida a S3/Azure en MVP; almacenamiento local `/var/www/uploads/virtual/`. |
| RN-VIR-008 | Auditoría obligatoria en todas las mutaciones (incluye `usuarioId`, `accion`, `entidad`, `entidadId`, `datos` con diff). |
| RN-VIR-009 | Sin versionado en MVP: actualización sobrescribe archivo previo (auditado). |
| RN-VIR-010 | Sin previsualización en UI: solo botón descarga + metadata. |

---

## 6. Modelo de datos

### Entidades nuevas

| Entidad | Campos | Relaciones | Restricciones |
|---|---|---|---|
| `Material` | id, cursoId, seccionId, periodoId, docenteId, titulo, descripcion, archivoNombre, archivoRuta, archivoMime, tamanoBytes, createdAt, updatedAt, deletedAt, createdBy, updatedBy | `Curso`, `Seccion`, `PeriodoAcademico`, `Docente` (cursoId→Curso, seccionId→Seccion, periodoId→PeriodoAcademico, docenteId→Docente) | PK=id(UUID), UK(cursoId,seccionId,periodoId,docenteId,titulo), FKs obligatorias, índice en (cursoId,seccionId,periodoId), índice en docenteId |
| `AdjuntoVirtual` | id, materialId, nombreOriginal, nombreAlmacenado, tipoMime, tamanoBytes, createdAt | `Material` (1:N) | PK=id(UUID), FK materialId→Material.id cascade |

### Entidades existentes consumidas
- `Docente` (via `AsignacionDocente` para vínculo)
- `Alumno`/`Apoderado` (via `Matricula` para vínculo)
- `Curso`, `Seccion`, `PeriodoAcademico`, `AnioAcademico` (catálogos)

---

## 7. Contratos de API

### Endpoints

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| `GET` | `/api/v1/virtual/materiales` | `virtual.leer` | Listado paginado con filtros |
| `POST` | `/api/v1/virtual/materiales` | `virtual.gestionar` | Crear material |
| `GET` | `/api/v1/virtual/materiales/:id` | `virtual.leer` | Detalle material |
| `PATCH` | `/api/v1/virtual/materiales/:id` | `virtual.gestionar` | Actualizar (dueño/DI) |
| `DELETE` | `/api/v1/virtual/materiales/:id` | virtual.gestionar/eliminar | Baja lógica (dueño/DI) |
| `GET` | `/api/v1/virtual/materiales/:id/download` | virtual.leer + vínculo | Descarga archivo |
| `POST` | `/api/v1/virtual/materiales/:id/adjuntos` | virtual.gestionar | Subir adjunto extra |
| `DELETE` | `/api/v1/virtual/adjuntos/:id` | virtual.gestionar | Eliminar adjunto |

### Schemas Zod (en `packages/shared`)

```typescript
// material.ts
const tipoMimeVirtualSchema = z.enum(['application/pdf','application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/jpeg','image/png','image/webp'])

const crearMaterialSchema = z.object({
  cursoId: uuidSchema,
  seccionId: uuidSchema,
  periodoId: uuidSchema,
  titulo: z.string().trim().min(1).max(200),
  descripcion: z.string().trim().max(5000).optional(),
  archivoNombre: z.string().min(1),
  archivoMime: tipoMimeVirtualSchema,
  tamanoBytes: z.number().int().positive()
})

const actualizarMaterialSchema = crearMaterialSchema.partial()

const listarMaterialesQuerySchema = paginationSchema.extend({
  cursoId: uuidSchema.optional(),
  seccionId: uuidSchema.optional(),
  periodoId: uuidSchema.optional(),
  docenteId: uuidSchema.optional()
})
```

### Respuesta

```typescript
interface MaterialResponse {
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
```

---

## 8. Casos borde y errores

| Caso | Comportamiento |
|---|---|
| Sin permisos (curso sin asignación docente) | `403 FORBIDDEN` sin revelar existencia |
| Duplicado (mismo docente/curso/sección/período/título) | `409 CONFLICT` sin detalles del existente |
| Tipo MIME no permitido | `400 VALIDATION_ERROR` con lista permitida |
| Tamaño > límite | `400 VALIDATION_ERROR` con máximo |
| Archivo inexistente al descargar | `404 NOT_FOUND` sin trazas |
| Acceso sin vínculo (alumno sin matrícula) | `403 FORBIDDEN` sin listar disponibles |
| Director accediendo sin auditar | Nunca ocurre: todo acceso DI/SA auditado |

---

## 9. Dependencias

| Dependencia | Tipo | Justificación |
|---|---|---|
| `apps/api` → `packages/shared` | SDK | Schemas Zod + DTOs |
| `apps/api` módulo `core` | Infra | Auth, RBAC, DB, Auditing, File upload (`multipart`) |
| `apps/api` módulo `academic` | Domain | `AsignacionDocente`, `Matricula`, `Curso`, `Seccion` para vínculo |
| `apps/web` → `packages/shared` | SDK | Tipos + schemas Zod para formularios |
| `apps/web` feature `virtual-classroom` | UI | Listado, formulario, descarga |

**Nueva dependencia aprobada**: `@fastify/multipart` (ya agregada para communication adjuntos)

---

## 10. Preguntas abiertas

| Pregunta | Necesita respuesta de | Estado |
|---|---|---|
| ¿Formato de almacenamiento en producción? (S3, Azure Blob, local) | Dirección / DevOps | abierta (se decide en ADR antes de implementar) |
| ¿Tamaño máximo definitivo? (actual 10 MB por defecto) | Dirección | pendiente (configurable vía `VIRTUAL_MAX_FILE_SIZE`) |
| ¿Habilitar previsualización PDF en UI? | UX/Dirección | cerrada (no en MVP) |
| ¿Soportar carpetas/subdirectorios en UI? | UX/Dirección | cerrada (no en MVP) |
| ¿Notificación a alumnos al subir material? | Dirección | cerrada (no en MVP) |

---

## 11. Trazabilidad

| Requerimiento | Tarea(s) previstas |
|---|---|
| RF-VIR-001 | T001–T004 |
| RF-VIR-002 | T005–T007 |
| RF-VIR-003 | T008–T009 |
| RF-VIR-004 | T010–T012 |
| RN-VIR-001 a RN-VIR-010 | Distribuidas en tasks.md |

---

*Documento listo para revisión. Una vez aprobado, proceder a `plan.md` y `tasks.md`.*