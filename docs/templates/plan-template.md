# Plantilla de Plan Técnico (`plan.md`)

> Copia esta plantilla en `specs/<modulo>/<feature-folder>/plan.md`.
> Requiere una `spec.md` aprobada. No se escribe código sin `plan.md` aprobado.

# Plan Técnico: <Nombre de la feature>

| Campo | Valor |
|---|---|
| Spec asociada | `specs/<modulo>/<feature-folder>/spec.md` |
| Versión | `0.1.0` |
| Estado | `borrador` / `aprobado` |
| Fecha | `YYYY-MM-DD` |

## 1. Resumen

En 3–5 líneas: qué se construye y cuál es la estrategia técnica.

## 2. Constitution Check

| Principio | Cumple | Observación |
|---|---|---|
| Precedencia y alcance del MVP | Sí / No | |
| Arquitectura y límites entre features | Sí / No | |
| Datos: UUID, auditoría, borrado lógico | Sí / No | |
| Escala literal AD/A/B/C | Sí / No | |
| Períodos configurables (sin hardcodeo) | Sí / No | |
| RBAC validado en backend | Sí / No | |
| Privacidad (sin PII en logs) | Sí / No | |
| Tests como puerta | Sí / No | |
| Accesibilidad y estados de UI | Sí / No | |

> Un solo `No` bloquea la aprobación del plan.

## 3. Arquitectura de la feature

- Capas afectadas: `apps/web` / `apps/api` / `packages/shared` / base de datos.
- Componentes, servicios y endpoints involucrados.
- Diagrama de flujo si aporta claridad.

## 4. Modelo de datos y migraciones

| Cambio | Tabla / modelo | Tipo | Reversible |
|---|---|---|---|
| | | crear / alterar / índice | Sí / No |

- Migración: `prisma migrate dev --name <nombre>`.
- Impacto en datos existentes: ...
- Estrategia de rollback: ...

## 5. Contratos de API

| Método | Ruta | Request (Zod) | Response (DTO) | Permiso |
|---|---|---|---|---|
| | | | | |

## 6. Dependencias nuevas

| Paquete | Motivo | Alternativa nativa evaluada | Aprobación |
|---|---|---|---|
| | | | pendiente |

Si no hay dependencias nuevas, escribir: «Ninguna».

## 7. Estrategia de pruebas

| Nivel | Casos |
|---|---|
| Dominio | |
| API | |
| UI | |
| E2E | |

## 8. Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| | | |

## 9. Orden de implementación

1. ...
2. ...

## 10. Trazabilidad requisito → tarea

| Requerimiento | Tarea prevista |
|---|---|
| `RF-<MOD>-001` | `T001` |

## 11. Notas de implementación

Decisiones que el agente debe respetar y que no son obvias desde la spec.
