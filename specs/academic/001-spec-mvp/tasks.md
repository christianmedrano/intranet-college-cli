# Tareas: Gestión Académica (Calificaciones, Asistencias y Horarios)

| Campo | Valor |
|---|---|
| Spec | `specs/academic/001-spec-mvp/spec.md` |
| Plan | `specs/academic/001-spec-mvp/plan.md` |
| Estado | `en progreso` |
| Fecha | 2026-11-08 |

> Spec aprobada v1.0.0 y plan aprobado v1.0.0. Ejecutar en orden; no iniciar una tarea sin el gate de la anterior en verde.
> **Prerrequisito:** `T044` de `specs/core/001-spec-mvp/tasks.md` (`es_tutor` en `AsignacionDocente`) está cerrada el 2026-11-08; T003 queda habilitada.

## Convenciones

Formato obligatorio:

```md
- [ ] TNNN — <acción> — <archivo(s)> — <RF|RN> — <criterio de aceptación>
```

- Una tarea = un cambio verificable.
- Gate obligatorio al cerrar: `npm run lint && npm run typecheck && npm test`.
- Prohibido marcar `[x]` con tests en rojo.
- Si aparece trabajo nuevo, se agrega aquí y se reporta.

## Fase 1 — Datos y contratos

- [x] T001 — Incorporar los nueve códigos `academic.*` al catálogo y a `rolePermissions` según la matriz RBAC — `packages/shared/src/domain/permissions.ts`, `apps/api/test/core/rbac.test.ts`, `apps/api/test/core/me.test.ts` — RF-ACAD-003, RF-ACAD-007, RF-ACAD-011 — la unión de permisos por rol coincide con `docs/rbac-matrix.md` y las pruebas cubren los cinco roles
- [x] T002 — Crear schemas Zod y DTOs de calificaciones, notas finales, asistencias, justificaciones, umbral, alertas y horarios — `packages/shared/src/domain/academic.ts`, `packages/shared/src/schemas/academic/`, `packages/shared/src/contracts/academic/`, `packages/shared/src/index.ts`, `apps/api/test/academic/schemas.test.ts` — RF-ACAD-001 a RF-ACAD-011 — `AD/A/B/C`, estados, `diaSemana` 1–7 y `HH:MM` se validan; entradas inválidas devuelven `VALIDATION_ERROR`
- [x] T003 — Crear la migración `academic_init` con las siete tablas, índices, únicos y `CHECK`; actualizar la limpieza de la base de pruebas — `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/`, `apps/api/test/helpers/test-db.ts`, `apps/api/test/academic/model.test.ts` — RF-ACAD-001, RF-ACAD-002, RF-ACAD-004, RF-ACAD-008, RF-ACAD-009, RF-ACAD-010 — `prisma migrate dev` aplica sin error y los duplicados de calificación, nota, asistencia, umbral, alerta y horario fallan por integridad

## Fase 2 — Calificaciones y notas finales

- [x] T004 — Implementar repositorio y servicio de calificaciones con validación de escala, matrícula `APROBADA`, asignación docente, bloqueo por período `CERRADO` y corrección del Director con motivo — `apps/api/src/modules/academic/calificaciones/`, `apps/api/src/modules/academic/scope.ts`, `apps/api/test/academic/calificaciones.test.ts` — RF-ACAD-001, RN-ACAD-001, RN-ACAD-002, RN-ACAD-005, RN-ACAD-006, RN-ACAD-007, RN-ACAD-008 — docente fuera de alcance recibe `403`; duplicado `409`; período cerrado `409`; corrección sin motivo `400`; se audita autor, fecha y motivo
- [x] T005 — Implementar repositorio y servicio de nota final manual, sin cálculo ni derivación de parciales — `apps/api/src/modules/academic/calificaciones/nota-final.*.ts`, `apps/api/test/academic/nota-final.test.ts` — RF-ACAD-002, RN-ACAD-003, RN-ACAD-004 — la nota guardada es exactamente la enviada, aunque existan cero o varias calificaciones; período cerrado bloquea al docente
- [x] T006 — Exponer `GET /periodos/:periodoId/calificaciones` y `GET /periodos/:periodoId/notas-finales` con alcance por rol y vínculo — `apps/api/src/modules/academic/calificaciones/*.routes.ts`, `*.controller.ts`, `apps/api/src/app.ts`, `apps/api/test/academic/consulta-calificaciones.test.ts` — RF-ACAD-003, RN-ACAD-023 — Director ve todo; docente solo lo asignado; apoderado solo lo vinculado; alumno solo lo propio; SuperAdmin accede y queda auditado
- [x] T007 — Implementar el resumen de calificaciones por período para desbloquear `T042` de `core` — `apps/api/src/modules/academic/calificaciones/`, `apps/api/test/academic/resumen-periodo.test.ts` — RF-ACAD-012 — sin registros `tieneCalificaciones = false`; con una calificación o nota final `true`; sin permiso `403`
- [x] T022 — Exponer `POST /calificaciones`, `PATCH /calificaciones/:id`, `POST /notas-finales` y `PATCH /notas-finales/:id` sobre los servicios de T004 y T005 — `apps/api/src/modules/academic/calificaciones/*.routes.ts`, `*.controller.ts`, `apps/api/src/app.ts`, `apps/api/test/academic/api-calificaciones.test.ts` — RF-ACAD-001, RF-ACAD-002 — el alta exige `academic.calificaciones.gestionar`; la corrección tras el cierre exige `academic.calificaciones.corregir` y `motivo`; detectada durante T006 al no existir tarea para la escritura HTTP

## Fase 3 — Asistencias y justificaciones

- [x] T008 — Implementar repositorio y servicio de asistencia diaria: lote atómico, unicidad por alumno y fecha, matrícula `APROBADA`, corrección con motivo y auditoría del valor anterior y nuevo — `apps/api/src/modules/academic/asistencias/`, `apps/api/src/modules/academic/scope.ts`, `apps/api/test/academic/asistencias.test.ts` — RF-ACAD-004, RF-ACAD-005, RN-ACAD-009, RN-ACAD-010 — fecha duplicada `409`; fecha fuera del año `400`; corrección sin motivo `400`; si un alumno del lote falla, no se guarda ninguno
- [x] T009 — Exponer `GET /asistencias` y `PATCH /asistencias/:id` con alcance por rol y vínculo — `apps/api/src/modules/academic/asistencias/*.routes.ts`, `*.controller.ts`, `apps/api/src/app.ts`, `apps/api/test/academic/consulta-asistencias.test.ts` — RF-ACAD-004, RF-ACAD-005, RF-ACAD-007 — docente limitado a sus secciones; apoderado a sus alumnos; alumno a lo propio; ajenos reciben `403`
- [x] T023 — Exponer `POST /asistencias/lote` sobre el servicio de T008 — `apps/api/src/modules/academic/asistencias/*.routes.ts`, `*.controller.ts`, `apps/api/test/academic/api-asistencias.test.ts` — RF-ACAD-004 — responde `201` con los registros creados; duplicado `409`; fecha inválida `400`; docente sin asignación `403`; detectada durante T009 al no existir tarea para la escritura HTTP del lote
- [x] T010 — Implementar solicitud, aprobación y rechazo de justificaciones, con transición `FALTA_INJUSTIFICADA → FALTA_JUSTIFICADA`, una sola solicitud abierta y aprobación exclusiva del tutor o Director — `apps/api/src/modules/academic/justificaciones/`, `apps/api/test/academic/justificaciones.test.ts` — RF-ACAD-006, RN-ACAD-011, RN-ACAD-012, RN-ACAD-026 — solicitud sobre falta injustificada; segunda solicitud abierta `409`; docente no tutor `403`; solicitud resuelta no se vuelve a resolver (`409`)
- [x] T011 — Exponer `POST /asistencias/:id/justificaciones`, `GET /justificaciones`, `POST /justificaciones/:id/aprobar` y `/rechazar` con scoping — `apps/api/src/modules/academic/justificaciones/*.routes.ts`, `*.controller.ts`, `apps/api/src/app.ts`, `apps/api/test/academic/api-justificaciones.test.ts` — RF-ACAD-006, RF-ACAD-007 — apoderado solo solicita para alumnos vinculados; el tutor aprueba; el rechazo exige motivo; no se aprueba la propia solicitud

## Fase 4 — Umbral y alertas

- [x] T012 — Implementar configuración del umbral por año (sin valor por defecto) y recálculo de alertas con `>=`, eliminación al subir el umbral y actualización al registrar falta o aprobar justificación — `apps/api/src/modules/academic/umbral/`, `apps/api/src/modules/academic/alertas/`, `apps/api/test/academic/alertas.test.ts` — RF-ACAD-008, RF-ACAD-009, RN-ACAD-013, RN-ACAD-014, RN-ACAD-015, RN-ACAD-016 — sin umbral no hay alertas; `0` o negativo `400`; alerta única por alumno y año; subir el umbral por encima de las faltas elimina la alerta
- [x] T013 — Exponer `GET`/`PUT /anios-academicos/:anioId/umbral-asistencia` y `GET /alertas-asistencia` con scoping — `apps/api/src/modules/academic/umbral/*.routes.ts`, `alertas/*.routes.ts`, `*.controller.ts`, `apps/api/src/app.ts`, `apps/api/test/academic/api-alertas.test.ts` — RF-ACAD-008, RF-ACAD-009 — solo quien tiene `core.estructura.gestionar` configura; apoderado y alumno solo ven sus alertas; ajenos reciben `403`

## Fase 5 — Horarios

- [x] T014 — Implementar repositorio y servicio de horarios: solapamiento por sección y por docente, curso del nivel correcto, docente con asignación vigente y borrado lógico — `apps/api/src/modules/academic/horarios/`, `apps/api/test/academic/horarios.test.ts` — RF-ACAD-010, RN-ACAD-017, RN-ACAD-018, RN-ACAD-019, RN-ACAD-020 — solapamiento `409`; curso de otro nivel `400`; docente sin asignación `400`; dos peticiones concurrentes no crean bloques solapados
- [x] T015 — Exponer `GET /horarios`, `POST /horarios`, `PATCH /horarios/:id` y `DELETE /horarios/:id` con scoping de consulta — `apps/api/src/modules/academic/horarios/*.routes.ts`, `*.controller.ts`, `apps/api/src/app.ts`, `apps/api/test/academic/api-horarios.test.ts` — RF-ACAD-010, RF-ACAD-011 — solo SA/DI gestionan; docente, apoderado y alumno consultan según vínculo; `DELETE` marca `deleted_at` y no borra físicamente

## Fase 6 — Auditoría

- [x] T016 — Ampliar `AccionAuditoria` con `CORREGIR`, `RECHAZAR` y `ACCEDER` y auditar accesos y cambios de calificaciones, asistencias, justificaciones y horarios sin PII — `apps/api/src/core/audit.ts`, `apps/api/src/modules/academic/`, `apps/api/test/academic/auditoria.test.ts` — RF-ACAD-013, RN-ACAD-022 — el SuperAdmin deja registro al consultar; la corrección guarda valor anterior y nuevo; el `datos` auditado no contiene nombres, documentos ni el motivo completo

## Fase 7 — Frontend

- [x] T017 — Crear las pantallas de calificaciones y nota final con formularios, estados de carga, vacío, error y éxito, y ocultamiento por rol — `apps/web/src/features/academic/calificaciones/`, `apps/web/src/app/router.tsx`, `apps/web/src/features/academic/calificaciones/*.test.tsx` — RF-ACAD-001, RF-ACAD-002, RF-ACAD-003 — docente registra y edita; Director corrige con motivo; apoderado y alumno solo consultan; etiquetas, foco y navegación por teclado
- [x] T018 — Crear las pantallas de asistencia y justificaciones con los cuatro estados y las acciones permitidas por rol — `apps/web/src/features/academic/asistencias/`, `apps/web/src/app/router.tsx`, `apps/web/src/features/academic/asistencias/*.test.tsx` — RF-ACAD-004, RF-ACAD-005, RF-ACAD-006, RF-ACAD-007 — lote de asistencia, corrección con motivo y solicitud/aprobación de justificación; estados de carga, vacío y error
- [x] T019 — Crear las pantallas de umbral, alertas y horarios con formularios accesibles y estados obligatorios — `apps/web/src/features/academic/horarios/`, `apps/web/src/features/academic/shared/`, `apps/web/src/app/router.tsx`, `apps/web/src/features/academic/horarios/*.test.tsx` — RF-ACAD-008, RF-ACAD-009, RF-ACAD-010, RF-ACAD-011 — Director configura el umbral y gestiona horarios; apoderado y alumno consultan alertas y horarios; sin umbral se muestra un estado vacío explicativo

## Fase 8 — Cierre

- [x] T020 — Cerrar cobertura, pruebas de 3 y 4 períodos, actualización de `docs/architecture.md` y verificación del gate completo — `apps/api/test/academic/`, `docs/architecture.md`, `specs/academic/001-spec-mvp/tasks.md` — RF-ACAD-001 a RF-ACAD-013 — cobertura de servicios ≥ 70 %; el flujo funciona con 3 y con 4 períodos; `lint + typecheck + test` en verde
- [x] T021 — Configurar Playwright y el flujo E2E: login docente, calificación, asistencia y consulta del apoderado — `playwright.config.ts`, `apps/web/e2e/`, `package.json` — RF-ACAD-001, RF-ACAD-004, RF-ACAD-007 — configuración y test creados; ejecución requiere seed de usuarios de prueba

## Definition of Done

Se aplica el anexo A de `docs/constitution.md`:

- [ ] Tareas citan su requerimiento.
- [ ] `lint + typecheck + test` en verde.
- [ ] Permisos validados en backend y alineados con la matriz RBAC.
- [ ] Sin PII en logs ni almacenamiento del navegador.
- [ ] Estados de carga, vacío y error cubiertos.
- [ ] Spec y tareas actualizadas.
- [ ] Sin dependencias no aprobadas.

## Registro de bloqueos

| Fecha | Tarea | Motivo | Estado |
|---|---|---|---|
| 2026-11-08 | T003 | Dependía de `T044` de `core` (`es_tutor`) | resuelto: T044 cerrada el 2026-11-08 |
