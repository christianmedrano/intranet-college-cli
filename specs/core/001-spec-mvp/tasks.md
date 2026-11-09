# Tareas: Núcleo del Dominio y Autenticación

| Campo | Valor |
|---|---|
| Spec | `specs/core/001-spec-mvp/spec.md` |
| Plan | `specs/core/001-spec-mvp/plan.md` |
| Estado | `en progreso` |
| Fecha | 2026-11-05 |

> Spec aprobada v1.1.0. Ejecutar las tareas en orden; no iniciar una sin el gate de la anterior en verde. El alcance planificado (T001–T039) está completado; la Fase 7 permanece como deuda técnica registrada.

## Convenciones

Formato obligatorio:

```md
- [ ] TNNN — <acción> — <archivo(s)> — <RF|RN> — <criterio de aceptación>
```

- Una tarea = un cambio verificable.
- Gate obligatorio al cerrar: `npm run lint && npm run typecheck && npm test`.
- Prohibido marcar `[x]` con tests en rojo.
- Si aparece trabajo nuevo, se agrega aquí y se reporta.

## Fase 0 — Preparación

- [x] T001 — Instalar Prisma y crear `prisma/schema.prisma` con datasource MySQL — `apps/api/prisma/schema.prisma`, `apps/api/package.json` — infra — `prisma validate` pasa y `generate` funciona
- [x] T002 — Documentar y crear la base `intranet_college` con `utf8mb4` — `apps/api/.env.example`, `README.md` — infra — `prisma migrate dev` conecta sin error
- [x] T003 — Crear schemas base compartidos: UUID, paginación, sobre de error y permisos — `packages/shared/src/schemas/base.ts`, `packages/shared/src/contracts/base.ts` — infra — tipos exportados y `typecheck` en verde

## Fase 1 — Modelo de datos

- [x] T004 — Modelar identidad: Institucion, Persona, Usuario, Rol, UsuarioRol, SesionRefresh, TokenRecuperacion — `apps/api/prisma/schema.prisma` — RF-CORE-002, RF-CORE-003 — relaciones y únicos definidos
- [x] T005 — Modelar estructura: AnioAcademico, PeriodoAcademico, Nivel, Grado, Seccion, Curso — `apps/api/prisma/schema.prisma` — RF-CORE-008, RF-CORE-009, RF-CORE-010 — únicos por año/orden definidos
- [x] T006 — Modelar personas y matrícula: Alumno, Docente, Apoderado, ApoderadoAlumno, Matricula, AsignacionDocente, Auditoria — `apps/api/prisma/schema.prisma` — RF-CORE-012 a RF-CORE-016 — FKs y borrado lógico definidos
- [x] T007 — Generar migración `core_init` y seed de roles, institución y SuperAdmin — `apps/api/prisma/migrations/`, `apps/api/prisma/seed.ts` — RF-CORE-002, RF-CORE-003 — seed idempotente; no corre en producción
- [x] T008 — Pruebas de integridad del modelo: únicos, FKs y borrado lógico — `apps/api/test/core/model.test.ts` — RF-CORE-002, RF-CORE-012, RF-CORE-015 — duplicados devuelven error de integridad

## Fase 2 — Autenticación

- [x] T009 — Configurar entorno, PrismaClient, errores y logger con redacción — `apps/api/src/core/config.ts`, `db.ts`, `errors.ts` — RF-CORE-004 — arranque falla si falta `JWT_SECRET`; logs sin secretos
- [x] T010 — Servicio de hash con Argon2id y verificación — `apps/api/src/core/auth/password.ts`, `test/core/password.test.ts` — RF-CORE-004 — hash distinto por salt y verificación correcta
- [x] T011 — Endpoint `POST /auth/login` con username o email — `apps/api/src/modules/core/auth/` — RF-CORE-004 — credenciales válidas devuelven access token y cookie refresh
- [x] T012 — Guard `requireAuth` y endpoint `GET /me` con roles y permisos efectivos — `apps/api/src/core/auth/guards.ts`, `modules/core/auth/` — RF-CORE-005 — token ausente o expirado devuelve 401
- [x] T013 — Rotación de refresh, logout y revocación — `apps/api/src/modules/core/auth/` — RF-CORE-006 — refresh reutilizado se rechaza; logout revoca
- [x] T014 — Recuperación y restablecimiento de contraseña con token de un solo uso, más emisión del token por administración — `apps/api/src/modules/core/auth/`, `apps/api/src/core/auth/tokens.ts`, `packages/shared/src/schemas/auth.ts` — RF-CORE-007 — `forgot-password` responde 202 siempre; token usado o expirado devuelve 400; el reset revoca las sesiones; `POST /usuarios/:id/token-recuperacion` exige `core.usuarios.gestionar`
- [x] T015 — Rate limit específico en login — `apps/api/src/core/auth/login-throttle.ts`, `apps/api/src/modules/core/auth/auth.controller.ts`, `apps/api/src/app.ts` — RF-CORE-004 — sexto intento fallido en 15 minutos devuelve 429 y un acceso correcto reinicia el contador
- [x] T016 — Pruebas de autenticación: éxito, fallo, inactivo, expirado, refresh y reset — `apps/api/test/core/`, `apps/api/vitest.config.ts` — RF-CORE-004 a RF-CORE-007 — cobertura de servicios ≥ 70 % (medida: `auth.service.ts` 94,23 %; umbral global 70 %)

## Fase 3 — RBAC

- [x] T017 — Catálogo de permisos y guard `requirePermission` — `packages/shared/src/domain/permissions.ts`, `apps/api/src/core/rbac.ts` — RF-CORE-003 — permisos desconocidos fallan en typecheck
- [x] T018 — Guards de vínculo: apoderado–alumno, docente–curso/sección, alumno propio — `apps/api/src/core/auth/vinculo.ts`, `apps/api/test/core/vinculo.test.ts` — RF-CORE-003, RF-CORE-011, RF-CORE-014 — acceso ajeno devuelve 403
- [x] T019 — Pruebas de RBAC por rol y de vínculos — `apps/api/test/core/rbac.test.ts`, `apps/api/test/core/vinculo.test.ts` — RF-CORE-003, RF-CORE-011, RF-CORE-014 — matriz cubierta en casos feliz y prohibido

## Fase 4 — Estructura académica y personas

- [x] T020 — Endpoints `GET` y `PATCH /institucion` — `apps/api/src/modules/core/estructura/`, `packages/shared/src/schemas/institucion.ts`, `packages/shared/src/contracts/institucion.ts`, `apps/api/test/core/institucion.test.ts` — RF-CORE-001 — solo SA/DI; docente recibe 403
- [x] T021 — CRUD de años académicos y activación única transaccional — `apps/api/src/modules/core/estructura/`, `packages/shared/src/schemas/anio-academico.ts`, `packages/shared/src/contracts/anio-academico.ts`, `apps/api/test/core/anio-academico.test.ts` — RF-CORE-008 — activar uno cierra el anterior; DELETE diferido a T042
- [x] T022 — CRUD de períodos, cierre y bloqueo de edición — `apps/api/src/modules/core/estructura/`, `packages/shared/src/schemas/periodo-academico.ts`, `packages/shared/src/contracts/periodo-academico.ts`, `apps/api/test/core/periodo-academico.test.ts` — RF-CORE-009 — soporta N períodos; cerrado no se elimina
- [x] T023 — CRUD de niveles, grados y secciones — `apps/api/src/modules/core/estructura/`, `packages/shared/src/schemas/nivel.ts`, `packages/shared/src/schemas/grado.ts`, `packages/shared/src/schemas/seccion.ts`, `packages/shared/src/contracts/nivel.ts`, `packages/shared/src/contracts/grado.ts`, `packages/shared/src/contracts/seccion.ts`, `apps/api/test/core/estructura-escolar.test.ts` — RF-CORE-010 — únicos por grado/año
- [x] T024 — CRUD de cursos — `apps/api/src/modules/core/estructura/`, `packages/shared/src/schemas/curso.ts`, `packages/shared/src/contracts/curso.ts`, `apps/api/test/core/curso.test.ts` — RF-CORE-011 — únicos por nivel
- [x] T025 — CRUD de alumnos, docentes, apoderados y vínculos — `apps/api/src/modules/core/personas/`, `packages/shared/src/schemas/persona.ts`, `packages/shared/src/schemas/alumno.ts`, `packages/shared/src/schemas/docente.ts`, `packages/shared/src/schemas/apoderado.ts`, `packages/shared/src/contracts/persona.ts`, `packages/shared/src/contracts/alumno.ts`, `packages/shared/src/contracts/docente.ts`, `packages/shared/src/contracts/apoderado.ts`, `apps/api/test/core/personas.test.ts` — RF-CORE-012, RF-CORE-013, RF-CORE-014 — un principal por alumno; documento único; sin cuenta de usuario
- [x] T026 — Matrículas con unicidad por alumno y año — `apps/api/src/modules/core/matriculas/`, `packages/shared/src/schemas/matricula.ts`, `packages/shared/src/contracts/matricula.ts`, `apps/api/test/core/matricula.test.ts` — RF-CORE-015 — duplicado devuelve 409; retirada se conserva y no se reabre; aprobación exige un apoderado principal
- [x] T027 — Asignaciones docente–curso–sección–año — `apps/api/src/modules/core/estructura/`, `packages/shared/src/schemas/asignacion-docente.ts`, `packages/shared/src/contracts/asignacion-docente.ts`, `apps/api/test/core/asignacion-docente.test.ts` — RF-CORE-011 — duplicado devuelve 409; curso y sección deben ser coherentes con el nivel y el año
- [x] T028 — Pruebas de estructura: 3 y 4 períodos, año activo único, cierre y matrícula — `apps/api/test/core/estructura.test.ts` — RF-CORE-008 a RF-CORE-011, RF-CORE-015 — flujo integrado en verde

## Fase 5 — Auditoría y cierre

- [x] T029 — Servicio de auditoría transaccional con redacción de PII — `apps/api/src/core/audit.ts`, `apps/api/src/modules/core/personas/`, `apps/api/src/modules/core/matriculas/`, `apps/api/test/core/audit.test.ts` — RF-CORE-016 — operaciones sensibles registran usuario, entidad, acción e IP; credenciales y PII se redactan
- [x] T030 — Endpoint `GET /auditoria` para SA/DI con paginación y filtros — `apps/api/src/modules/core/auditoria/`, `packages/shared/src/schemas/auditoria.ts`, `packages/shared/src/contracts/auditoria.ts`, `apps/api/test/core/auditoria.test.ts` — RF-CORE-016 — docentes, apoderados y alumnos reciben 403
- [x] T031 — Pruebas de auditoría inmutable — `apps/api/test/core/auditoria.test.ts` — RF-CORE-016 — `POST`/`PATCH`/`PUT`/`DELETE` sobre `/auditoria` y `/auditoria/:id` devuelven 404 y el registro no cambia
- [x] T032 — Actualizar `docs/architecture.md` y marcar la spec como implementada — `docs/architecture.md`, `specs/core/001-spec-mvp/` — cierre — estado real documentado

> **T032 cerrada (2026-11-08):** `docs/architecture.md` refleja el frontend de autenticación, RF-CORE-017 y las cifras reales de pruebas; `spec.md` indica el alcance implementado. La Fase 7 queda como deuda técnica.

## Fase 6 — Frontend de autenticación

- [x] T033 — Instalar `react-router` y crear router, providers y layout base — `apps/web/src/app/`, `apps/web/src/features/auth/LoginPage.tsx`, `apps/web/src/App.tsx`, `apps/web/src/index.css`, `apps/web/src/App.test.tsx` — UX — la app monta con rutas `/login` y `/`
- [x] T034 — Cliente HTTP con token en memoria y refresh automático — `apps/web/src/shared/api/client.ts`, `apps/web/src/features/auth/AuthProvider.tsx`, `apps/web/src/features/auth/auth-context.ts`, `apps/web/src/features/auth/useAuth.ts`, `packages/shared/src/schemas/auth.ts`, `apps/web/src/shared/api/client.test.ts`, `apps/web/src/features/auth/AuthProvider.test.tsx` — RF-CORE-004, RF-CORE-006 — al recargar se restaura la sesión vía refresh; un `401` renueva y reintenta una sola vez
- [x] T035 — Pantalla de login con validación, estados y accesibilidad — `apps/web/src/features/auth/LoginPage.tsx`, `apps/web/src/features/auth/LoginPage.test.tsx` — RF-CORE-004 — errores visibles, foco y etiquetas correctas
- [x] T036 — Pantalla de recuperación de contraseña — `apps/web/src/features/auth/ForgotPasswordPage.tsx`, `apps/web/src/features/auth/ForgotPasswordPage.test.tsx`, `apps/web/src/app/routes.tsx` — RF-CORE-007 — mensaje neutro que no revela si el correo existe
- [x] T037 — Guard de rutas y redirección por rol — `apps/web/src/app/guards/RequireAuth.tsx`, `apps/web/src/app/guards/RequireAuth.test.tsx`, `apps/web/src/app/routes.tsx`, `apps/web/src/App.test.tsx` — RF-CORE-005 — sin sesión redirige a `/login`; con rol no admitido redirige al panel
- [x] T038 — Pruebas de login, recuperación y guard — `apps/web/src/features/auth/auth-flow.test.tsx` — RF-CORE-004, RF-CORE-005, RF-CORE-007 — navegación login↔recuperación, login feliz, credenciales inválidas y guard con ruta de origen en verde
- [x] T039 — Cambio obligatorio de contraseña, PIN temporal y política mínima — `apps/api/src/modules/core/auth/`, `packages/shared/src/schemas/auth.ts`, `packages/shared/src/contracts/auth.ts`, `apps/web/src/features/auth/ChangePasswordPage.tsx`, `apps/web/src/features/auth/ChangePasswordPage.test.tsx`, `apps/api/test/core/change-password.test.ts`, `apps/api/test/core/pin.test.ts` — RF-CORE-017 — PIN temporal, bloqueo hasta cambio y revocación de sesiones

## Fase 7 — Deuda técnica identificada

> Tareas descubiertas durante la implementación. No forman parte del alcance original de la spec.

- [x] T040 — Definir la estrategia de empaquetado y consumo de `packages/shared` — `packages/shared/`, `apps/api/tsconfig.json`, `apps/web/tsconfig.app.json`, `package.json` — infra — `npm run build` produce un `dist` de la API ejecutable con Node y sin referencias a TypeScript en tiempo de ejecución
- [ ] T041 — Estabilizar el gate: fijar `testTimeout` de Vitest por encima del valor por defecto para tolerar la contención de CPU que hace fallar intermitentemente `test/core/password.test.ts` (Argon2) — `apps/api/vitest.config.ts` — infra — `npm test` pasa de forma consecutiva con el equipo cargado, sin fallos intermitentes
- [ ] T042 — Borrado lógico de años académicos, bloqueado cuando el año tenga períodos con calificaciones — `apps/api/src/modules/core/estructura/` — RF-CORE-008 — requiere que el módulo académico exponga si un período tiene calificaciones; la tabla de endpoints de la spec §7 aún no define `DELETE /anios-academicos`
- [ ] T043 — CRUD de cuentas de usuario y asignación de roles — `apps/api/src/modules/core/usuarios/`, `packages/shared/src/schemas/usuario.ts`, `packages/shared/src/contracts/usuario.ts`, `apps/api/test/core/usuarios.test.ts` — RF-CORE-002 — alta con PIN temporal, baja lógica, activación y roles múltiples; el Director no puede crear SuperAdmins; fuera del alcance de T025

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
| 2026-11-05 | Todas | Spec en revisión: Q1–Q4 sin resolver | resuelto |
| 2026-11-05 | — | Spec aprobada v1.0.0; sin bloqueos | — |
| 2026-11-06 | T042 | Requiere el modelo de calificaciones del módulo académico y un contrato `DELETE` en la spec §7 | bloqueado |
| 2026-11-07 | T032 | El cierre de la spec espera T033–T039 y RF-CORE-017; `docs/architecture.md` ya está actualizado | en espera |
