# Arquitectura del Proyecto

> Documento técnico de referencia. Las reglas normativas están en `docs/constitution.md`.
> Última actualización: 2026-11-05.

## 1. Estado actual vs. objetivo

| Área | Estado actual | Objetivo |
|---|---|---|
| Repositorio | Proyecto Vite en la raíz (`src/`) | Monorepo con `apps/web`, `apps/api`, `packages/shared` |
| Frontend | Plantilla de Vite | React + TypeScript + Tailwind, feature-first |
| Backend | No existe | Fastify + Prisma + MySQL 8 |
| Base de datos | No configurada | `intranet_college` en MySQL 8.0.16+ |
| Pruebas | No configuradas | Vitest, Testing Library, Supertest, Playwright |
| Specs | Carpetas vacías | `core` + 4 módulos con spec/plan/tasks |
| Gobernanza | Constitución v2, plantillas y matriz RBAC | Mantener sincronizada |

La migración al monorepo se ejecuta en la Fase 3 del plan y en un commit aislado.

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
| Toolchain de lint: TypeScript 7.0.2 no es soportado por typescript-eslint 8.72 | Bloqueante | Decisión de dependencias (downgrade a TS 6.x o API side-by-side) |
