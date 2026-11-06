# Tareas: Núcleo del Dominio y Autenticación

| Campo | Valor |
|---|---|
| Spec | `specs/core/001-spec-mvp/spec.md` |
| Plan | `specs/core/001-spec-mvp/plan.md` |
| Estado | `lista para ejecutar` |
| Fecha | 2026-11-05 |

> Spec aprobada v1.0.0. Ejecutar las tareas en orden; no iniciar una sin el gate de la anterior en verde.

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
- [ ] T018 — Guards de vínculo: apoderado–alumno, docente–curso/sección, alumno propio — `apps/api/src/core/auth/vinculo.ts` — RF-CORE-003, RF-CORE-011, RF-CORE-014 — acceso ajeno devuelve 403
- [ ] T019 — Pruebas de RBAC por rol y de vínculos — `apps/api/test/core/rbac.test.ts` — RF-CORE-003, RF-CORE-011, RF-CORE-014 — matriz cubierta en casos feliz y prohibido

## Fase 4 — Estructura académica y personas

- [ ] T020 — Endpoints `GET` y `PATCH /institucion` — `apps/api/src/modules/core/estructura/` — RF-CORE-001 — solo SA/DI; docente recibe 403
- [ ] T021 — CRUD de años académicos y activación única transaccional — `apps/api/src/modules/core/estructura/` — RF-CORE-008 — activar uno cierra el anterior
- [ ] T022 — CRUD de períodos, cierre y bloqueo de edición — `apps/api/src/modules/core/estructura/` — RF-CORE-009 — soporta N períodos; cerrado no se elimina
- [ ] T023 — CRUD de niveles, grados y secciones — `apps/api/src/modules/core/estructura/` — RF-CORE-010 — únicos por grado/año
- [ ] T024 — CRUD de cursos — `apps/api/src/modules/core/estructura/` — RF-CORE-011 — únicos por nivel
- [ ] T025 — CRUD de alumnos, docentes, apoderados y vínculos — `apps/api/src/modules/core/personas/` — RF-CORE-012, RF-CORE-013, RF-CORE-014 — un principal por alumno; documento único
- [ ] T026 — Matrículas con unicidad por alumno y año — `apps/api/src/modules/core/matriculas/` — RF-CORE-015 — duplicado devuelve 409; retirada se conserva
- [ ] T027 — Asignaciones docente–curso–sección–año — `apps/api/src/modules/core/estructura/` — RF-CORE-011 — docente sin asignación no accede
- [ ] T028 — Pruebas de estructura: 3 y 4 períodos, año activo único, cierre y matrícula — `apps/api/test/core/estructura.test.ts` — RF-CORE-008 a RF-CORE-011, RF-CORE-015 — todos los casos en verde

## Fase 5 — Auditoría y cierre

- [ ] T029 — Servicio de auditoría transaccional con redacción de PII — `apps/api/src/core/audit.ts` — RF-CORE-016 — toda operación sensible registra usuario, entidad y acción
- [ ] T030 — Endpoint `GET /auditoria` para SA/DI con paginación y filtros — `apps/api/src/modules/core/auditoria/` — RF-CORE-016 — docentes y apoderados reciben 403
- [ ] T031 — Pruebas de auditoría inmutable — `apps/api/test/core/auditoria.test.ts` — RF-CORE-016 — no existe endpoint de edición o borrado
- [ ] T032 — Actualizar `docs/architecture.md` y marcar la spec como implementada — `docs/architecture.md`, `specs/core/001-spec-mvp/` — cierre — estado real documentado

## Fase 6 — Frontend de autenticación

- [ ] T033 — Instalar `react-router` y crear router, providers y layout base — `apps/web/src/app/` — UX — la app monta con rutas `/login` y `/`
- [ ] T034 — Cliente HTTP con token en memoria y refresh automático — `apps/web/src/shared/api/client.ts`, `apps/web/src/features/auth/AuthProvider.tsx` — RF-CORE-004, RF-CORE-006 — al recargar se restaura la sesión vía refresh
- [ ] T035 — Pantalla de login con validación, estados y accesibilidad — `apps/web/src/features/auth/LoginPage.tsx` — RF-CORE-004 — errores visibles, foco y etiquetas correctas
- [ ] T036 — Pantalla de recuperación de contraseña — `apps/web/src/features/auth/ForgotPasswordPage.tsx` — RF-CORE-007 — mensaje neutro que no revela si el correo existe
- [ ] T037 — Guard de rutas y redirección por rol — `apps/web/src/app/guards/RequireAuth.tsx` — RF-CORE-005 — sin sesión redirige a `/login`
- [ ] T038 — Pruebas de login, recuperación y guard — `apps/web/src/features/auth/*.test.tsx` — RF-CORE-004, RF-CORE-005, RF-CORE-007 — casos feliz y error en verde
- [ ] T039 — Cambio obligatorio de contraseña, PIN temporal y política mínima — `apps/api/src/modules/core/auth/`, `apps/web/src/features/auth/ChangePasswordPage.tsx` — RF-CORE-017 — PIN temporal, bloqueo hasta cambio y revocación de sesiones

## Fase 7 — Deuda técnica identificada

> Tareas descubiertas durante la implementación. No forman parte del alcance original de la spec.

- [x] T040 — Definir la estrategia de empaquetado y consumo de `packages/shared` — `packages/shared/`, `apps/api/tsconfig.json`, `apps/web/tsconfig.app.json`, `package.json` — infra — `npm run build` produce un `dist` de la API ejecutable con Node y sin referencias a TypeScript en tiempo de ejecución
- [ ] T041 — Estabilizar el gate: fijar `testTimeout` de Vitest por encima del valor por defecto para tolerar la contención de CPU que hace fallar intermitentemente `test/core/password.test.ts` (Argon2) — `apps/api/vitest.config.ts` — infra — `npm test` pasa de forma consecutiva con el equipo cargado, sin fallos intermitentes

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
