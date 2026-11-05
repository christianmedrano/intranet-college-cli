# ADR-0003 — Escala literal y períodos configurables

- **Fecha:** 2026-11-05
- **Estado:** Aceptado
- **Decisores:** Dirección del proyecto

## Contexto

En el sistema educativo peruano, las actas oficiales registradas en SIAGIE usan la escala literal **AD / A / B / C** en todos los niveles, incluida Secundaria. Algunos colegios particulares conservan internamente una escala numérica 0–20 para comunicación con las familias, pero deben convertirla a literal para los documentos oficiales.

Por otro lado, el año lectivo se organiza habitualmente en 4 bimestres, pero la normativa permite 3 trimestres u otros esquemas. Codificar 4 períodos de forma fija impediría usar el sistema en colegios con calendario trimestral.

## Decisión

1. La escala canónica y única del MVP es **literal AD / A / B / C** para Inicial, Primaria y Secundaria.
2. El MVP **no** implementa escala numérica interna ni tablas de conversión.
3. Los períodos académicos son **configurables por año lectivo**: N períodos con nombre, orden, fechas y estado.

## Consecuencias

**Positivas**

- Los documentos oficiales son correctos por diseño.
- El sistema sirve a colegios bimestrales y trimestrales sin cambios de código.
- Se elimina el riesgo de conversiones incorrectas.

**Negativas**

- Los colegios que usan libretas numéricas internas necesitarán una feature futura.
- La configuración de períodos añade una pantalla administrativa.

## Reglas derivadas

- `Calificacion` se asocia a `PeriodoAcademico` y `AnioAcademico`.
- Cerrar un período bloquea la edición de notas; la corrección requiere permiso y auditoría.
- Prohibido hardcodear la cantidad de períodos.

## Alternativas descartadas

- **Solo 4 bimestres fijos:** excluye colegios trimestrales.
- **Escala configurable por nivel:** complejidad prematura y riesgo de inconsistencias con SIAGIE.
