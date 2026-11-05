# ADR-0001 — Monorepo con npm workspaces

- **Fecha:** 2026-11-05
- **Estado:** Aceptado
- **Decisores:** Dirección del proyecto

## Contexto

El proyecto incluye frontend (React + Vite), backend (Node + Fastify), base de datos y contratos compartidos. Los tipos de dominio, los schemas Zod y los DTO de API deben ser idénticos en cliente y servidor. Mantener repositorios separados obliga a duplicar contratos o publicar paquetes internos.

## Decisión

Usar un monorepo con **npm workspaces**:

```text
apps/web      # React + Vite + TypeScript + Tailwind
apps/api      # Fastify + Prisma + MySQL
packages/shared  # tipos, schemas Zod y contratos
```

## Consecuencias

**Positivas**

- Un solo `npm install` y un solo lockfile.
- Los contratos se importan desde `packages/shared` sin publicar nada.
- Refactors de contrato y consumidor en el mismo commit.
- Gate de calidad unificado desde la raíz.

**Negativas**

- Mayor complejidad inicial de configuración.
- Requiere disciplina en los límites de dependencias.
- El pipeline de CI debe construirse por workspace.

## Alternativas descartadas

- **Repositorios separados:** duplicación de contratos y fricción de versionado.
- **Carpetas `src/` y `server/` en la raíz:** simple, pero sin aislamiento de dependencias ni builds independientes.
