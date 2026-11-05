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

> **Estado actual:** el frontend aún vive en la raíz (`src/`) como plantilla de Vite. La migración al monorepo está planificada y se ejecutará en un commit aislado. Consulta `docs/architecture.md` para el estado real.

## Requisitos

- Node.js 20 LTS o superior
- npm 10 o superior
- MySQL 8.0.16 o superior

## Puesta en marcha (estado actual)

```bash
npm install
npm run dev
```

Scripts disponibles:

| Script | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Compilación de producción |
| `npm run lint` | Análisis estático |
| `npm run typecheck` | Verificación de tipos |
| `npm run preview` | Vista previa del build |

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
