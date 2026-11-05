# Arquitectura del Proyecto

> Documento técnico de referencia. Las reglas normativas están en `docs/constitution.md`.
> Última actualización: 2026-11-05.

## 1. Estado actual vs. objetivo

| Área | Estado actual | Pendiente |
|---|---|---|
| Repositorio | Monorepo con workspaces (`apps/web`, `apps/api`, `packages/shared`) | — |
| Frontend | React 19 + Vite 8 + TypeScript 6 + Tailwind 4; aún renderiza la plantilla de Vite | Reemplazar por la app real según specs |
| Backend | Fastify 5 con `GET /api/v1/health`, CORS y rate limit | Módulos de dominio, auth y RBAC |
| Base de datos | No configurada | Prisma + MySQL 8 en `specs/core` |
| Pruebas | Vitest 5 en web y api; Testing Library configurada | Playwright y pruebas de dominio |
| Specs | `specs/core/001-spec-mvp/` en revisión; 4 módulos vacíos | Resolver Q1–Q4 y aprobar `core` |
| Gobernanza | Constitución v2, plantillas, matriz RBAC y ADRs | Mantener sincronizada |

Comandos desde la raíz:

| Comando | Acción |
|---|---|
| `npm run dev` | Arranca web (5173) y api (3000) con concurrently |
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
│     │  ├─ core/               # config, db, auth, rbac, audit, errors
│     │  ├─ modules/
│     │  │  ├─ academic/
│     │  │  ├─ administrative/
│     │  │  ├─ communication/
│     │  │  └─ virtual-classroom/
│     │  └─ server.ts
│     └─ prisma/
│        ├─ schema.prisma
│        └─ migrations/
├─ packages/
│  └─ shared/
│     └─ src/
│        ├─ domain/             # tipos de entidades
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

## 4. Flujo de una petición

1. El cliente envía la petición con el token de acceso.
2. Fastify valida el token y resuelve el usuario y su rol.
3. El guard de RBAC verifica el permiso y el vínculo con el recurso.
4. El controller valida la entrada con Zod.
5. El service aplica las reglas de negocio.
6. El repository accede a MySQL vía Prisma.
7. La respuesta usa el sobre estándar de error o el DTO de `packages/shared`.
8. Se registra auditoría si la operación toca notas, pagos o datos personales.

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

- Login con correo y contraseña; hash `Argon2id`.
- Token de acceso de corta duración; refresh en cookie `httpOnly`.
- Guard de autenticación + guard de rol + verificación de vínculo con el recurso.
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

## 10. Decisiones pendientes

| Tema | Estado | Dónde se resuelve |
|---|---|---|
| Framework HTTP definitivo (Fastify) | Propuesto | ADR-0001 |
| Modelo de competencias vs. cursos | Abierto | `specs/academic/001-spec-mvp/` |
| Fórmula de nota final | Abierto | `specs/academic/001-spec-mvp/` |
| Umbral de alerta de inasistencias | Abierto | `specs/academic/001-spec-mvp/` |
| Almacenamiento de archivos en producción | Abierto | ADR antes de implementar aula virtual |
| Roles administrativos adicionales | Abierto | `specs/administrative/001-spec-mvp/` |
| Participación de alumnos en mensajería | Abierto | `specs/communication/001-spec-mvp/` |
| Prisma + MySQL | Pendiente | `specs/core/001-spec-mvp/` |
| Playwright y pruebas E2E | Pendiente | Primera feature con flujo completo |
