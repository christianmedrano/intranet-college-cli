# Plan Técnico: Gestión Académica (Calificaciones, Asistencias y Horarios)

| Campo | Valor |
|---|---|
| Spec asociada | `specs/academic/001-spec-mvp/spec.md` |
| Versión | `1.0.0` |
| Estado | `aprobado` |
| Fecha | 2026-11-08 |

## 1. Resumen

Se implementa el módulo `academic` de la API sobre las entidades de `core`: calificaciones y notas finales literales por curso y período, asistencia diaria con justificaciones, umbral configurable de inasistencias con alertas consultables, y horarios semanales por sección. La estrategia es reutilizar el patrón `routes → controller → service → repository`, los guards de `core` y la auditoría transaccional, añadiendo un módulo de resolución de vínculos académicos para que ningún endpoint confíe solo en el rol.

En el frontend se añaden las pantallas de calificaciones, asistencias, justificaciones, umbral/alertas y horarios, con los cuatro estados obligatorios y navegación por teclado. No se incorporan dependencias nuevas.

## 2. Constitution Check

| Principio | Cumple | Observación |
|---|---|---|
| Precedencia y alcance del MVP | Sí | Solo calificaciones, asistencias y horarios; sin pagos ni aula virtual |
| Arquitectura y límites entre features | Sí | `apps/api/src/modules/academic`, contratos en `packages/shared`; no importa otras features |
| Datos: UUID, auditoría, borrado lógico | Sí | Todas las entidades nuevas; sin borrado físico de registros académicos |
| Escala literal AD/A/B/C | Sí | Unión tipada `AD \| A \| B \| C`; sin valores ni conversiones numéricas |
| Períodos configurables (sin hardcodeo) | Sí | Todo se asocia a `periodoId`; pruebas con 3 y 4 períodos |
| RBAC validado en backend | Sí | Nueve permisos `academic.*` + resolución de vínculo en cada servicio |
| Privacidad (sin PII en logs) | Sí | Auditoría solo con ids y valores; sin nombres, documentos ni motivos completos |
| Tests como puerta | Sí | Dominio, API y UI; cada tarea con caso feliz y error |
| Accesibilidad y estados de UI | Sí | T017–T019 cubren carga, vacío, error, éxito, etiquetas y foco |

> No hay ningún `No`. El plan queda habilitado para aprobación.

## 3. Arquitectura de la feature

### Backend

```text
apps/api/src/modules/academic/
├─ calificaciones/
│  ├─ calificacion.routes.ts
│  ├─ calificacion.controller.ts
│  ├─ calificacion.service.ts
│  ├─ calificacion.repository.ts
│  ├─ nota-final.routes.ts
│  ├─ nota-final.controller.ts
│  ├─ nota-final.service.ts
│  └─ nota-final.repository.ts
├─ asistencias/
│  ├─ asistencia.routes.ts
│  ├─ asistencia.controller.ts
│  ├─ asistencia.service.ts
│  └─ asistencia.repository.ts
├─ justificaciones/
│  ├─ justificacion.routes.ts
│  ├─ justificacion.controller.ts
│  ├─ justificacion.service.ts
│  └─ justificacion.repository.ts
├─ umbral/
│  ├─ umbral.routes.ts
│  ├─ umbral.controller.ts
│  ├─ umbral.service.ts
│  └─ umbral.repository.ts
├─ alertas/
│  ├─ alerta.routes.ts
│  ├─ alerta.controller.ts
│  ├─ alerta.service.ts
│  └─ alerta.repository.ts
├─ horarios/
│  ├─ horario.routes.ts
│  ├─ horario.controller.ts
│  ├─ horario.service.ts
│  └─ horario.repository.ts
└─ scope.ts
```

`scope.ts` centraliza las aserciones de vínculo y evita duplicarlas:

- `assertDocenteDeCursoSeccion(actor, cursoId, seccionId, anioId)`.
- `assertDocenteDeSeccion(actor, seccionId, anioId)`.
- `assertTutorDeSeccion(actor, seccionId, anioId)`.
- `assertApoderadoDeAlumno(actor, alumnoId)`.
- `assertAlumnoPropio(actor, alumnoId)`.
- `resolverSeccionDeAlumnoEnAnio(alumnoId, anioId)` a partir de la matrícula `APROBADA`.

Se reutilizan `requireAuth`, `requirePermission`, `contextoDePeticion` y `registrarAuditoria` de `core`.

### Contratos compartidos

```text
packages/shared/src/
├─ schemas/academic/
│  ├─ calificacion.ts
│  ├─ nota-final.ts
│  ├─ asistencia.ts
│  ├─ justificacion.ts
│  ├─ umbral-asistencia.ts
│  ├─ alerta-asistencia.ts
│  └─ horario.ts
├─ contracts/academic/
│  └─ … (respuestas equivalentes)
└─ domain/
   ├─ permissions.ts        # nueve códigos academic.*
   └─ academic.ts           # uniones ValorLiteral, EstadoAsistencia, DiaSemana
```

### Frontend

```text
apps/web/src/features/academic/
├─ calificaciones/
│  ├─ api.ts
│  ├─ CalificacionesPage.tsx
│  ├─ NotaFinalForm.tsx
│  └─ CalificacionForm.tsx
├─ asistencias/
│  ├─ api.ts
│  ├─ AsistenciasPage.tsx
│  └─ JustificacionForm.tsx
├─ horarios/
│  ├─ api.ts
│  ├─ HorariosPage.tsx
│  └─ HorarioForm.tsx
└─ shared/
   ├─ role-scope.ts
   └─ components/
```

Se reutilizan `shared/api/client.ts`, el contexto de sesión y el guard por rol. La UI oculta acciones sin permiso, pero el backend siempre revalida.

## 4. Modelo de datos y migraciones

### Migración `core_asignacion_tutor` (T044 de `core`)

| Cambio | Tabla / modelo | Tipo | Reversible |
|---|---|---|---|
| Añadir `es_tutor` (`BOOLEAN NOT NULL DEFAULT false`) | `asignacion_docente` / `AsignacionDocente` | alterar | Sí |
| Índice `(seccion_id, anio_id, es_tutor)` | `asignacion_docente` | índice | Sí |

La unicidad de tutor por sección y año no se puede expresar con índice parcial en MySQL: se valida en el servicio dentro de una transacción con `SELECT … FOR UPDATE` y se prueba la concurrencia.

### Migración `academic_init`

| Cambio | Tabla / modelo | Tipo | Reversible |
|---|---|---|---|
| Crear `calificacion` / `Calificacion` | id, alumno_id, curso_id, periodo_id, valor, observacion, auditoría, deleted_at | crear | Sí |
| Crear `nota_final_periodo` / `NotaFinalPeriodo` | id, alumno_id, curso_id, periodo_id, valor, observacion, auditoría, deleted_at | crear | Sí |
| Crear `asistencia` / `Asistencia` | id, alumno_id, fecha, estado, observacion, auditoría, deleted_at | crear | Sí |
| Crear `justificacion_falta` / `JustificacionFalta` | id, asistencia_id, solicitante_usuario_id, motivo, estado, resuelto_por, resuelto_en, motivo_resolucion | crear | Sí |
| Crear `umbral_asistencia` / `UmbralAsistencia` | id, anio_id, faltas_para_alerta, auditoría | crear | Sí |
| Crear `alerta_asistencia` / `AlertaAsistencia` | id, alumno_id, anio_id, faltas_injustificadas, umbral, generada_en, actualizada_en | crear | Sí |
| Crear `horario` / `Horario` | id, anio_id, seccion_id, curso_id, docente_id, dia_semana, hora_inicio, hora_fin, auditoría, deleted_at | crear | Sí |

Índices y restricciones:

- Únicos: `calificacion(alumno_id, curso_id, periodo_id)`, `nota_final_periodo(alumno_id, curso_id, periodo_id)`, `asistencia(alumno_id, fecha)`, `umbral_asistencia(anio_id)`, `alerta_asistencia(alumno_id, anio_id)`, `horario(seccion_id, dia_semana, hora_inicio)`.
- Índices de consulta: `calificacion(periodo_id, curso_id)`, `nota_final_periodo(periodo_id, curso_id)`, `asistencia(seccion_id, fecha)`, `justificacion_falta(asistencia_id, estado)`, `horario(docente_id, dia_semana)`, `horario(anio_id, seccion_id)`.
- `valor` es `CHAR(2)` con `CHECK (valor IN ('AD','A','B','C'))`.
- `estado` de asistencia es `VARCHAR(20)` con `CHECK` para los cuatro valores.
- `estado` de justificación es `VARCHAR(20)` con `CHECK` para `SOLICITADA`, `APROBADA`, `RECHAZADA`.
- `dia_semana` es `TINYINT` con `CHECK (dia_semana BETWEEN 1 AND 7)`.
- `hora_inicio` y `hora_fin` son `CHAR(5)` en formato `HH:MM`, con `CHECK` de formato; se comparan como cadenas porque el formato ordena igual que el tiempo. No se usa `TIME` para evitar conversiones de zona horaria.
- `asistencia.fecha` es `DATE`; el resto de marcas de tiempo es `DATETIME(3)` en UTC.

Impacto en datos existentes: ninguno. `es_tutor` toma `false` en todas las asignaciones previas. No se crean umbrales ni alertas por defecto.

Rollback: en desarrollo, `prisma migrate reset` o migración inversa que elimina las tablas nuevas y la columna `es_tutor`. En producción, restauración desde respaldo; las migraciones no se revierten manualmente.

## 5. Contratos de API

Convenciones: prefijo `/api/v1`, `Authorization: Bearer`, validación Zod en el borde, errores `{ error: { code, message, details } }` y paginación `?page&pageSize` con `meta`.

| Método | Ruta | Request (Zod) | Response (DTO) | Permiso |
|---|---|---|---|---|
| `GET` | `/periodos/:periodoId/calificaciones` | `paginationSchema` + `cursoId?`, `seccionId?` | `Paginated<CalificacionResponse>` | `academic.calificaciones.leer` |
| `POST` | `/calificaciones` | `crearCalificacionSchema` | `CalificacionResponse` | `academic.calificaciones.gestionar` |
| `PATCH` | `/calificaciones/:id` | `actualizarCalificacionSchema` | `CalificacionResponse` | `academic.calificaciones.gestionar` o `.corregir` |
| `GET` | `/periodos/:periodoId/notas-finales` | `paginationSchema` + `cursoId?`, `seccionId?` | `Paginated<NotaFinalResponse>` | `academic.calificaciones.leer` |
| `POST` | `/notas-finales` | `crearNotaFinalSchema` | `NotaFinalResponse` | `academic.calificaciones.gestionar` |
| `PATCH` | `/notas-finales/:id` | `actualizarNotaFinalSchema` | `NotaFinalResponse` | `academic.calificaciones.gestionar` o `.corregir` |
| `GET` | `/periodos/:periodoId/calificaciones/resumen` | `uuidParamSchema` | `ResumenCalificacionesResponse` | `academic.calificaciones.leer` |
| `GET` | `/asistencias` | `paginationSchema` + `alumnoId?`, `seccionId?`, `anioId?`, `desde?`, `hasta?` | `Paginated<AsistenciaResponse>` | `academic.asistencias.leer` |
| `POST` | `/asistencias/lote` | `registrarAsistenciaLoteSchema` | `{ registros: AsistenciaResponse[] }` | `academic.asistencias.gestionar` |
| `PATCH` | `/asistencias/:id` | `corregirAsistenciaSchema` | `AsistenciaResponse` | `academic.asistencias.gestionar` |
| `POST` | `/asistencias/:id/justificaciones` | `crearJustificacionSchema` | `JustificacionResponse` | `academic.asistencias.solicitar` |
| `GET` | `/justificaciones` | `paginationSchema` + `estado?`, `alumnoId?`, `seccionId?` | `Paginated<JustificacionResponse>` | `academic.asistencias.leer` |
| `POST` | `/justificaciones/:id/aprobar` | `resolverJustificacionSchema` | `JustificacionResponse` | `academic.asistencias.justificar` |
| `POST` | `/justificaciones/:id/rechazar` | `rechazarJustificacionSchema` | `JustificacionResponse` | `academic.asistencias.justificar` |
| `GET` | `/anios-academicos/:anioId/umbral-asistencia` | `uuidParamSchema` | `{ anioId, faltasParaAlerta: number \| null }` | `core.estructura.gestionar` |
| `PUT` | `/anios-academicos/:anioId/umbral-asistencia` | `umbralAsistenciaSchema` | `{ anioId, faltasParaAlerta: number }` | `core.estructura.gestionar` |
| `GET` | `/alertas-asistencia` | `paginationSchema` + `anioId?`, `alumnoId?` | `Paginated<AlertaAsistenciaResponse>` | `academic.asistencias.leer` |
| `GET` | `/horarios` | `paginationSchema` + `anioId`, `seccionId?`, `docenteId?` | `Paginated<HorarioResponse>` | `academic.horarios.leer` |
| `POST` | `/horarios` | `crearHorarioSchema` | `HorarioResponse` | `academic.horarios.gestionar` |
| `PATCH` | `/horarios/:id` | `actualizarHorarioSchema` | `HorarioResponse` | `academic.horarios.gestionar` |
| `DELETE` | `/horarios/:id` | `uuidParamSchema` | `204` | `academic.horarios.gestionar` |

Reglas transversales de los contratos:

- Los listados se ordenan por una clave estable (`id` como desempate).
- `motivo` es obligatorio y no vacío para corregir una calificación tras el cierre, corregir una asistencia y rechazar una justificación.
- `POST /asistencias/lote` limita a 200 registros por petición y es atómico: si un alumno no pertenece a la sección o no tiene matrícula `APROBADA`, no se guarda ninguno.
- La sesión y los permisos se resuelven con `requireAuth` + `requirePermission`; el alcance se resuelve en `scope.ts` dentro del servicio.
- Los errores de estado (período cerrado, duplicado, justificación ya resuelta) se traducen a `409 CONFLICT`; los de vínculo, a `403 FORBIDDEN`; los de entrada, a `400 VALIDATION_ERROR`.

## 6. Dependencias nuevas

**Ninguna.** Se usa el stack aprobado: Prisma, MySQL 8, Zod, Vitest, Supertest, React, React Router, Testing Library y Playwright.

## 7. Estrategia de pruebas

| Nivel | Casos |
|---|---|
| Dominio | Validación de `AD/A/B/C`; nota final manual sin cálculo; bloqueo por período cerrado; corrección del Director con motivo; unicidad de calificación/nota/asistencia; umbral nulo y positivo; alerta con `>=` y recálculo al subir/bajar; solapamiento de horarios; tutor único por sección y año |
| API | Cada endpoint con `401`, `403`, `404`, `400` y `409`; alcance de docente, apoderado y alumno; lote de asistencia atómico; justificación solicitada/aprobada/rechazada; resumen para T042; auditoría de escritura y de acceso del SuperAdmin |
| Integración | Transacción de lote de asistencia con alerta; aprobación de justificación que recalcula alertas; cambio de umbral que elimina alertas; horario solapado con dos peticiones concurrentes; calificación en un período de 3 y de 4 períodos |
| UI | Render de listas y formularios; estados de carga, vacío y error; ocultamiento por rol; etiquetas, foco y navegación por teclado |
| E2E | Login de docente, registro de calificación y asistencia, y consulta del apoderado; se ejecuta en T021 |

Cobertura mínima: 70 % en servicios de `academic`, medida con `npm run test:coverage` en `apps/api`. Las pruebas de integración usan la base `_test` y `fileParallelism: false`.

## 8. Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Solapamiento de horarios validado solo en aplicación | Doble reserva concurrente | Transacción con `SELECT … FOR UPDATE` sobre sección/docente + prueba de concurrencia |
| Tutor único sin índice parcial | Dos tutores en la misma sección | Validación transaccional y prueba de concurrencia |
| Alertas desincronizadas con la asistencia | Alertas falsas o faltantes | Recálculo en la misma transacción de asistencia, justificación o umbral; clave única por alumno y año |
| Fuga de datos por confiar solo en el rol | Acceso a alumnos ajenos | `scope.ts` obligatorio y pruebas por rol y vínculo |
| Edición de notas tras el cierre | Alteración histórica | Verificación en el servicio, no en la ruta; auditoría con motivo |
| Volumen de auditoría por lecturas | Crecimiento de la tabla | Índices existentes, escritura mínima y pruebas de que no se registran nombres ni documentos |
| Lote de asistencia parcial | Datos inconsistentes | Transacción única y límite de 200 registros |
| Conversión de horas o fechas | Desfase de un día | `DATE` para fechas escolares; `HH:MM` como cadena para horarios |
| UI muestra acciones no permitidas | Confusión, pero sin fuga | Ocultar por permiso y revalidar en backend |

## 9. Orden de implementación

0. Cerrar `T044` de `core`: `es_tutor`, unicidad de tutor y contratos de asignación.
1. `T001` — Catálogo de permisos académicos y unión por roles.
2. `T002` — Schemas Zod y DTOs compartidos.
3. `T003` — Migración `academic_init` y actualización de la limpieza de pruebas.
4. `T004`–`T007` — Calificaciones, notas finales, consultas y resumen de período.
5. `T008`–`T011` — Asistencias, correcciones y justificaciones.
6. `T012`–`T013` — Umbral y alertas.
7. `T014`–`T015` — Horarios.
8. `T016` — Auditoría de accesos y cambios.
9. `T017`–`T019` — Pantallas de la feature.
10. `T020` — Cierre: cobertura, documentación y gate completo.
11. `T021` — Playwright y flujo E2E.

Cada tarea termina con su gate en verde y se marca en `tasks.md` solo después de la revisión.

## 10. Trazabilidad requisito → tarea

| Requerimiento | Tareas previstas |
|---|---|
| `RF-CORE-011` (extensión `es_tutor`) | `T044` de `core` |
| `RF-ACAD-001` | `T004`, `T005`, `T017` |
| `RF-ACAD-002` | `T004`, `T005`, `T017` |
| `RF-ACAD-003` | `T005`, `T006`, `T017` |
| `RF-ACAD-004` | `T008`, `T009`, `T018` |
| `RF-ACAD-005` | `T008`, `T009`, `T018` |
| `RF-ACAD-006` | `T044`, `T010`, `T011`, `T018` |
| `RF-ACAD-007` | `T009`, `T011`, `T018` |
| `RF-ACAD-008` | `T012`, `T013`, `T019` |
| `RF-ACAD-009` | `T012`, `T013`, `T019` |
| `RF-ACAD-010` | `T014`, `T015`, `T019` |
| `RF-ACAD-011` | `T015`, `T019` |
| `RF-ACAD-012` | `T007` |
| `RF-ACAD-013` | `T016` |

## 11. Notas de implementación

- `es_tutor` se añade con `DEFAULT false`; solo un registro `true` por `(seccion_id, anio_id)`. La gestión de asignaciones de `core` debe permitir marcarlo y desmarcarlo con auditoría.
- El alcance se resuelve siempre por vínculo: rol correcto no implica acceso. El docente necesita `AsignacionDocente` vigente; el apoderado, `ApoderadoAlumno`; el alumno, coincidencia con su propio `alumnoId`.
- La matrícula debe estar `APROBADA` en el año para calificar o registrar asistencia.
- El cierre del período se consulta en el servicio: `CERRADO` bloquea al docente; el Director usa `academic.calificaciones.corregir` y `motivo`.
- La nota final no se calcula ni se deriva de las parciales; se guarda tal como la registra el docente.
- El umbral no tiene valor por defecto ni se siembra. Si no existe, no se crean alertas.
- Las alertas se recalculan en la misma transacción al registrar asistencia, aprobar una justificación o cambiar el umbral. Si las faltas quedan por debajo del umbral, se elimina la alerta.
- Las horas de horario se guardan como `HH:MM` y se comparan como cadenas; no se convierten a `Date`.
- `AccionAuditoria` se amplía con `CORREGIR`, `RECHAZAR` y `ACCEDER`. Solo se guardan ids, valores y campos cambiados; nunca nombres, documentos ni el texto completo del motivo.
- `POST /asistencias/lote` no hace upsert: un registro existente produce `409`. La corrección se hace con `PATCH /asistencias/:id`.
- Los permisos académicos se incorporan a `rolePermissions` según `docs/rbac-matrix.md`; el frontend consume los mismos códigos.
- No se agrega ninguna dependencia; Playwright ya figura en `docs/stack.md`.
