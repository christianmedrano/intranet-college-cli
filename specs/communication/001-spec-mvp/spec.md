# Spec MVP — Módulo de Comunicación

**Versión:** 1.0.0
**Estado:** Borrador
**Fecha:** 2026-11-11
**Módulo:** communication

---

## 1. Resumen

El módulo de comunicación gestiona dos canales:

1. **Anuncios**: mensajes unidireccionales de la institución hacia la comunidad (Director, docentes, apoderados, alumnos). Soportan segmentación por nivel, grado, sección y rol; pueden incluir adjuntos.
2. **Mensajería interna**: canal grupal por sección entre el docente tutor y los apoderados de los alumnos de esa sección. Los alumnos no participan en la mensajería (MVP).

Ambos canales comparten el almacenamiento de adjuntos con el aula virtual (lista blanca de tipos, tamaño configurable).

---

## 2. Actores y permisos (fuente: `docs/rbac-matrix.md` § Comunicación)

| Acción | SA | DI | DO | PA | AL |
|---|---|---|---|---|---|
| Publicar anuncios institucionales | ✔ | ✔ | ✖ | ✖ | ✖ |
| Publicar anuncios de sección | ✖ | ✔ | ⚠¹¹ | ✖ | ✖ |
| Leer anuncios | ✔ | ✔ | ✔ | ⚠¹² | ⚠¹² |
| Enviar mensajes (grupo sección) | ✖ | ⚠¹³ | ⚠¹⁴ | ⚠¹⁴ | ⚠¹⁵ |
| Supervisar mensajes | ⚠⁵ | ⚠¹⁶ | ✖ | ✖ | ✖ |

Notas:
- ¹¹ Solo el docente tutor de la sección (`AsignacionDocente.es_tutor`).
- ¹² Solo anuncios dirigidos a su nivel, grado, sección o rol.
- ¹³ Solo comunicaciones institucionales (Director).
- ¹⁴ Solo entre docentes y apoderados con vínculo académico en la sección.
- ¹⁵ Alumno no participa en mensajería (MVP).
- ¹⁶ Solo ante denuncia o auditoría formal, con registro de acceso.

**Códigos de permiso propuestos** (se incorporan a `packages/shared`):

| Código | SA | DI | DO | PA | AL | Restricción |
|---|---|---|---|---|---|---|
| `communication.anuncios.gestionar` | ✔ | ✔ | ✖ | ✖ | ✖ | DI solo en sus secciones como tutor |
| `communication.anuncios.leer` | ✔ | ✔ | ✔ | ✔ | ✔ | Segmentación por vínculo |
| `communication.mensajeria.gestionar` | ✖ | ✖ | ✔ | ✔ | ✖ | DO tutor + PA vinculados a la sección |
| `communication.mensajeria.supervisar` | ✔ | ✔ | ✖ | ✖ | ✖ | SA soporte; DI denuncia/auditoría |

---

## 3. Requerimientos funcionales

### RF-COM-001 — Publicar anuncio institucional

**Descripción:** El Director o SuperAdmin crea un anuncio visible para una o más audiencias (nivel, grado, sección, rol). Incluye título, cuerpo enriquecido, adjuntos opcionales y fecha de publicación/expiración.

**Criterios de aceptación:**

- **Dado** un Director, **cuando** crea un anuncio con audiencia válida, **entonces** recibe `201` y el anuncio queda publicado.
- **Dado** un anuncio con adjuntos, **cuando** se publica, **entonces** los archivos se almacenan y referencian.
- **Dado** un docente sin rol de Director, **cuando** intenta crear anuncio institucional, **entonces** recibe `403 FORBIDDEN`.
- **Dado** una audiencia vacía, **cuando** se envía, **entonces** recibe `400 VALIDATION_ERROR`.

### RF-COM-002 — Publicar anuncio de sección

**Descripción:** El docente tutor de una sección crea un anuncio dirigido solo a esa sección (apoderados y alumnos de la sección, y docentes asignados).

**Criterios de aceptación:**

- **Dado** un docente tutor de la sección, **cuando** crea un anuncio de sección, **entonces** recibe `201`.
- **Dado** un docente que no es tutor de la sección, **cuando** intenta crear anuncio de sección, **entonces** recibe `403 FORBIDDEN`.
- **Dado** un Director, **cuando** crea anuncio de sección, **entonces** recibe `201` (Director puede actuar en cualquier sección).

### RF-COM-003 — Consultar anuncios

**Descripción:** Cualquier rol consulta los anuncios que le correspondan según su vínculo y la segmentación del anuncio.

**Criterios de aceptación:**

- **Dado** un apoderado, **cuando** lista anuncios, **entonces** ve solo los dirigidos a su rol, nivel/grado/sección de sus alumnos.
- **Dado** un alumno, **cuando** lista anuncios, **entonces** ve los dirigidos a su sección, grado, nivel o rol `ALUMNO`.
- **Dado** un docente, **cuando** lista anuncios, **entonces** ve los institucionales, los de sus secciones y los de sección donde es tutor.
- **Dado** un Director, **cuando** lista anuncios, **entonces** ve todos.
- **Dado** un SuperAdmin, **cuando** lista anuncios, **entonces** ve todos (acceso auditado).

### RF-COM-004 — Mensajería grupal por sección

**Descripción:** Cada sección tiene un hilo de mensajería donde participan el docente tutor y los apoderados de los alumnos matriculados en esa sección. El Director puede acceder para supervisión.

**Criterios de aceptación:**

- **Dado** una sección con tutor asignado, **cuando** un apoderado envía un mensaje, **entonces** queda visible para el tutor y los demás apoderados de la sección.
- **Dado** un apoderado sin alumno en la sección, **cuando** intenta enviar mensaje, **entonces** recibe `403 FORBIDDEN`.
- **Dado** el docente tutor, **cuando** envía mensaje, **entonces** queda visible para todos los apoderados de la sección.
- **Dado** un Director, **cuando** consulta el hilo, **entonces** ve todo el historial (acceso auditado).
- **Dado** un SuperAdmin, **cuando** consulta por denuncia, **entonces** ve el historial (acceso auditado).

### RF-COM-005 — Consultar mensajes de sección

**Descripción:** Los participantes del hilo (tutor + apoderados) consultan el historial paginado. Solo lectura para Director/SuperAdmin.

**Criterios de aceptación:**

- **Dado** un apoderado de la sección, **cuando** lista mensajes, **entonces** recibe paginación con sus mensajes y los del tutor.
- **Dado** el tutor, **cuando** lista mensajes, **entonces** recibe todo el hilo.
- **Dado** un Director, **cuando** lista mensajes de una sección, **entonces** recibe todo el hilo (auditado).
- **Dado** un usuario sin vínculo, **cuando** intenta consultar, **entonces** recibe `403 FORBIDDEN`.

### RF-COM-006 — Adjuntos en anuncios y mensajes

**Descripción:** Tanto anuncios como mensajes pueden incluir archivos. Comparten la configuración de almacenamiento del aula virtual (tipos permitidos, tamaño máximo).

**Criterios de aceptación:**

- **Dado** un anuncio con adjunto PDF válido, **cuando** se publica, **entonces** el archivo se almacena y referencia.
- **Dado** un mensaje con adjunto tipo no permitido, **cuando** se envía, **entonces** recibe `400 VALIDATION_ERROR`.
- **Dado** un adjunto que supera el tamaño máximo, **cuando** se sube, **entonces** recibe `400 VALIDATION_ERROR`.
- **Dado** un adjunto eliminado, **cuando** se borra el anuncio/mensaje, **entonces** el archivo se marca para limpieza (borrado lógico).

---

## 4. Reglas de negocio

| ID | Regla |
|---|---|
| RN-COM-001 | Un anuncio institucional debe tener al menos una audiencia (nivel, grado, sección o rol). |
| RN-COM-002 | Un anuncio de sección se publica automáticamente para la sección completa (no requiere segmentación adicional). |
| RN-COM-003 | Los anuncios tienen estado: `BORRADOR`, `PUBLICADO`, `EXPIRADO`, `ARCHIVADO`. Solo `PUBLICADO` es visible para los destinatarios. |
| RN-COM-004 | La fecha de expiración es opcional; si se pasa, el anuncio pasa a `EXPIRADO` automáticamente. |
| RN-COM-005 | La mensajería por sección se crea automáticamente al matricular el primer alumno con tutor asignado. |
| RN-COM-006 | Solo el docente tutor (`AsignacionDocente.es_tutor = true`) puede iniciar/escribir en el hilo de su sección. |
| RN-COM-007 | Los apoderados solo escriben en hilos de secciones donde tienen alumnos matriculados con matrícula `APROBADA`. |
| RN-COM-008 | Los alumnos **no** participan en la mensajería (MVP). Solo reciben anuncios. |
| RN-COM-009 | Los adjuntos se validan contra la lista blanca y tamaño máximo del aula virtual (configuración institucional). |
| RN-COM-010 | Todo acceso a anuncios y mensajes se audita (lectura y escritura). |
| RN-COM-011 | Un anuncio `ARCHIVADO` no es visible para destinatarios, pero permanece accesible para Director/SuperAdmin. |
| RN-COM-012 | La mensajería no tiene hilos 1:1; es un único hilo grupal por sección. |

---

## 5. Modelo de datos (entidades nuevas)

### Anuncio

| Campo | Tipo | Reglas |
|---|---|---|
| `id` | UUID | PK |
| `institucionId` | UUID | FK → Institucion |
| `autorId` | UUID | FK → Usuario (Director o tutor) |
| `titulo` | string | 1–200 chars |
| `cuerpo` | string | Texto enriquecido (Markdown/HTML seguro), max 10,000 chars |
| `tipo` | enum | `INSTITUCIONAL` \| `SECCION` |
| `estado` | enum | `BORRADOR`, `PUBLICADO`, `EXPIRADO`, `ARCHIVADO` |
| `audienciaNiveles` | UUID[] | Niveles destinatarios (solo institucional) |
| `audienciaGrados` | UUID[] | Grados destinatarios (solo institucional) |
| `audienciaSecciones` | UUID[] | Secciones destinatarias (institucional o sección) |
| `audienciaRoles` | RoleCode[] | Roles destinatarios (solo institucional) |
| `publicadoEn` | datetime | UTC, null si borrador |
| `expiraEn` | datetime | UTC, opcional |
| `createdAt` | datetime | UTC |
| `updatedAt` | datetime | UTC |
| `deletedAt` | datetime | Borrado lógico |

### AdjuntoAnuncio

| Campo | Tipo | Reglas |
|---|---|---|
| `id` | UUID | PK |
| `anuncioId` | UUID | FK → Anuncio |
| `nombreOriginal` | string | Nombre saneado |
| `nombreAlmacenado` | string | Ruta no predecible |
| `tipoMime` | string | Lista blanca |
| `tamanoBytes` | int | ≤ máximo configurado |
| `createdAt` | datetime | UTC |

### HiloMensajeria (uno por sección)

| Campo | Tipo | Reglas |
|---|---|---|
| `id` | UUID | PK |
| `seccionId` | UUID | FK → Seccion (único) |
| `createdAt` | datetime | UTC |
| `updatedAt` | datetime | UTC |

### MensajeSeccion

| Campo | Tipo | Reglas |
|---|---|---|
| `id` | UUID | PK |
| `hiloId` | UUID | FK → HiloMensajeria |
| `autorId` | UUID | FK → Usuario (tutor o apoderado) |
| `cuerpo` | string | Texto enriquecido, max 5,000 chars |
| `createdAt` | datetime | UTC |
| `updatedAt` | datetime | UTC |
| `deletedAt` | datetime | Borrado lógico (solo Director/SuperAdmin) |

### AdjuntoMensaje

| Campo | Tipo | Reglas |
|---|---|---|
| `id` | UUID | PK |
| `mensajeId` | UUID | FK → MensajeSeccion |
| `nombreOriginal` | string | Nombre saneado |
| `nombreAlmacenado` | string | Ruta no predecible |
| `tipoMime` | string | Lista blanca |
| `tamanoBytes` | int | ≤ máximo configurado |
| `createdAt` | datetime | UTC |

---

## 6. Contratos de API (resumen)

```
POST   /api/v1/anuncios                    # Crear anuncio (institucional o sección)
PATCH  /api/v1/anuncios/:id                # Actualizar (solo autor o Director)
DELETE /api/v1/anuncios/:id                # Borrado lógico (archivar)
GET    /api/v1/anuncios                    # Listar con filtros y paginación
GET    /api/v1/anuncios/:id                # Detalle

POST   /api/v1/anuncios/:id/adjuntos       # Subir adjunto a anuncio
DELETE /api/v1/anuncios/adjuntos/:id       # Eliminar adjunto

GET    /api/v1/secciones/:id/mensajes      # Listar mensajes del hilo de sección
POST   /api/v1/secciones/:id/mensajes      # Enviar mensaje al hilo
DELETE /api/v1/mensajes/:id                # Borrado lógico (Director/SuperAdmin)

POST   /api/v1/mensajes/:id/adjuntos       # Subir adjunto a mensaje
DELETE /api/v1/mensajes/adjuntos/:id       # Eliminar adjunto
```

Filtros de anuncios: `tipo`, `estado`, `nivelId`, `gradoId`, `seccionId`, `rol`, `desde`, `hasta`, `page`, `pageSize`.

---

## 7. Auditoría

| Acción | Entidad | Datos auditados |
|---|---|---|
| `CREAR` | Anuncio | `titulo`, `tipo`, `estado`, audiencias |
| `ACTUALIZAR` | Anuncio | campos modificados (incl. `estado`) |
| `ARCHIVAR` | Anuncio | `anuncioId` |
| `LEER` | Anuncio | `anuncioId`, `tipo` (acceso auditado para SuperAdmin) |
| `CREAR` | MensajeSeccion | `hiloId`, `autorId` |
| `LEER` | MensajeSeccion | `hiloId` (acceso auditado para Director/SuperAdmin) |
| `SUBIR_ADJUNTO` | Anuncio/Mensaje | `adjuntoId`, `tipoMime`, `tamanoBytes` |

---

## 8. Pruebas requeridas

| Escenario | Tipo |
|---|---|
| Director crea anuncio institucional con segmentación múltiple | API |
| Docente tutor crea anuncio de sección | API |
| Docente no tutor intenta crear anuncio de sección → 403 | API |
| Apoderado lista anuncios → solo ve los suyos | API |
| Alumno lista anuncios → ve dirigidos a su sección/rol | API |
| SuperAdmin lista anuncios → ve todos (auditado) | API |
| Apoderado envía mensaje en hilo de su sección | API |
| Apoderado sin alumno en sección intenta enviar → 403 | API |
| Tutor envía mensaje → visible para todos los apoderados | API |
| Director consulta hilo → ve todo (auditado) | API |
| Adjunto tipo no permitido → 400 | API |
| Adjunto excede tamaño → 400 | API |
| Anuncio expira → estado `EXPIRADO` | Dominio |
| Borrado lógico de anuncio → `deletedAt` seteado | API |

---

## 9. Trazabilidad RF → Tareas (se completa en `plan.md`)

| RF | Tareas (pendientes) |
|---|---|
| RF-COM-001 | T001–T003 |
| RF-COM-002 | T004–T005 |
| RF-COM-003 | T006–T008 |
| RF-COM-004 | T009–T011 |
| RF-COM-005 | T012–T013 |
| RF-COM-006 | T014–T015 |

---

## 10. Preguntas abiertas / decisiones pendientes

1. **Rich text**: ¿Markdown o HTML sanitizado para cuerpo de anuncios/mensajes?
2. **Notificaciones in-app**: ¿Badge/campana en UI para anuncios nuevos y mensajes? (MVP sin push/email)
3. **Respuesta a mensajes**: ¿Los apoderados responden en el mismo hilo o hay hilos derivados?
4. **Eliminación de mensajes**: ¿Solo Director/SuperAdmin o también autor dentro de ventana de tiempo?
5. **Adjuntos**: ¿Configuración de almacenamiento compartida con aula virtual o independiente?