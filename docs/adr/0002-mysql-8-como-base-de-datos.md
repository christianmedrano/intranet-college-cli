# ADR-0002 — MySQL 8 como base de datos

- **Fecha:** 2026-11-05
- **Estado:** Aceptado
- **Decisores:** Dirección del proyecto

## Contexto

La constitución original proponía PostgreSQL. El equipo ya tiene MySQL 8 instalado y en ejecución local, y no tiene experiencia previa con PostgreSQL. El volumen esperado (una institución, miles de alumnos) no exige capacidades avanzadas de PostgreSQL.

## Decisión

Usar **MySQL 8.0.16+** con motor InnoDB, charset `utf8mb4` y colación `utf8mb4_0900_ai_ci`.

## Consecuencias

**Positivas**

- Entorno local ya disponible y conocido.
- Hosting ampliamente disponible.
- Prisma soporta MySQL de forma nativa.
- Soporte de `CHECK` desde 8.0.16, CTEs y funciones de ventana.

**Negativas y mitigaciones**

| Limitación | Mitigación |
|---|---|
| Sin índices parciales | Índices únicos compuestos + validación en el servicio |
| DDL no transaccional | Migraciones forward-only; respaldo antes de migrar |
| JSON no indexable como JSONB | El MVP no requiere JSON indexado |
| UUID sin tipo nativo | `CHAR(36)` generado por Prisma |

## Requisitos derivados

- Montos en `DECIMAL(10,2)`, nunca `FLOAT`.
- Fechas en UTC.
- `prisma migrate deploy` en despliegue; `db push` solo en local.

## Alternativas descartadas

- **PostgreSQL:** técnicamente superior en varios aspectos, pero añade fricción sin beneficio para el alcance del MVP.
- **SQLite:** insuficiente para concurrencia y despliegue multiusuario.
