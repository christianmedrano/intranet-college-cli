# Especificación: Gestión Académica (Calificaciones, Asistencias y Horarios)

| Campo | Valor |
|---|---|
| ID | `ACAD-001` |
| Módulo | `academic` |
| Versión | `1.0.0` |
| Estado | `aprobada` |
| Autor | Equipo de arquitectura |
| Fecha | 2026-11-08 |

## 1. Contexto

El módulo `core` entrega las entidades raíz —alumnos, docentes, secciones, cursos, años y períodos— y la matrícula que vincula a un alumno con una sección y un año. Sobre esa base, el módulo académico resuelve el registro y la consulta de **calificaciones**, **asistencias** y **horarios**, que son las operaciones diarias de docentes, dirección, apoderados y alumnos.

Sin este módulo no existe acta, libreta ni seguimiento de inasistencias, y la deuda técnica `T042` de `core` (bloqueo del borrado de un año con calificaciones) no puede resolverse porque nadie sabe aún si un período tiene notas.

La escala es literal **AD / A / B / C** en Inicial, Primaria y Secundaria. El módulo **no** calcula equivalencias numéricas ni fórmulas de nota final: la constitución §4.3 prohíbe la escala 0–20 y toda conversión.

## 2. Alcance

### Incluye

- Registro y edición de una calificación literal por alumno, curso y período.
- Registro manual de la nota final de cada período por alumno y curso.
- Consulta de calificaciones y notas finales según el vínculo del solicitante.
- Registro diario de asistencia por alumno, con estados `PRESENTE`, `TARDE`, `FALTA_JUSTIFICADA` y `FALTA_INJUSTIFICADA`.
- Corrección auditada de asistencias.
- Solicitud de justificación de falta por el apoderado y aprobación o rechazo por el docente tutor o el Director.
- Configuración del umbral de inasistencias por año académico, sin valor por defecto.
- Generación y consulta de alertas de inasistencias.
- Gestión y consulta de horarios semanales por sección.
- Exposición de si un período tiene calificaciones, para desbloquear `T042` de `core`.
- Auditoría de accesos y cambios sobre calificaciones, notas finales, asistencias y horarios.

### No incluye

- Escala numérica 0–20, tablas de conversión o equivalencias literal-numéricas.
- Cálculo automático de la nota final o de promedios.
- Notas por competencia o por capacidad: el MVP califica por curso.
- Actas, libretas o certificados en PDF (módulo administrativo).
- Notificaciones push o correo transaccional (fuera del MVP, constitución §0).
- Registro de asistencia por curso o por hora: la asistencia es diaria por alumno.
- Videoconferencia o aula virtual.
- Borrado físico de calificaciones, notas finales o asistencias.

## 3. Actores y permisos

La matriz `docs/rbac-matrix.md` es normativa y se aplica como máximo. Este módulo **restringe** por vínculo, nunca amplía.

| Actor | Puede hacer | No puede hacer |
|---|---|---|
| SuperAdmin | Consultar calificaciones y horarios en modo soporte, con acceso auditado | Registrar o editar calificaciones, asistencias o justificaciones; configurar el umbral |
| Director | Registrar y corregir asistencia; aprobar o rechazar justificaciones; corregir calificaciones y notas finales **solo después del cierre del período y con motivo**; gestionar horarios; configurar el umbral | Registrar calificaciones durante el período abierto (lo hace el docente) |
| Docente | Registrar y editar calificaciones y nota final de sus cursos y secciones asignados; registrar asistencia en sus secciones; justificar faltas cuando su asignación en la sección esté marcada como tutor (`es_tutor`); consultar horarios | Ver cursos o secciones ajenos; corregir notas de un período cerrado |
| Padre/Apoderado | Consultar calificaciones, notas finales, asistencia, alertas y horarios de sus alumnos vinculados; solicitar justificación de una falta | Registrar o modificar notas o asistencias; aprobar justificaciones |
| Alumno | Consultar sus propias calificaciones, notas finales, asistencia, alertas y horarios | Modificar cualquier registro académico |

Códigos de permiso propuestos (se incorporan al catálogo de `packages/shared`):

| Código | SA | DI | DO | PA | AL |
|---|---|---|---|---|---|
| `academic.calificaciones.gestionar` | ✖ | ✖ | ✔ con vínculo | ✖ | ✖ |
| `academic.calificaciones.corregir` | ✖ | ✔ tras cierre, con motivo | ✖ | ✖ | ✖ |
| `academic.calificaciones.leer` | ✔ auditado | ✔ | ✔ con vínculo | ✔ con vínculo | ✔ propio |
| `academic.asistencias.gestionar` | ✖ | ✔ | ✔ con vínculo | ✖ | ✖ |
| `academic.asistencias.leer` | ✖ | ✔ | ✔ con vínculo | ✔ con vínculo | ✔ propio |
| `academic.asistencias.solicitar` | ✖ | ✖ | ✖ | ✔ con vínculo | ✖ |
| `academic.asistencias.justificar` | ✖ | ✔ | ✔ como tutor | ✖ | ✖ |
| `academic.horarios.gestionar` | ✔ | ✔ | ✖ | ✖ | ✖ |
| `academic.horarios.leer` | ✔ | ✔ | ✔ con vínculo | ✔ con vínculo | ✔ propio |

La configuración del umbral **reutiliza** `core.estructura.gestionar` (SuperAdmin y Director) para no ampliar la matriz con una acción inexistente.

> **Prerrequisito de gobernanza:** incorporar los nueve códigos `academic.*` a `docs/rbac-matrix.md` y a la constitución requiere autorización humana explícita antes de implementar. Esta spec solo los propone; no modifica los documentos normativos.

## 4. Requerimientos funcionales

### RF-ACAD-001 — Registrar y editar calificaciones

**Descripción:** Un docente registra una calificación literal (`AD`, `A`, `B` o `C`) para un alumno, curso y período de sus asignaciones vigentes. Mientras el período no esté `CERRADO`, puede editar el valor y la observación. Un Director solo puede corregir después del cierre, con motivo obligatorio.

**Criterios de aceptación:**

- **Dado** un docente con asignación en un curso y sección, **cuando** registra una calificación válida, **entonces** recibe `201` y la calificación queda auditada.
- **Dado** un docente sin asignación sobre el curso o la sección, **cuando** intenta registrar, **entonces** recibe `403 FORBIDDEN`.
- **Dado** un período `CERRADO`, **cuando** un docente intenta editar, **entonces** recibe `409 CONFLICT`.
- **Dado** un período `CERRADO`, **cuando** el Director corrige con motivo, **entonces** se actualiza, se audita con autor, fecha y motivo.
- **Dado** un valor distinto de `AD`, `A`, `B` o `C`, **cuando** se envía, **entonces** recibe `400 VALIDATION_ERROR`.

### RF-ACAD-002 — Registrar la nota final del período

**Descripción:** El docente registra manualmente la nota final del período por alumno y curso. No hay cálculo automático, promedio ni equivalencia numérica. La nota final es independiente de que existan o no calificaciones parciales.

**Criterios de aceptación:**

- **Dado** un docente asignado, **cuando** registra una nota final válida, **entonces** recibe `201` y queda auditada.
- **Dado** un período `CERRADO`, **cuando** un docente intenta modificarla, **entonces** recibe `409 CONFLICT`; el Director puede corregirla con motivo.
- **Dado** un curso con tres calificaciones parciales, **cuando** se consulta la nota final, **entonces** se devuelve exactamente el valor manual registrado, sin cálculo.

### RF-ACAD-003 — Consultar calificaciones y notas finales

**Descripción:** La consulta respeta el vínculo del solicitante. El Director ve todo; el docente, sus cursos y secciones; el apoderado, a sus alumnos; el alumno, solo lo propio; el SuperAdmin, en modo soporte auditado.

**Criterios de aceptación:**

- **Dado** un apoderado con dos alumnos, **cuando** consulta calificaciones, **entonces** ve las de ambos y ninguna de un tercero.
- **Dado** un alumno, **cuando** consulta calificaciones ajenas, **entonces** recibe `403 FORBIDDEN`.
- **Dado** un docente, **cuando** consulta un curso no asignado, **entonces** recibe `403 FORBIDDEN`.
- **Dado** un acceso del SuperAdmin, **cuando** consulta, **entonces** se registra en auditoría.

### RF-ACAD-004 — Registrar asistencia diaria

**Descripción:** El Director o el docente registra la asistencia diaria de los alumnos de una sección. Cada alumno tiene como máximo un registro por fecha. El estado es `PRESENTE`, `TARDE`, `FALTA_JUSTIFICADA` o `FALTA_INJUSTIFICADA`.

**Criterios de aceptación:**

- **Dado** un docente asignado a la sección, **cuando** registra la asistencia de una fecha válida, **entonces** recibe `201` por cada alumno y los registros quedan auditados.
- **Dado** un alumno con matrícula `APROBADA` en el año, **cuando** se registra su asistencia, **entonces** se acepta; si no está matriculado, **entonces** recibe `409 CONFLICT`.
- **Dado** un registro ya existente para el alumno y la fecha, **cuando** se intenta crear otro, **entonces** recibe `409 CONFLICT`.
- **Dado** una fecha futura o fuera del rango del año académico, **cuando** se envía, **entonces** recibe `400 VALIDATION_ERROR`.

### RF-ACAD-005 — Corregir asistencia con trazabilidad

**Descripción:** El Director o el docente asignado corrige el estado u observación de una asistencia. Toda corrección exige motivo y queda auditada con autor y fecha (constitución §4.2).

**Criterios de aceptación:**

- **Dado** un registro de asistencia, **cuando** se corrige con motivo, **entonces** se actualiza y se audita con el valor anterior y el nuevo.
- **Dado** una corrección sin motivo, **cuando** se envía, **entonces** recibe `400 VALIDATION_ERROR`.
- **Dado** un docente sin asignación en la sección, **cuando** intenta corregir, **entonces** recibe `403 FORBIDDEN`.

### RF-ACAD-006 — Justificar faltas

**Descripción:** El apoderado solicita la justificación de una falta de un alumno vinculado. El docente tutor de la sección —aquel cuya `AsignacionDocente` tiene `es_tutor = true`— o el Director aprueba o rechaza. La aprobación cambia el estado de la asistencia de `FALTA_INJUSTIFICADA` a `FALTA_JUSTIFICADA`.

**Criterios de aceptación:**

- **Dado** un apoderado vinculado, **cuando** solicita justificar una falta injustificada de su alumno, **entonces** la solicitud queda en estado `SOLICITADA`.
- **Dado** un apoderado ajeno, **cuando** intenta solicitar, **entonces** recibe `403 FORBIDDEN`.
- **Dado** un docente con `es_tutor = true` en la sección, **cuando** aprueba la solicitud, **entonces** la asistencia pasa a `FALTA_JUSTIFICADA` y la acción se audita.
- **Dado** un docente asignado a la sección pero sin `es_tutor`, **cuando** intenta aprobar, **entonces** recibe `403 FORBIDDEN`.
- **Dado** una solicitud ya resuelta, **cuando** se intenta resolver de nuevo, **entonces** recibe `409 CONFLICT`.

### RF-ACAD-007 — Consultar asistencia y justificaciones

**Descripción:** La consulta de asistencia y justificaciones respeta los mismos vínculos que las calificaciones.

**Criterios de aceptación:**

- **Dado** un apoderado, **cuando** consulta la asistencia de su alumno, **entonces** ve solo ese alumno.
- **Dado** un alumno, **cuando** consulta su asistencia, **entonces** ve solo la propia.
- **Dado** un docente, **cuando** consulta una sección no asignada, **entonces** recibe `403 FORBIDDEN`.

### RF-ACAD-008 — Configurar el umbral de inasistencias

**Descripción:** El Director configura, por año académico, la cantidad de faltas injustificadas que dispara una alerta. No existe valor por defecto: si el umbral no está configurado, no se genera ninguna alerta.

**Criterios de aceptación:**

- **Dado** un año sin umbral, **cuando** se consulta, **entonces** se devuelve `null` y no se generan alertas.
- **Dado** un Director, **cuando** establece un umbral entero positivo, **entonces** se guarda y se audita.
- **Dado** un valor `0` o negativo, **cuando** se envía, **entonces** recibe `400 VALIDATION_ERROR`.
- **Dado** un docente o apoderado, **cuando** intenta configurar el umbral, **entonces** recibe `403 FORBIDDEN`.

### RF-ACAD-009 — Generar y consultar alertas de inasistencias

**Descripción:** Cuando un alumno acumula faltas injustificadas iguales o superiores al umbral configurado, el sistema registra una alerta consultable por Dirección, el apoderado y el alumno. No hay notificación push ni correo en el MVP.

**Criterios de aceptación:**

- **Dado** un umbral de 3 y un alumno con 3 faltas injustificadas, **cuando** se registra la tercera falta, **entonces** existe una alerta para ese alumno y año.
- **Dado** un umbral de 3 y un alumno con 2 faltas, **cuando** se consulta, **entonces** no hay alerta.
- **Dado** un año sin umbral, **cuando** se registran faltas, **entonces** no se crea ninguna alerta.
- **Dado** que el Director eleva el umbral por encima de las faltas acumuladas, **cuando** se guarda el cambio, **entonces** la alerta deja de existir.
- **Dado** un apoderado, **cuando** consulta alertas, **entonces** ve solo las de sus alumnos vinculados.

### RF-ACAD-010 — Gestionar horarios

**Descripción:** El Director o el SuperAdmin crea, edita y elimina lógicamente bloques semanales de horario por sección y año: día, hora de inicio, hora de fin, curso y docente opcional.

**Criterios de aceptación:**

- **Dado** un bloque válido, **cuando** se crea, **entonces** recibe `201` y queda auditado.
- **Dado** dos bloques de la misma sección que se solapan, **cuando** se intenta el segundo, **entonces** recibe `409 CONFLICT`.
- **Dado** un docente con dos bloques solapados en secciones distintas, **cuando** se intenta el segundo, **entonces** recibe `409 CONFLICT`.
- **Dado** un curso que no pertenece al nivel de la sección, **cuando** se envía, **entonces** recibe `400 VALIDATION_ERROR`.
- **Dado** un docente sin asignación en ese curso y sección, **cuando** se le asigna el bloque, **entonces** recibe `400 VALIDATION_ERROR`.
- **Dado** un horario existente, **cuando** se elimina, **entonces** se marca `deleted_at` y se conserva para auditoría.

### RF-ACAD-011 — Consultar horarios

**Descripción:** La consulta de horarios respeta el vínculo del solicitante.

**Criterios de aceptación:**

- **Dado** un alumno, **cuando** consulta horarios, **entonces** ve solo el de su sección.
- **Dado** un apoderado, **cuando** consulta horarios, **entonces** ve los de sus alumnos vinculados.
- **Dado** un docente, **cuando** consulta horarios, **entonces** ve los de sus cursos y secciones asignados.

### RF-ACAD-012 — Exponer si un período tiene calificaciones

**Descripción:** El módulo expone un resumen que indica si un período tiene calificaciones o notas finales. `core` lo consume para bloquear el borrado lógico de un año (`T042`).

**Criterios de aceptación:**

- **Dado** un período sin calificaciones ni notas finales, **cuando** se consulta el resumen, **entonces** `tieneCalificaciones` es `false`.
- **Dado** un período con al menos una calificación o nota final, **cuando** se consulta el resumen, **entonces** `tieneCalificaciones` es `true`.
- **Dado** un usuario sin permiso de lectura de calificaciones, **cuando** consulta el resumen, **entonces** recibe `403 FORBIDDEN`.

### RF-ACAD-013 — Auditar accesos y cambios

**Descripción:** Todo acceso o modificación de calificaciones, notas finales, asistencias y horarios se registra con usuario, fecha, recurso, acción e IP. La auditoría es de solo inserción.

**Criterios de aceptación:**

- **Dado** un cambio de calificación, **cuando** se ejecuta, **entonces** se registra la acción con el valor anterior y el nuevo.
- **Dado** un acceso del SuperAdmin a calificaciones, **cuando** se ejecuta, **entonces** se registra el acceso.
- **Dado** un intento de editar o eliminar auditoría, **cuando** se ejecuta, **entonces** el sistema lo impide.

## 5. Reglas de negocio

- `RN-ACAD-001`: La única escala válida es literal `AD`, `A`, `B` o `C`, en todos los niveles. Prohibido almacenar o calcular valores numéricos.
- `RN-ACAD-002`: Existe como máximo una calificación por alumno, curso y período.
- `RN-ACAD-003`: Existe como máximo una nota final por alumno, curso y período.
- `RN-ACAD-004`: La nota final es un valor manual del docente. No se calcula, promedia ni deriva de las calificaciones parciales.
- `RN-ACAD-005`: Un período `CERRADO` bloquea la edición de calificaciones y notas finales por parte del docente.
- `RN-ACAD-006`: Después del cierre, solo el Director corrige calificaciones o notas finales, con motivo obligatorio y auditoría.
- `RN-ACAD-007`: El docente solo opera sobre cursos y secciones con `AsignacionDocente` vigente en el año.
- `RN-ACAD-008`: Solo se califica o registra asistencia a alumnos con matrícula `APROBADA` en el año correspondiente.
- `RN-ACAD-009`: La asistencia es diaria y única por alumno y fecha.
- `RN-ACAD-010`: Toda corrección de asistencia exige motivo y se audita con autor, fecha y valores anterior y nuevo.
- `RN-ACAD-011`: Solo se justifica una asistencia en estado `FALTA_INJUSTIFICADA`.
- `RN-ACAD-012`: El apoderado solo solicita justificaciones de alumnos vinculados; la aprobación corresponde al docente tutor (`AsignacionDocente.es_tutor = true`) o al Director; nadie aprueba su propia solicitud.
- `RN-ACAD-013`: El umbral de inasistencias se configura por año académico, es un entero positivo y no tiene valor por defecto.
- `RN-ACAD-014`: Si el umbral no está configurado, no se genera ninguna alerta.
- `RN-ACAD-015`: La alerta se emite cuando las faltas injustificadas acumuladas en el año son mayores o iguales al umbral.
- `RN-ACAD-016`: La alerta es un registro consultable, único por alumno y año, recalculado al registrar asistencia o cambiar el umbral; no implica push ni correo.
- `RN-ACAD-017`: Un bloque de horario no puede solaparse con otro de la misma sección, ni con otro del mismo docente en cualquier sección.
- `RN-ACAD-018`: El curso de un bloque de horario debe pertenecer al nivel de la sección; si se indica docente, debe tener asignación vigente en ese curso, sección y año.
- `RN-ACAD-019`: El día de la semana se codifica de `1` (lunes) a `7` (domingo), y la hora de inicio debe ser anterior a la de fin.
- `RN-ACAD-020`: Prohibido el borrado físico de calificaciones, notas finales, asistencias y justificaciones; se usa borrado lógico y auditoría.
- `RN-ACAD-021`: Los registros académicos se conservan de forma indefinida conforme a la normativa aplicable y no se eliminan al cerrar el año.
- `RN-ACAD-022`: Todo acceso a calificaciones, notas finales, asistencias y horarios se audita; la auditoría no se puede desactivar.
- `RN-ACAD-023`: Los permisos se validan siempre en el backend; el frontend solo oculta UI.
- `RN-ACAD-024`: Las fechas se almacenan en UTC y se presentan en `America/Lima`; las fechas escolares (`fecha` de asistencia) se guardan como `DATE` sin hora.
- `RN-ACAD-025`: Existe como máximo un docente tutor por sección y año; se marca con `es_tutor = true` en la asignación correspondiente.
- `RN-ACAD-026`: Una asistencia puede tener varias solicitudes de justificación a lo largo del tiempo, pero solo una en estado `SOLICITADA` a la vez.

## 6. Modelo de datos

### Entidades nuevas

| Entidad | Campos | Relaciones | Restricciones |
|---|---|---|---|
| `Calificacion` | id, alumno_id, curso_id, periodo_id, valor, observacion, created_at, updated_at, created_by, updated_by, deleted_at | Alumno, Curso, PeriodoAcademico | Único (alumno_id, curso_id, periodo_id); valor en `AD`,`A`,`B`,`C` |
| `NotaFinalPeriodo` | id, alumno_id, curso_id, periodo_id, valor, observacion, created_at, updated_at, created_by, updated_by, deleted_at | Alumno, Curso, PeriodoAcademico | Único (alumno_id, curso_id, periodo_id); valor en `AD`,`A`,`B`,`C` |
| `Asistencia` | id, alumno_id, fecha, estado, observacion, created_at, updated_at, created_by, updated_by, deleted_at | Alumno | Único (alumno_id, fecha); estado en `PRESENTE`,`TARDE`,`FALTA_JUSTIFICADA`,`FALTA_INJUSTIFICADA` |
| `JustificacionFalta` | id, asistencia_id, solicitante_usuario_id, motivo, estado, resuelto_por, resuelto_en, motivo_resolucion, created_at, updated_at | Asistencia, Usuario | Índice asistencia_id; máximo una solicitud `SOLICITADA` por asistencia; estado en `SOLICITADA`,`APROBADA`,`RECHAZADA` |
| `UmbralAsistencia` | id, anio_id, faltas_para_alerta, created_at, updated_at, created_by, updated_by | AnioAcademico | Único anio_id; `faltas_para_alerta` entero positivo, sin default |
| `AlertaAsistencia` | id, alumno_id, anio_id, faltas_injustificadas, umbral, generada_en, actualizada_en | Alumno, AnioAcademico | Único (alumno_id, anio_id) |
| `Horario` | id, anio_id, seccion_id, curso_id, docente_id, dia_semana, hora_inicio, hora_fin, created_at, updated_at, created_by, updated_by, deleted_at | AnioAcademico, Seccion, Curso, Docente | Único (seccion_id, dia_semana, hora_inicio); docente_id opcional |

### Entidades existentes que se consumen

- `Alumno`, `Docente`, `Curso`, `Seccion`, `Grado`, `Nivel` (specs/core).
- `AnioAcademico`, `PeriodoAcademico` (specs/core).
- `Matricula` (specs/core), para validar el vínculo alumno–sección–año.
- `AsignacionDocente` (specs/core), para el alcance del docente; se amplía con `es_tutor` para identificar al tutor de la sección.
- `ApoderadoAlumno` (specs/core), para el alcance del apoderado.
- `Usuario`, `Rol` y `Auditoria` (specs/core).

### Relaciones clave

```text
Alumno 1─N Calificacion N─1 Curso
PeriodoAcademico 1─N Calificacion
Alumno 1─N NotaFinalPeriodo N─1 Curso
Alumno 1─N Asistencia
Asistencia 1─0..1 JustificacionFalta
AnioAcademico 1─0..1 UmbralAsistencia
Alumno 1─N AlertaAsistencia N─1 AnioAcademico
Seccion 1─N Horario N─1 Curso
Docente 1─N Horario
```

Reglas de la constitución aplicables: UUID generado en la aplicación, auditoría de creación/modificación, borrado lógico, fechas en UTC y `DATE` para fechas escolares.

## 7. Contratos de API

Prefijo `/api/v1`. Errores con el sobre estándar de `docs/architecture.md`. Los DTO y schemas Zod viven en `packages/shared`.

### Calificaciones y notas finales

| Método | Ruta | Permiso | Entrada | Salida | Errores |
|---|---|---|---|---|---|
| `GET` | `/periodos/:periodoId/calificaciones` | `academic.calificaciones.leer` | query `cursoId`, `seccionId` | `Paginated<CalificacionResponse>` | `400`, `403`, `404` |
| `GET` | `/periodos/:periodoId/notas-finales` | `academic.calificaciones.leer` | query `cursoId`, `seccionId` | `Paginated<NotaFinalResponse>` | `400`, `403`, `404` |
| `POST` | `/calificaciones` | `academic.calificaciones.gestionar` | `{ alumnoId, cursoId, periodoId, valor, observacion? }` | `201 CalificacionResponse` | `400`, `403`, `404`, `409` |
| `PATCH` | `/calificaciones/:id` | `academic.calificaciones.gestionar` / `academic.calificaciones.corregir` | `{ valor?, observacion?, motivo? }` | `200 CalificacionResponse` | `400`, `403`, `404`, `409` |
| `POST` | `/notas-finales` | `academic.calificaciones.gestionar` | `{ alumnoId, cursoId, periodoId, valor, observacion? }` | `201 NotaFinalResponse` | `400`, `403`, `404`, `409` |
| `PATCH` | `/notas-finales/:id` | `academic.calificaciones.gestionar` / `academic.calificaciones.corregir` | `{ valor?, observacion?, motivo? }` | `200 NotaFinalResponse` | `400`, `403`, `404`, `409` |
| `GET` | `/periodos/:periodoId/calificaciones/resumen` | `academic.calificaciones.leer` | — | `{ totalCalificaciones, totalNotasFinales, tieneCalificaciones }` | `403`, `404` |

### Asistencias y justificaciones

| Método | Ruta | Permiso | Entrada | Salida | Errores |
|---|---|---|---|---|---|
| `GET` | `/asistencias` | `academic.asistencias.leer` | query `alumnoId?`, `seccionId?`, `anioId?`, `desde?`, `hasta?` | `Paginated<AsistenciaResponse>` | `400`, `403` |
| `POST` | `/asistencias/lote` | `academic.asistencias.gestionar` | `{ seccionId, fecha, registros: [{ alumnoId, estado, observacion? }] }` | `201 { registros: AsistenciaResponse[] }` | `400`, `403`, `404`, `409` |
| `PATCH` | `/asistencias/:id` | `academic.asistencias.gestionar` | `{ estado?, observacion?, motivo }` | `200 AsistenciaResponse` | `400`, `403`, `404`, `409` |
| `POST` | `/asistencias/:id/justificaciones` | `academic.asistencias.solicitar` | `{ motivo }` | `201 JustificacionResponse` | `400`, `403`, `404`, `409` |
| `GET` | `/justificaciones` | `academic.asistencias.leer` | query `estado?`, `alumnoId?`, `seccionId?` | `Paginated<JustificacionResponse>` | `400`, `403` |
| `POST` | `/justificaciones/:id/aprobar` | `academic.asistencias.justificar` | `{ comentario? }` | `200 JustificacionResponse` | `403`, `404`, `409` |
| `POST` | `/justificaciones/:id/rechazar` | `academic.asistencias.justificar` | `{ motivo }` | `200 JustificacionResponse` | `400`, `403`, `404`, `409` |

### Umbral y alertas

| Método | Ruta | Permiso | Entrada | Salida | Errores |
|---|---|---|---|---|---|
| `GET` | `/anios-academicos/:anioId/umbral-asistencia` | `core.estructura.gestionar` | — | `{ anioId, faltasParaAlerta: number \| null }` | `403`, `404` |
| `PUT` | `/anios-academicos/:anioId/umbral-asistencia` | `core.estructura.gestionar` | `{ faltasParaAlerta }` | `200 { anioId, faltasParaAlerta }` | `400`, `403`, `404` |
| `GET` | `/alertas-asistencia` | `academic.asistencias.leer` | query `anioId?`, `alumnoId?` | `Paginated<AlertaAsistenciaResponse>` | `400`, `403` |

### Horarios

| Método | Ruta | Permiso | Entrada | Salida | Errores |
|---|---|---|---|---|---|
| `GET` | `/horarios` | `academic.horarios.leer` | query `anioId`, `seccionId?`, `docenteId?` | `Paginated<HorarioResponse>` | `400`, `403` |
| `POST` | `/horarios` | `academic.horarios.gestionar` | `{ anioId, seccionId, cursoId, docenteId?, diaSemana, horaInicio, horaFin }` | `201 HorarioResponse` | `400`, `403`, `404`, `409` |
| `PATCH` | `/horarios/:id` | `academic.horarios.gestionar` | Parcial del alta | `200 HorarioResponse` | `400`, `403`, `404`, `409` |
| `DELETE` | `/horarios/:id` | `academic.horarios.gestionar` | — | `204` | `403`, `404` |

## 8. Casos borde y errores

| Caso | Comportamiento esperado |
|---|---|
| Calificación duplicada para alumno, curso y período | `409 CONFLICT` con mensaje genérico |
| Nota final duplicada | `409 CONFLICT` |
| Docente edita un período `CERRADO` | `409 CONFLICT`; se indica que requiere corrección del Director |
| Director corrige sin motivo | `400 VALIDATION_ERROR` |
| Alumno sin matrícula `APROBADA` en el año | `409 CONFLICT` |
| Docente sin asignación en el curso o sección | `403 FORBIDDEN` |
| Apoderado o alumno consulta un recurso ajeno | `403 FORBIDDEN` |
| SuperAdmin consulta calificaciones | Permitido y auditado |
| Asistencia duplicada para alumno y fecha | `409 CONFLICT` |
| Fecha de asistencia futura o fuera del año | `400 VALIDATION_ERROR` |
| Corrección de asistencia sin motivo | `400 VALIDATION_ERROR` |
| Justificación sobre una asistencia que no es falta injustificada | `409 CONFLICT` |
| Segunda solicitud abierta para la misma asistencia | `409 CONFLICT` |
| Justificación ya resuelta | `409 CONFLICT` |
| Apoderado intenta aprobar su propia solicitud | `403 FORBIDDEN` |
| Umbral `0`, negativo o no entero | `400 VALIDATION_ERROR` |
| Año sin umbral | `GET` devuelve `null`; no se generan alertas |
| Cambio de umbral por encima de las faltas acumuladas | La alerta existente se elimina |
| Horario solapado en la misma sección | `409 CONFLICT` |
| Horario solapado del mismo docente en otra sección | `409 CONFLICT` |
| Curso fuera del nivel de la sección | `400 VALIDATION_ERROR` |
| Docente del horario sin asignación vigente | `400 VALIDATION_ERROR` |
| Eliminación de horario | Borrado lógico con auditoría |
| Listado sin resultados | `200` con `data: []` y `meta.total = 0` |

## 9. Dependencias

- **Depende de:** módulo `core` (`specs/core/001-spec-mvp/`) en sus entidades raíz, matrícula, asignaciones, RBAC y auditoría. Requiere que `AsignacionDocente` incorpore `es_tutor` y que la gestión de asignaciones permita marcarlo (autorizado el 2026-11-08).
- **Habilita:** `T042` de `core`, al exponer si un período tiene calificaciones.
- **Dependen de este módulo:** administrativo (actas y certificados), comunicación (alertas de inasistencia) y aula virtual (materiales por curso y período).
- **Dependencias técnicas:** las del stack aprobado (`docs/stack.md`). No se requieren dependencias nuevas.
- **Prerrequisito documental:** incorporar los códigos `academic.*` a `docs/rbac-matrix.md` y a la constitución antes de implementar. Requiere autorización humana.

## 10. Preguntas abiertas

| ID | Pregunta | Decisión | Estado |
|---|---|---|---|
| Q1 | ¿Cómo se registra la calificación? | Una calificación literal por alumno, curso y período | resuelta |
| Q2 | ¿Cómo se obtiene la nota final? | Manual del docente, sin cálculo ni equivalencia numérica | resuelta |
| Q3 | ¿Cuándo se dispara la alerta de inasistencias? | Umbral configurable por año, sin valor por defecto; sin umbral no hay alerta | resuelta |
| Q4 | ¿Granularidad de la asistencia? | Diaria y única por alumno y fecha | resuelta |
| Q5 | ¿Nivel del umbral? | Por año académico, acumulando las faltas injustificadas del año | resuelta |
| Q6 | ¿La alerta se persiste? | Sí, como registro consultable único por alumno y año; se recalcula al cambiar asistencia o umbral | resuelta |
| Q7 | ¿Quién es «docente tutor» para aprobar justificaciones? | Se añade `es_tutor` a `AsignacionDocente`; solo el tutor de la sección o el Director aprueban | resuelta |
| Q8 | ¿Se actualizan `docs/rbac-matrix.md` y la constitución con los códigos `academic.*`? | Autorizado el 2026-11-08; los códigos se registran en la matriz y la constitución sube a `2.1.0` | resuelta |

> Q7 y Q8 quedaron resueltas el 2026-11-08. Spec aprobada el 2026-11-08 con las decisiones Q1–Q8.

## 11. Trazabilidad

| Requerimiento | Tareas |
|---|---|
| RF-ACAD-001 | T004, T005, T017 |
| RF-ACAD-002 | T004, T005, T017 |
| RF-ACAD-003 | T005, T006, T017 |
| RF-ACAD-004 | T008, T009, T018 |
| RF-ACAD-005 | T008, T009, T018 |
| RF-ACAD-006 | T044 (core), T010, T011, T018 |
| RF-ACAD-007 | T009, T011, T018 |
| RF-ACAD-008 | T012, T013, T019 |
| RF-ACAD-009 | T012, T013, T019 |
| RF-ACAD-010 | T014, T015, T019 |
| RF-ACAD-011 | T015, T019 |
| RF-ACAD-012 | T007 |
| RF-ACAD-013 | T016 |
