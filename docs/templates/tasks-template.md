# Plantilla de Tareas (`tasks.md`)

> Copia esta plantilla en `specs/<modulo>/<feature-folder>/tasks.md`.
> Requiere un `plan.md` aprobado. Una tarea se marca `[x]` solo con el gate en verde.

# Tareas: <Nombre de la feature>

| Campo | Valor |
|---|---|
| Spec | `specs/<modulo>/<feature-folder>/spec.md` |
| Plan | `specs/<modulo>/<feature-folder>/plan.md` |
| Estado | `en progreso` / `completado` |
| Fecha | `YYYY-MM-DD` |

## Convenciones

Formato obligatorio:

```md
- [ ] TNNN — <acción> — <archivo(s)> — <RF|RN> — <criterio de aceptación>
```

- Una tarea = un cambio verificable.
- Orden estrictamente secuencial salvo dependencias indicadas.
- Prohibido marcar `[x]` con tests en rojo.
- Si aparece trabajo nuevo, se agrega como tarea y se reporta.

## Fase 1 — Datos y contratos

- [ ] T001 — <acción> — <archivo(s)> — <RF|RN> — <criterio>
- [ ] T002 — ...

## Fase 2 — Backend

- [ ] T003 — ...
- [ ] T004 — ...

## Fase 3 — Frontend

- [ ] T005 — ...
- [ ] T006 — ...

## Fase 4 — Pruebas y cierre

- [ ] T007 — Pruebas de dominio e integración — ... — <RF|RN> — cobertura ≥ 70 %
- [ ] T008 — Prueba E2E del flujo principal — ... — <RF|RN> — flujo completo en verde

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
| | | | |
