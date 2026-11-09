# Especificación: Núcleo del Dominio y Autenticación

| Campo | Valor |
|---|---|
| ID | `CORE-001` |
| Módulo | `core` |
| Versión | `1.2.0` |
| Estado | `aprobada` |
| Fecha | 2026-11-05 |

> **Implementación:** alcance planificado completado el 2026-11-08 (T001–T039, incluido RF-CORE-017), más la gestión de usuarios de T043 (RF-CORE-002) y el docente tutor de T044 (RF-CORE-011). La Fase 7 de `tasks.md` conserva la deuda técnica T042.
>
> **Versión 1.2.0 (2026-11-08):** `AsignacionDocente` se amplía con `es_tutor` para identificar al docente tutor de una sección, requerido por `RF-ACAD-006` del módulo académico (decisión autorizada el 2026-11-08).

## 1. Contexto

Todos los módulos del sistema (académico, administrativo, comunicación y aula virtual) necesitan las mismas entidades base: personas, usuarios, roles, estructura escolar, años y períodos académicos, matrículas y asignaciones docentes.

Sin este núcleo, cada módulo definiría `Alumno`, `Curso` o `Sección` a su manera y los datos serían incompatibles. Esta spec es la **única fuente de verdad** para esas entidades.

## 2. Alcance

### Incluye

- Configuración de la institución (una sola por despliegue).
- Personas, usuarios, roles y autenticación.
- Años académicos y períodos configurables.
- Niveles, grados, secciones y cursos.
- Alumnos, docentes y apoderados.
- Matrícula (vínculo alumno–sección–año).
- Asignación docente (docente–curso–sección–año).
- Auditoría de operaciones sensibles.

### No incluye

- Notas, asistencias y horarios → `specs/academic/`.
- Pagos, proceso de matrícula y certificados → `specs/administrative/`.
- Anuncios y mensajería → `specs/communication/`.
- Materiales de aula virtual → `specs/virtual-classroom/`.
- Multi-colegio: un despliegue atiende una sola institución.
- Inicio de sesión con Google o Microsoft (SSO). Se evalúa en una fase posterior.
- Envío real de correos transaccionales (ver Q4).

## 3. Actores y permisos

Roles: `SuperAdmin`, `Director`, `Docente`, `Padre/Apoderado`, `Alumno`.

La matriz normativa está en `docs/rbac-matrix.md`. Los permisos se expresan como cadenas `core.<recurso>.<accion>` y se validan siempre en el backend.

| Permiso | SA | DI | DO | PA | AL |
|---|---|---|---|---|---|
| `core.institucion.editar` | ✔ | ✔ | ✖ | ✖ | ✖ |
| `core.usuarios.gestionar` | ✔ | ⚠ | ✖ | ✖ | ✖ |
| `core.estructura.gestionar` | ✔ | ✔ | ✖ | ✖ | ✖ |
| `core.matriculas.gestionar` | ✔ | ✔ | ✖ | ✖ | ✖ |
| `core.auditoria.leer` | ✔ | ⚠ | ✖ | ✖ | ✖ |
| `core.perfil.leer` | ✔ | ✔ | ✔ | ✔ | ✔ |

## 4. Requerimientos funcionales

### RF-CORE-001 — Configuración de la institución

**Descripción:** El Director o SuperAdmin puede consultar y editar los datos de la institución: nombre, dirección, teléfono, correo y logo.

**Criterios de aceptación:**

- **Dado** un Director autenticado, **cuando** solicita `GET /api/v1/institucion`, **entonces** recibe los datos de la única institución configurada.
- **Dado** un Docente, **cuando** intenta editar la institución, **entonces** recibe `403 FORBIDDEN`.

### RF-CORE-002 — Gestión de usuarios

**Descripción:** El SuperAdmin puede crear, editar, desactivar y listar usuarios. El Director solo puede gestionar usuarios de su institución con rol `Docente`, `Padre/Apoderado` o `Alumno`. Al crear un usuario se genera un PIN temporal y se marca `debe_cambiar_password = true`.

**Criterios de aceptación:**

- **Dado** un SuperAdmin, **cuando** crea un usuario con identificador duplicado, **entonces** recibe `409 CONFLICT`.
- **Dado** un Director, **cuando** intenta crear un `SuperAdmin`, **entonces** recibe `403 FORBIDDEN`.
- **Dado** un usuario recién creado, **cuando** inicia sesión con su PIN temporal, **entonces** el sistema exige cambiarlo antes de acceder a cualquier otro recurso.
- **Dado** un usuario desactivado, **cuando** intenta iniciar sesión, **entonces** recibe `401 UNAUTHORIZED`.

### RF-CORE-003 — Roles y permisos

**Descripción:** Un usuario puede tener uno o más roles. Los permisos efectivos son la unión de los permisos de sus roles activos.

**Criterios de aceptación:**

- **Dado** un usuario con roles `Docente` y `Padre/Apoderado`, **cuando** consulta notas de sus hijos, **entonces** el backend evalúa el vínculo de apoderado y no el rol docente.
- **Dado** un usuario sin rol `core.auditoria.leer`, **cuando** consulta la auditoría, **entonces** recibe `403 FORBIDDEN`.

### RF-CORE-004 — Inicio de sesión

**Descripción:** El usuario se autentica con un **identificador flexible**: nombre de usuario, correo electrónico o número de documento (DNI, carné de extranjería o pasaporte). El sistema devuelve un token de acceso de corta duración y establece un refresh token en cookie `httpOnly`.

**Criterios de aceptación:**

- **Dado** un identificador válido (usuario, correo o documento) y contraseña correcta, **cuando** se autentica, **entonces** recibe `200` con `accessToken` y el refresh queda en cookie `httpOnly`.
- **Dado** un identificador válido, **cuando** se autentica con contraseña incorrecta, **entonces** recibe `401` sin revelar cuál dato falló.
- **Dado** un identificador que coincide con más de un usuario, **cuando** se autentica, **entonces** recibe `409 CONFLICT` y se solicita un identificador más específico.
- **Dado** cinco intentos fallidos en 15 minutos, **cuando** intenta de nuevo, **entonces** recibe `429 RATE_LIMITED`.

### RF-CORE-005 — Sesión y perfil

**Descripción:** El usuario autenticado puede consultar su perfil y sus roles.

**Criterios de aceptación:**

- **Dado** un token válido, **cuando** solicita `GET /api/v1/me`, **entonces** recibe persona, roles y permisos efectivos.
- **Dado** un token expirado, **cuando** solicita `GET /api/v1/me`, **entonces** recibe `401`.

### RF-CORE-006 — Renovación y cierre de sesión

**Descripción:** El refresh token permite obtener un nuevo token de acceso y puede revocarse al cerrar sesión.

**Criterios de aceptación:**

- **Dado** un refresh válido, **cuando** solicita renovación, **entonces** recibe un nuevo `accessToken` y el refresh rota.
- **Dado** un refresh revocado, **cuando** intenta renovar, **entonces** recibe `401`.

### RF-CORE-007 — Recuperación de contraseña

**Descripción:** El usuario puede solicitar un restablecimiento. El token es de un solo uso y expira en 30 minutos.

**Criterios de aceptación:**

- **Dado** un correo registrado, **cuando** solicita recuperación, **entonces** se genera un token y la respuesta es siempre `202` (no revela si el correo existe).
- **Dado** un correo no registrado, **cuando** solicita recuperación, **entonces** la respuesta también es `202` y no se genera ningún token.
- **Dado** un administrador con `core.usuarios.gestionar`, **cuando** solicita el token de recuperación de un usuario vigente, **entonces** recibe el token en claro una única vez y cualquier token anterior sin usar queda invalidado.
- **Dado** un token usado o expirado, **cuando** intenta restablecer, **entonces** recibe `400 VALIDATION_ERROR`.
- **Dado** un restablecimiento exitoso, **cuando** el usuario tenía sesiones activas, **entonces** todas sus sesiones se revocan y debe iniciar sesión de nuevo.

### RF-CORE-008 — Año académico

**Descripción:** El Director configura los años académicos. Solo puede existir un año en estado `ACTIVO` a la vez.

**Criterios de aceptación:**

- **Dado** un año activo, **cuando** se activa otro, **entonces** el anterior pasa a `CERRADO` en la misma transacción.
- **Dado** un año con períodos con calificaciones, **cuando** se intenta eliminar, **entonces** se bloquea con borrado lógico.

### RF-CORE-009 — Períodos académicos configurables

**Descripción:** Cada año académico define N períodos con nombre, orden, fechas y estado. El sistema no asume 4 bimestres ni 3 trimestres.

**Criterios de aceptación:**

- **Dado** un año con 4 períodos bimestrales, **cuando** se consultan, **entonces** se listan ordenados del 1 al 4.
- **Dado** un año con 3 períodos trimestrales, **cuando** se consultan, **entonces** se listan ordenados del 1 al 3.
- **Dado** un período `CERRADO`, **cuando** se intenta editar una calificación, **entonces** el módulo académico debe rechazar la operación (regla compartida).
- **Dado** un período con calificaciones, **cuando** se intenta eliminar, **entonces** se bloquea.

### RF-CORE-010 — Niveles, grados y secciones

**Descripción:** La estructura escolar se organiza en niveles (Inicial, Primaria, Secundaria), grados y secciones por año académico.

**Criterios de aceptación:**

- **Dado** un nivel `Primaria`, **cuando** se crea un grado, **entonces** queda asociado al nivel.
- **Dado** un grado y año, **cuando** se crea una sección con nombre duplicado, **entonces** recibe `409 CONFLICT`.

### RF-CORE-011 — Cursos

**Descripción:** Los cursos pertenecen a un nivel y se dictan en una o más secciones mediante asignaciones docentes.

**Criterios de aceptación:**

- **Dado** un curso y una sección, **cuando** se asigna un docente, **entonces** se crea la asignación para el año.
- **Dado** un curso y una sección, **cuando** se marca una asignación como tutor, **entonces** queda como máximo un tutor vigente por sección y año.
- **Dado** un docente sin asignación, **cuando** intenta registrar notas de esa sección, **entonces** recibe `403 FORBIDDEN`.

### RF-CORE-012 — Alumnos

**Descripción:** El alumno representa a la persona matriculable, independientemente de si tiene cuenta de acceso.

**Criterios de aceptación:**

- **Dado** un alumno sin usuario, **cuando** se consulta su ficha, **entonces** se muestran sus datos personales y su matrícula.
- **Dado** un alumno con documento duplicado, **cuando** se registra, **entonces** recibe `409 CONFLICT`.

### RF-CORE-013 — Docentes

**Descripción:** El docente se registra con código, especialidad y datos personales.

**Criterios de aceptación:**

- **Dado** un docente sin usuario, **cuando** se consulta, **entonces** se muestra su ficha sin credenciales.
- **Dado** un docente con código duplicado, **cuando** se registra, **entonces** recibe `409 CONFLICT`.

### RF-CORE-014 — Apoderados y vínculos

**Descripción:** Un apoderado puede estar vinculado a uno o más alumnos. Un alumno puede tener uno o más apoderados, con exactamente uno marcado como principal.

**Criterios de aceptación:**

- **Dado** un alumno sin apoderado principal, **cuando** se intenta aprobar su matrícula, **entonces** se bloquea la operación.
- **Dado** un apoderado con dos alumnos, **cuando** consulta sus alumnos, **entonces** ve ambos.
- **Dado** un apoderado que intenta ver un alumno ajeno, **cuando** solicita sus datos, **entonces** recibe `403 FORBIDDEN`.

### RF-CORE-015 — Matrícula

**Descripción:** La matrícula vincula un alumno con una sección y un año académico. Es única por alumno y año.

**Criterios de aceptación:**

- **Dado** un alumno matriculado en un año, **cuando** se intenta matricular de nuevo, **entonces** recibe `409 CONFLICT`.
- **Dado** una matrícula aprobada, **cuando** se consulta, **entonces** incluye año, nivel, grado y sección.
- **Dado** una matrícula retirada, **cuando** se consulta el historial, **entonces** se conserva con su estado y auditoría.

### RF-CORE-016 — Auditoría

**Descripción:** Toda operación sobre usuarios, matrículas, calificaciones, pagos y datos personales registra usuario, acción, entidad, fecha e IP.

**Criterios de aceptación:**

- **Dado** un cambio de rol, **cuando** se ejecuta, **entonces** se crea un registro de auditoría inmutable.
- **Dado** un registro de auditoría, **cuando** se intenta editar o eliminar, **entonces** el sistema lo impide.

### RF-CORE-017 — Cambio obligatorio de contraseña

**Descripción:** Todo usuario con `debe_cambiar_password = true` debe establecer una contraseña definitiva antes de usar el sistema. La contraseña debe cumplir la política mínima.

**Criterios de aceptación:**

- **Dado** un usuario con PIN temporal, **cuando** inicia sesión, **entonces** solo puede acceder a `POST /auth/change-password`.
- **Dado** una contraseña de menos de 10 caracteres o igual al identificador, **cuando** intenta cambiarla, **entonces** recibe `400 VALIDATION_ERROR`.
- **Dado** un cambio exitoso, **cuando** se completa, **entonces** `debe_cambiar_password` pasa a `false` y se revocan las sesiones previas.

## 5. Reglas de negocio

- `RN-CORE-001`: Una sola institución por despliegue.
- `RN-CORE-002`: Solo puede existir un año académico en estado `ACTIVO`.
- `RN-CORE-003`: La cantidad de períodos es configurable; prohibido asumir 3 o 4.
- `RN-CORE-004`: Un período `CERRADO` bloquea la edición de calificaciones; la reapertura exige permiso y auditoría.
- `RN-CORE-005`: La matrícula es única por alumno y año académico.
- `RN-CORE-006`: Un usuario inactivo no puede autenticarse ni renovar sesión.
- `RN-CORE-007`: `username` y `email` son únicos cuando están presentes.
- `RN-CORE-008`: Todo alumno matriculado debe tener exactamente un apoderado principal.
- `RN-CORE-009`: Prohibido el borrado físico de usuarios, alumnos, matrículas y auditoría.
- `RN-CORE-010`: Un usuario puede tener múltiples roles; los permisos se unen.
- `RN-CORE-011`: El docente solo accede a cursos y secciones asignados.
- `RN-CORE-012`: La auditoría es de solo inserción.
- `RN-CORE-013`: Las contraseñas y hashes nunca se devuelven en respuestas ni se registran en logs.
- `RN-CORE-014`: Toda entidad usa UUID, auditoría de creación/modificación y borrado lógico cuando aplica.
- `RN-CORE-015`: El login acepta un identificador flexible (usuario, correo o documento). Si hay ambigüedad, se rechaza la autenticación.
- `RN-CORE-016`: La contraseña inicial es un PIN temporal generado por el sistema, nunca el DNI ni la fecha de nacimiento. El primer acceso obliga a cambiarla.
- `RN-CORE-017`: La contraseña debe tener al menos 10 caracteres y no puede ser igual al identificador ni al documento.
- `RN-CORE-018`: El SSO con Google o Microsoft no forma parte del MVP.

## 6. Modelo de datos

### Entidades

| Entidad | Campos principales | Restricciones |
|---|---|---|
| `Institucion` | id, nombre, direccion, telefono, email, logo_url | Registro único |
| `Persona` | id, nombres, apellidos, tipo_documento, numero_documento, fecha_nacimiento, telefono, email_contacto, direccion | Único (tipo_documento, numero_documento) |
| `Usuario` | id, persona_id, username, email, password_hash, debe_cambiar_password, activo, ultimo_acceso | Único username si existe; email único si existe |
| `Rol` | id, codigo, nombre, descripcion | Único codigo |
| `UsuarioRol` | usuario_id, rol_id | PK compuesta |
| `SesionRefresh` | id, usuario_id, token_hash, expira_en, revocado_en, ip, user_agent | Índice por usuario_id |
| `TokenRecuperacion` | id, usuario_id, token_hash, expira_en, usado_en | Único token_hash |
| `Alumno` | id, persona_id, codigo_alumno, fecha_ingreso, observaciones | Único persona_id y codigo_alumno |
| `Docente` | id, persona_id, codigo_docente, especialidad | Único persona_id y codigo_docente |
| `Apoderado` | id, persona_id, ocupacion | Único persona_id |
| `ApoderadoAlumno` | apoderado_id, alumno_id, parentesco, es_principal | Único (apoderado_id, alumno_id) |
| `AnioAcademico` | id, institucion_id, nombre, fecha_inicio, fecha_fin, estado | Único (institucion_id, nombre) |
| `PeriodoAcademico` | id, anio_id, nombre, orden, fecha_inicio, fecha_fin, estado | Único (anio_id, orden) y (anio_id, nombre) |
| `Nivel` | id, institucion_id, nombre, orden | Único (institucion_id, nombre) |
| `Grado` | id, nivel_id, nombre, orden | Único (nivel_id, orden) |
| `Seccion` | id, grado_id, anio_id, nombre, capacidad | Único (grado_id, anio_id, nombre) |
| `Curso` | id, nivel_id, nombre, area, orden | Único (nivel_id, nombre) |
| `Matricula` | id, alumno_id, seccion_id, anio_id, estado, fecha_matricula | Único (alumno_id, anio_id) |
| `AsignacionDocente` | id, docente_id, curso_id, seccion_id, anio_id, es_tutor | Único (docente_id, curso_id, seccion_id, anio_id); máximo un tutor vigente por sección y año |
| `Auditoria` | id, usuario_id, accion, entidad, entidad_id, datos, ip, user_agent, created_at | Solo inserción |

### Estados

- `AnioAcademico.estado`: `PLANIFICADO` | `ACTIVO` | `CERRADO`
- `PeriodoAcademico.estado`: `PLANIFICADO` | `ACTIVO` | `CERRADO`
- `Matricula.estado`: `SOLICITADA` | `APROBADA` | `RETIRADA`
- `Rol.codigo`: `SUPER_ADMIN` | `DIRECTOR` | `DOCENTE` | `APODERADO` | `ALUMNO`

### Relaciones clave

```text
Institucion 1─N AnioAcademico 1─N PeriodoAcademico
Institucion 1─N Nivel 1─N Grado 1─N Seccion
Nivel       1─N Curso
Persona     1─1 Usuario
Usuario     1─N SesionRefresh
Usuario     1─N TokenRecuperacion
Persona     1─0..1 Alumno
Persona     1─0..1 Docente
Persona     1─0..1 Apoderado
Apoderado   N─M Alumno  (ApoderadoAlumno)
Alumno      1─N Matricula N─1 Seccion
Docente     N─M Curso/Seccion (AsignacionDocente)
```

## 7. Contratos de API

Prefijo `/api/v1`. Errores con el sobre estándar de `docs/architecture.md`.

### Autenticación

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| `POST` | `/auth/login` | público | Autentica con `username` o email |
| `POST` | `/auth/refresh` | cookie | Renueva el token de acceso |
| `POST` | `/auth/logout` | autenticado | Revoca el refresh |
| `POST` | `/auth/forgot-password` | público | Solicita restablecimiento |
| `POST` | `/auth/reset-password` | público | Restablece con token |
| `POST` | `/auth/change-password` | autenticado | Cambio obligatorio o voluntario |
| `GET` | `/me` | autenticado | Perfil y permisos |

### Estructura y personas

| Método | Ruta | Permiso |
|---|---|---|
| `GET` / `PATCH` | `/institucion` | `core.institucion.editar` |
| `GET` / `POST` / `PATCH` | `/usuarios` | `core.usuarios.gestionar` |
| `POST` | `/usuarios/:id/token-recuperacion` | `core.usuarios.gestionar` |
| `GET` / `POST` / `PATCH` | `/anios-academicos` | `core.estructura.gestionar` |
| `POST` | `/anios-academicos/:id/activar` | `core.estructura.gestionar` |
| `GET` / `POST` / `PATCH` | `/anios-academicos/:id/periodos` | `core.estructura.gestionar` |
| `POST` | `/periodos/:id/cerrar` | `core.estructura.gestionar` |
| `GET` / `POST` / `PATCH` | `/niveles` | `core.estructura.gestionar` |
| `GET` / `POST` / `PATCH` | `/grados` | `core.estructura.gestionar` |
| `GET` / `POST` / `PATCH` | `/secciones` | `core.estructura.gestionar` |
| `GET` / `POST` / `PATCH` | `/cursos` | `core.estructura.gestionar` |
| `GET` / `POST` / `PATCH` | `/alumnos` | `core.usuarios.gestionar` |
| `GET` / `POST` / `PATCH` | `/docentes` | `core.usuarios.gestionar` |
| `GET` / `POST` / `PATCH` | `/apoderados` | `core.usuarios.gestionar` |
| `POST` | `/apoderados/:id/alumnos` | `core.usuarios.gestionar` |
| `GET` / `POST` / `PATCH` | `/matriculas` | `core.matriculas.gestionar` |
| `GET` / `POST` / `PATCH` | `/asignaciones-docente` | `core.estructura.gestionar` |
| `GET` | `/auditoria` | `core.auditoria.leer` |

## 8. Casos borde y errores

| Caso | Comportamiento |
|---|---|
| Activar un año mientras otro está activo | Transacción: cerrar el anterior y activar el nuevo |
| Período con calificaciones | No se elimina; se cierra |
| Alumno sin apoderado principal | Se bloquea la aprobación de matrícula |
| Usuario desactivado con sesión activa | El refresh se rechaza en la siguiente renovación |
| Documento duplicado | `409 CONFLICT` con mensaje genérico |
| Apoderado consulta alumno ajeno | `403 FORBIDDEN` |
| Token de recuperación reutilizado | `400 VALIDATION_ERROR` |
| Solicitud de recuperación con correo inexistente | `202`, sin generar token |
| Administrador emite un token nuevo | El anterior sin usar queda invalidado |
| Borrado de auditoría | `405` o `403`; la entidad no expone DELETE |

## 9. Dependencias

- **Depende de:** nada (es el módulo raíz).
- **Dependen de este módulo:** académico, administrativo, comunicación y aula virtual.
- **Dependencias técnicas:** Prisma, MySQL 8, `argon2`, `jose`, Zod (todas en `docs/stack.md`).

## 10. Preguntas abiertas

| ID | Pregunta | Decisión | Estado |
|---|---|---|---|
| Q1 | ¿Identificador de acceso? | Login multicampo: usuario, correo o número de documento | resuelta |
| Q2 | ¿Roles múltiples por usuario? | Sí, los permisos se unen | resuelta |
| Q3 | ¿Cuentas de alumnos? | Todos los niveles, con acceso según rol y vínculo | resuelta |
| Q4 | ¿Envío real de correo para recuperación? | No en el MVP: token entregado por administración mediante `POST /usuarios/:id/token-recuperacion` | resuelta |
| Q5 | ¿Un apoderado principal por alumno? | Sí, exactamente uno | resuelta |
| Q6 | ¿Un solo año académico activo? | Sí | resuelta |
| Q7 | ¿Contraseña inicial? | PIN temporal generado por el sistema + cambio obligatorio | resuelta |
| Q8 | ¿SSO con Google o Microsoft en el MVP? | No, fuera de alcance | resuelta |

> Spec aprobada el 2026-11-05 con las decisiones Q1–Q8.
> Versión `1.1.0` (2026-11-05): se documenta la entrega del token de recuperación mediante `POST /usuarios/:id/token-recuperacion` (Q4).

## 11. Trazabilidad

| Requerimiento | Tareas |
|---|---|
| RF-CORE-001 | T020 |
| RF-CORE-002 | T009, T010 |
| RF-CORE-003 | T017, T018 |
| RF-CORE-004 | T011, T015 |
| RF-CORE-005 | T012 |
| RF-CORE-006 | T013 |
| RF-CORE-007 | T014 |
| RF-CORE-008 | T021 |
| RF-CORE-009 | T022, T028 |
| RF-CORE-010 | T023 |
| RF-CORE-011 | T024, T027, T044 |
| RF-CORE-012 | T025 |
| RF-CORE-013 | T025 |
| RF-CORE-014 | T025 |
| RF-CORE-015 | T026 |
| RF-CORE-016 | T029, T030, T031 |
| RF-CORE-017 | T039 |
