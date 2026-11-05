# Claude — Intranet Escolar

Cumple, en este orden, las instrucciones de:

1. `docs/constitution.md`
2. `AGENTS.md`

Este archivo solo añade comportamiento específico de Claude Code:

- Usa plan mode antes de cualquier cambio que afecte más de un archivo.
- No modifiques `specs/`, `docs/constitution.md`, `docs/rbac-matrix.md` ni `docs/stack.md` sin autorización explícita.
- Trabaja una tarea atómica a la vez y no avances con tests en rojo.
- Al cerrar una tarea, muestra el diff resumido, el resultado del gate y los pendientes.
