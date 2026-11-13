# Arquitectura del Proyecto

> Documento técnico de referencia. Las reglas normativas están en `docs/constitution.md`.
> Última actualización: 2026-11-13.

## 1. Estado actual vs. objetivo

| Área | Estado actual | Pendiente |
|---|---|---|
| Repositorio | Monorepo con workspaces (`apps/web`, `apps/api`, `packages/shared`) | — |
| Frontend | React 19 + Vite 8 + TypeScript 6 + Tailwind 4; router, sesión en memoria con refresh, login, recuperación, guard por rol y cambio de contraseña (T033–T039). Módulo académico: calificaciones/notas finales (T017), asistencias/justificaciones (T018), umbral/alertas/horarios (T019). Módulo administrativo: pagos, matrículas, certificados, plantillas | Playwright y pruebas E2E (T021) |
| Backend | Fastify 5 con el módulo `core` implementado bajo `/api/v1`: auth (incluido el cambio obligatorio de contraseña, RF-CORE-017), gestión de usuarios y roles (RF-CORE-002), RBAC, institución, años y períodos, niveles/grados/secciones/cursos, personas, matrículas, asignaciones y auditoría. Módulo académico completo bajo `/api/v1`: calificaciones, notas finales, asistencias, justificaciones, umbral, alertas, horarios. Módulo administrativo bajo `/api/v1` y `/api/v1/administrative`: pagos, matrículas administrativas, certificados, plantillas. `GET /health` fuera de `/api/v1` | Borrado lógico de años (T042) |
| Base de datos | MySQL 8 con Prisma 7, migración `core_init` y seed idempotente de roles, institución y SuperAdmin. Esquemas académico y administrativo aplicados | — |
| Pruebas | Vitest 5 en web y api. API: 54 suites y 701 pruebas; web: 21 suites y 126 pruebas. Cobertura de la API: ≥70 % en sentencias, ramas, funciones y líneas | Playwright y pruebas E2E (T021) |
| Specs | `specs/core/001-spec-mvp/` aprobada v1.2.0; API y frontend de autenticación implementados (T001–T039, T043). `specs/academic/001-spec-mvp/` aprobada v1.0.0; implementación completa (T001–T019). `specs/administrative/001-spec-mvp/` aprobada v1.0.0; implementación completa (T001–T035). `T044` de core cerrada (`es_tutor`) | T020 (cierre), T021 (E2E), T042 (deuda técnica) y 2 módulos vacíos |
| Gobernanza | Constitución v2, plantillas, matriz RBAC y ADRs | Mantener sincronizada |

Comandos desde la raíz:

| Comando | Acción |
|---|---|
| `npm run dev` | Arranca web (5173), api (3000) y compilación en watch de `shared` |
| `npm run dev:web` / `npm run dev:api` | Arranca solo una aplicación |
| `npm run build` | Compila todos los workspaces |
| `npm run lint` | ESLint sobre todo el repositorio |
| `npm run typecheck` | TypeScript en todos los workspaces |
| `npm test` | Vitest en web y api |

## 2. Estructura objetivo

```text
intranet-college-cli/
├─ apps/
│  ├─ web/
│  │  ├─ src/
│  │  │  ├─ app/                # router, providers, layouts, guards
│  │  │  ├─ features/
│  │  │  │  ├─ auth/
│  │  │  │  ├─ academic/
│  │  │  │  ├─ administrative/
│  │  │  │  ├─ communication/
│  │  │  │  └─ virtual-classroom/
│  │  │  └─ shared/             # ui, api client, hooks, lib
│  │  └─ index.html
│  └─ api/
│     ├─ src/
│     │  ├─ core/               # config, db, auth, rbac, audit, errors, validación
│     │  ├─ modules/
│     │  │  ├─ core/            # auth, estructura, personas, matrículas, auditoría
│     │  │  ├─ academic/
│     │  │  ├─ administrative/
│     │  │  ├─ communication/
│     │  │  └─ virtual-classroom/
│     │  └─ server.ts
│     ├─ prisma/
│     │  ├─ schema.prisma
│     │  └─ migrations/
│     └─ test/core/             # pruebas de API con Vitest + Supertest
├─ packages/
│  └─ shared/
│     └─ src/
│        ├─ domain/             # permisos y tipos de dominio
│        ├─ schemas/            # Zod
│        └─ contracts/          # DTOs de API
├─ specs/
├─ docs/
└─ package.json                 # workspaces
```

## 3. Reglas de dependencia

```text
apps/web  ──imports──▶  packages/shared  ◀──imports──  apps/api
    │                                                      │
    └──────────── HTTP /api/v1 ────────────────────────────┘
```

- `apps/web` y `apps/api` nunca se importan entre sí.
- `packages/shared` no importa de ninguna app.
- Una feature no importa de otra feature.
- `specs/core` define las entidades raíz; los módulos las consumen.
- La lógica de negocio autoritativa vive en `apps/api`.
- `packages/shared` se compila a `dist` (ESM + declaraciones) y se consume como paquete. `npm install`, `npm run build` y `npm run typecheck` lo compilan antes que web y api; `npm run dev` lo deja en modo watch.

## 4. Flujo de una petición

1. El cliente envía la petición con el token de acceso.
2. Fastify valida el token y resuelve el usuario y sus roles; los permisos de todos los roles se unen.
3. El guard de RBAC verifica el permiso y el vínculo con el recurso.
4. El controller valida la entrada con Zod.
5. El service aplica las reglas de negocio.
6. El repository accede a MySQL vía Prisma.
7. La respuesta usa el sobre estándar de error o el DTO de `packages/shared`.
8. Si la operación toca datos personales, matrículas o usuarios, el service abre una transacción y `registrarAuditoria` inserta el registro dentro de ella. Credenciales y PII se sustituyen por `[REDACTADO]`; si la operación falla, la auditoría también se revierte.

## 5. Convenciones de API

- Prefijo versionado: `/api/v1`.
- Recursos en plural y `kebab-case`: `/api/v1/periodos-academicos`.
- Verbos HTTP estándar: `GET`, `POST`, `PATCH`, `DELETE` (borrado lógico).
- Paginación: `?page=1&pageSize=20`, con `meta: { page, pageSize, total }`.
- Filtros por query string explícitos y validados.
- Fechas en ISO 8601 UTC.

Sobre de error:

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "No tienes permiso para ver este recurso.",
    "details": []
  }
}
```

Códigos: `VALIDATION_ERROR` (400), `UNAUTHORIZED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `CONFLICT` (409), `RATE_LIMITED` (429), `INTERNAL_ERROR` (500).

## 6. Base de datos

- MySQL 8.0.16+, motor InnoDB, `utf8mb4` / `utf8mb4_0900_ai_ci`.
- Prisma como única vía de acceso.
- Migraciones con `prisma migrate dev` en local y `prisma migrate deploy` en despliegue.
- UUID como clave primaria, generado en la aplicación.
- Borrado lógico en entidades históricas.
- Sin `FLOAT` para dinero: `DECIMAL(10,2)`.

Restricciones que MySQL no cubre igual que PostgreSQL:

- No hay índices parciales: se resuelven con índices únicos compuestos y validación en el servicio.
- `CHECK` se aplica desde 8.0.16; además se valida con Zod.

## 7. Autenticación y autorización

- Login multicampo con usuario, correo o número de documento; hash `Argon2id`.
- Token de acceso JWT firmado con `jose`; refresh opaco con hash SHA-256 en `SesionRefresh` y cookie `httpOnly`, `SameSite=Lax`, path `/api/v1/auth`, `Secure` en producción.
- El login limita los intentos fallidos por `IP + identificador` (ventana fija de 15 minutos, máximo 5); un acceso correcto reinicia el contador.
- La recuperación de contraseña usa un token de un solo uso emitido por administración; no hay envío de correo en el MVP.
- Mientras `debeCambiarPassword` esté activo, `requirePermission` responde `403` en todo recurso de negocio; solo quedan disponibles los endpoints de autenticación. El cambio de contraseña aplica la política mínima y revoca todas las sesiones (RF-CORE-017).
- Guard de autenticación + guard de permiso + verificación de vínculo con el recurso (`vinculo.ts`, no como `preHandler`).
- La matriz de permisos está en `docs/rbac-matrix.md`.
- El frontend usa guards solo para UX; el backend siempre revalida.

## 8. Archivos y materiales del aula virtual

- Almacenamiento local en desarrollo; en producción se define en un ADR antes de implementar.
- Lista blanca de tipos: PDF, DOCX, XLSX, PPTX, imágenes.
- Tamaño máximo configurable por variable de entorno.
- Nombre saneado y ruta no predecible.
- Descarga sujeta a RBAC y al vínculo con el curso.

## 9. Estrategia de pruebas

| Nivel | Herramienta | Qué cubre |
|---|---|---|
| Dominio | Vitest | Reglas de negocio, períodos, escalas, permisos |
| API | Vitest + Supertest | Contratos, validación, RBAC, errores |
| UI | Testing Library | Formularios, estados, accesibilidad básica |
| E2E | Playwright | Login, notas, asistencia, pagos |

Los tests de dominio no dependen de la base de datos. Los de API usan una base de datos de prueba aislada.

Estado actual: 43 suites y 541 pruebas de API en verde, más 10 suites y 60 pruebas de frontend. Cobertura de sentencias de la API 91,6 %, ramas 80,5 % (última medición tras T019; umbral mínimo 70 %). Las pruebas corren en serie (`fileParallelism: false`) para no saturar MySQL.

## 10. Decisiones pendientes

| Tema | Estado | Dónde se resuelve |
|---|---|---|
| Framework HTTP definitivo (Fastify) | Adoptado e implementado | `docs/stack.md` |
| Modelo de competencias vs. cursos | Resuelto (2026-11-08): calificación literal por curso | `specs/academic/001-spec-mvp/` |
| Fórmula de nota final | Resuelto (2026-11-08): registro manual del docente, sin cálculo | `specs/academic/001-spec-mvp/` |
| Umbral de alerta de inasistencias | Resuelto (2026-11-08): configurable por año, sin valor por defecto | `specs/academic/001-spec-mvp/` |
| Almacenamiento de archivos en producción | Abierto | ADR antes de implementar aula virtual |
| Roles administrativos adicionales | Abierto | `specs/administrative/001-spec-mvp/` |
| Participación de alumnos en mensajería | Abierto | `specs/communication/001-spec-mvp/` |
| Prisma + MySQL | Resuelto e implementado | ADR-0002 y `specs/core/001-spec-mvp/` |
| Playwright y pruebas E2E | Pendiente (T021) | Primera feature con flujo completo |
| Cierre del módulo académico (T001–T019) | Resuelto (2026-11-11) | `specs/academic/001-spec-mvp/` |
| Cierre de la spec `core` (T042) | Bloqueado (falta autorizar `DELETE /anios-academicos/:id` en spec §7) | `specs/core/001-spec-mvp/` |
