# Plantilla de Especificación (`spec.md`)

> Copia esta plantilla en `specs/<modulo>/<feature-folder>/spec.md`.
> Elimina las instrucciones entre paréntesis y adapta el contenido.
> Una spec no se implementa hasta estar aprobada.

# Especificación: <Nombre de la feature>

| Campo | Valor |
|---|---|
| ID | `<MOD>-001` |
| Módulo | `<core / academic / administrative / communication / virtual-classroom>` |
| Versión | `0.1.0` |
| Estado | `borrador` / `en revisión` / `aprobada` |
| Autor | |
| Fecha | `YYYY-MM-DD` |

## 1. Contexto

¿Qué problema resuelve y por qué es prioritario para el MVP?

## 2. Alcance

### Incluye

- ...

### No incluye

- ...

## 3. Actores y permisos

| Actor | Puede hacer | No puede hacer |
|---|---|---|
| | | |

Referencia obligatoria a `docs/rbac-matrix.md`. Si un permiso no está en la matriz, se detiene la spec y se actualiza la matriz primero.

## 4. Requerimientos funcionales

Formato: `RF-<MOD>-NNN`. Cada uno con criterios de aceptación en Given/When/Then.

### RF-<MOD>-001 — <título>

**Descripción:** ...

**Criterios de aceptación:**

- **Dado** <contexto>
- **Cuando** <acción>
- **Entonces** <resultado observable>

### RF-<MOD>-002 — <título>

...

## 5. Reglas de negocio

Formato: `RN-<MOD>-NNN`. Toda regla debe poder verificarse con una prueba.

- `RN-<MOD>-001`: ...
- `RN-<MOD>-002`: ...

> Si una regla no está confirmada, no se asume: se registra en §10.

## 6. Modelo de datos

### Entidades nuevas

| Entidad | Campos | Relaciones | Restricciones |
|---|---|---|---|
| | | | |

### Entidades existentes que se consumen

- `Alumno` (definida en `specs/core`)
- ...

Reglas de la constitución aplicables: UUID, auditoría, borrado lógico, `DECIMAL` para dinero, fechas en UTC.

## 7. Contratos de API

| Método | Ruta | Permiso | Entrada | Salida | Errores |
|---|---|---|---|---|---|
| `GET` | `/api/v1/...` | | | | |

Los DTO y schemas Zod se definen en `packages/shared`.

## 8. Casos borde y errores

| Caso | Comportamiento esperado |
|---|---|
| | |

## 9. Dependencias

- Módulos de los que depende: ...
- Features previas requeridas: ...
- Dependencias nuevas propuestas: ... (requiere aprobación)

## 10. Preguntas abiertas

| Pregunta | Necesita respuesta de | Estado |
|---|---|---|
| | Dirección / Administración | abierta |

> Ninguna pregunta abierta puede quedar sin resolver antes de aprobar la spec.

## 11. Trazabilidad

| Requerimiento | Tarea(s) en `tasks.md` |
|---|---|
| `RF-<MOD>-001` | `T001` |
