# Intranet Escolar

Intranet para una institución educativa de los niveles **Inicial, Primaria y Secundaria**, desarrollada con **Spec-Driven Development (SDD)**: ninguna funcionalidad se implementa si no está especificada y aprobada.

## Alcance del MVP

- **Core:** entidades del dominio, autenticación, roles y auditoría.
- **Académico:** calificaciones, asistencias y horarios.
- **Administrativo:** pagos (registro y consulta), matrículas y certificados.
- **Comunicación:** anuncios y mensajería docente ↔ apoderado.
- **Aula virtual:** materiales por curso y período.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 19 + TypeScript + Vite + Tailwind CSS |
| Backend | Node.js + Fastify + TypeScript |
| ORM | Prisma |
| Base de datos | MySQL 8.0.16+ |
| Validación | Zod |
| Pruebas | Vitest + Testing Library + Supertest + Playwright |

## Estructura

```text
apps/
  web/        Frontend
  api/        Backend
packages/
  shared/     Tipos, schemas Zod y contratos
specs/        Especificaciones (fuente de verdad)
docs/         Gobernanza, arquitectura, plantillas y ADRs
```

> **Estado actual:** monorepo operativo con `apps/web` y `apps/api`. El frontend aún renderiza la plantilla de Vite. La base de datos MySQL ya está configurada y el esquema se gestiona con Prisma Migrate. Consulta `docs/architecture.md` para el detalle.

## Requisitos

- Node.js 20.19+ o 22.12+ (probado con 26.13 LTS)
- npm 10 o superior
- MySQL 8.0.16 o superior

## Puesta en marcha

```bash
npm install
npm run dev
```

Servicios:

| Servicio | URL |
|---|---|
| Frontend | http://localhost:5173 |
| API | http://localhost:3000/api/v1/health |

## Base de datos

1. Crea las bases y un usuario dedicado. `intranet_shadow` la usa `prisma migrate dev` e `intranet_college_test` las pruebas de integración:

```sql
CREATE DATABASE IF NOT EXISTS intranet_college
  CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE DATABASE IF NOT EXISTS intranet_shadow
  CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE DATABASE IF NOT EXISTS intranet_college_test
  CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE USER IF NOT EXISTS 'intranet_app'@'localhost'
  IDENTIFIED BY 'TU_CLAVE';

GRANT ALL PRIVILEGES ON intranet_college.* TO 'intranet_app'@'localhost';
GRANT CREATE, ALTER, DROP, INDEX, REFERENCES, SELECT, INSERT, UPDATE, DELETE
  ON intranet_shadow.* TO 'intranet_app'@'localhost';
GRANT ALL PRIVILEGES ON intranet_college_test.* TO 'intranet_app'@'localhost';
FLUSH PRIVILEGES;
```

2. Copia `apps/api/.env.example` a `apps/api/.env` y ajusta `DATABASE_URL`, `SHADOW_DATABASE_URL`, `TEST_DATABASE_URL`, `JWT_SECRET` y las variables `SEED_ADMIN_*`.

3. Aplica las migraciones y carga los datos semilla:

```bash
npm run db:deploy  -w @intranet/api
npm run db:seed    -w @intranet/api
```

4. Prepara la base de pruebas (una vez, y tras cada migración nueva):

```bash
npm run db:test:deploy -w @intranet/api
```

El seed crea los 5 roles, una institución de ejemplo y el `SuperAdmin` definido en `SEED_ADMIN_*`. Es idempotente: no sobrescribe la contraseña de un usuario existente ni los datos editados de la institución. El `SuperAdmin` se crea con `debe_cambiar_password = true`, por lo que deberá cambiar la clave en su primer acceso.

> El seed nunca se ejecuta con `NODE_ENV=production`.

Scripts disponibles:

| Script | Descripción |
|---|---|
| `npm run dev` | Arranca frontend, API y `shared` en modo watch |
| `npm run dev:web` | Solo frontend |
| `npm run dev:api` | Solo API |
| `npm run build` | Compila todos los workspaces |
| `npm run lint` | Análisis estático |
| `npm run typecheck` | Verificación de tipos |
| `npm test` | Pruebas de web y API |
| `npm run preview` | Vista previa del build del frontend |

## Documentación

| Documento | Contenido |
|---|---|
| [`docs/constitution.md`](docs/constitution.md) | Reglas inquebrantables del proyecto |
| [`docs/architecture.md`](docs/architecture.md) | Arquitectura y estado del repositorio |
| [`docs/stack.md`](docs/stack.md) | Dependencias aprobadas |
| [`docs/glossary.md`](docs/glossary.md) | Vocabulario del dominio escolar |
| [`docs/rbac-matrix.md`](docs/rbac-matrix.md) | Matriz de permisos por rol |
| [`AGENTS.md`](AGENTS.md) | Protocolo de trabajo para agentes de IA |
| [`CLAUDE.md`](CLAUDE.md) | Adaptador para Claude Code |

## Flujo de trabajo

1. `spec.md` — qué se construye y con qué reglas.
2. `plan.md` — cómo se implementa, con Constitution Check.
3. `tasks.md` — tareas atómicas con ID de requerimiento.
4. Implementación con el gate `lint + typecheck + test` en verde.

Las plantillas están en `docs/templates/`.
