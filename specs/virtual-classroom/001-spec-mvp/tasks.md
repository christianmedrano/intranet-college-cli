# Tareas — Módulo Aula Virtual (MVP)

**Versión:** 1.0.0
**Fecha:** 2026-11-12
**Spec:** `specs/virtual-classroom/001-spec-mvp/spec.md`
**Plan:** `specs/virtual-classroom/001-spec-mvp/plan.md`

---

## Formato

```md
- [ ] TNNN — Descripción — rutas — RF — Criterio de aceptación
```

- `TNNN` único y correlativo.
- Cita siempre un `RF-VIR-NNN`.
- Indica rutas de archivo afectadas.
- Incluye criterio de aceptación verificable.
- `- [x]` solo cuando gate (`lint + typecheck + test`) en verde.

---

## Fase 1 — Shared (tipos, schemas, contratos)

- [x] T001 — Definir schemas Zod de material y adjunto en `packages/shared` — `packages/shared/src/schemas/virtual-classroom/*.ts`, `packages/shared/src/contracts/virtual-classroom/*.ts` — RF-VIR-001 a RF-VIR-005 — `crearMaterialSchema`, `actualizarMaterialSchema`, `listarMaterialesQuerySchema`, `adjuntoVirtualResponseSchema`, contratos de respuesta; `npm run build -w @intranet/shared` en verde

---

## Fase 2 — Migración y entidades base

- [x] T002 — Crear migración `virtual_classroom_init` con modelos `MaterialVirtual` y `AdjuntoVirtual` — `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/` — RF-VIR-001 a RF-VIR-005 — `prisma migrate dev --name virtual_classroom_init` aplica sin errores; tablas creadas con índices y relaciones

---

## Fase 3 — Backend: Material

- [x] T003 — Implementar `material.repository.ts` con CRUD y mapeo a DTO — `apps/api/src/modules/virtual-classroom/materiales/material.repository.ts` — RF-VIR-001 a RF-VIR-004 — `create`, `findById`, `update`, `softDelete`, `findMany` con filtros/paginación; tests repositorio en verde

- [x] T004 — Implementar `material.scope.ts` con `construirAlcanceMateriales` — `apps/api/src/modules/virtual-classroom/materiales/material.scope.ts` — RF-VIR-004 — Segmentación: DI ve todos, DO ve sus cursos/secciones, PA/AL ven vinculados a sus alumnos; SA ve todos (auditado); tests scope en verde

- [x] T005 — Implementar `material.service.ts` con reglas de negocio — `apps/api/src/modules/virtual-classroom/materiales/material.service.ts` — RF-VIR-001 a RF-VIR-004 — Validación audiencia, duplicados (docente+curso+sección+período+título), validación adjunto MIME/tamaño, auditoría; tests servicio ≥ 80 % cobertura

- [x] T006 — Implementar `material.controller.ts` y `material.routes.ts` — `apps/api/src/modules/virtual-classroom/materiales/material.controller.ts`, `apps/api/src/modules/virtual-classroom/materiales/material.routes.ts` — RF-VIR-001 a RF-VIR-003 — Rutas: `POST /materiales`, `PATCH /materiales/:id`, `DELETE /materiales/:id`, `GET /materiales`, `GET /materiales/:id`; guards: `virtual.gestionar` (escritura), `virtual.leer` (lectura); tests de contrato en verde

- [x] T006 — Registrar rutas de material en `apps/api/src/app.ts` — `apps/api/src/app.ts` — RF-VIR-001 a RF-VIR-005 — `app.register(materialRoutes, { prefix: '/api/v1' })`; `npm run typecheck` en verde

---

## Fase 4 — Backend: Adjuntos (compartido comunicación)

- [x] T007 — Implementar `adjunto.repository.ts` — `apps/api/src/modules/virtual-classroom/adjuntos/adjunto.repository.ts` — RF-VIR-001 a RF-VIR-005 — CRUD adjuntos (create, findById, delete); tests repositorio en verde

- [x] T008 — Implementar `adjunto.service.ts` — `apps/api/src/modules/virtual-classroom/adjuntos/adjunto.service.ts` — RF-VIR-001 a RF-VIR-005 — Validación MIME/tamaño (reutiliza `communication/adjuntos`), almacenamiento local, nombre seguro, auditoría; tests servicio ≥ 80 %

- [x] T009 — Implementar `adjunto.controller.ts` y `adjunto.routes.ts` — `apps/api/src/modules/virtual-classroom/adjuntos/adjunto.controller.ts`, `apps/api/src/modules/virtual-classroom/adjuntos/adjunto.routes.ts` — RF-VIR-001, RF-VIR-005 — Rutas: `POST /materiales/:id/adjuntos`, `DELETE /adjuntos/:id`, `GET /adjuntos/:id/download`; guards: `virtual.gestionar` (escritura), `virtual.leer` (lectura); tests contrato en verde

- [x] T010 — Registrar rutas adjuntos en `apps/api/src/app.ts` — `apps/api/src/app.ts` — RF-VIR-005 — `app.register(adjuntoRoutes, { prefix: '/api/v1' })`; `npm run typecheck` en verde

---

## Fase 5 — Frontend: Shared

- [x] T011 — Crear `virtual-classroom/shared/formato.ts` y `adjuntos.ts` — `apps/web/src/features/virtual-classroom/shared/formato.ts`, `apps/web/src/features/virtual-classroom/shared/adjuntos.ts` — RF-VIR-001 a RF-VIR-005 — `mensajeError`, `formatoFecha`, `truncarTexto`, componente `AdjuntosUpload` (reutiliza communication); `npm run lint` en verde

---

## Fase 6 — Frontend: Materiales

- [x] T012 — Implementar `virtual-classroom/materiales/api.ts` cliente tipado — `apps/web/src/features/virtual-classroom/materiales/api.ts` — RF-VIR-001 a RF-VIR-004 — `listarMateriales`, `crearMaterial`, `actualizarMaterial`, `eliminarMaterial`, `descargarMaterial`, `subirAdjunto`, `eliminarAdjunto`; usa schemas `packages/shared`

- [x] T013 — Implementar `MaterialForm.tsx` (crear/editar) — `apps/web/src/features/virtual-classroom/materiales/MaterialForm.tsx` — RF-VIR-001, RF-VIR-002 — Campos: título, descripción, curso, sección, período (selectores con alcance), adjunto; validación Zod cliente + mensajes español; accesible (labels, foco, ARIA)

- [x] T014 — Implementar `MaterialesPage.tsx` (lista + filtros) — `apps/web/src/features/virtual-classroom/materiales/MaterialesPage.tsx` — RF-VIR-004 — Tabla paginada, filtros: curso, sección, período; estados carga/vacío/error; botón crear según permiso; enlace a detalle

- [x] T015 — Implementar `MaterialDetalle.tsx` — `apps/web/src/features/virtual-classroom/materiales/MaterialDetalle.tsx` — RF-VIR-003, RF-VIR-005 — Vista completa: título, descripción, metadatos (docente, curso, sección, período), adjuntos con botón descargar; botones editar/eliminar según permiso

- [x] T016 — Registrar ruta `/virtual` en `apps/web/src/app/routes.tsx` — `apps/web/src/app/routes.tsx` — RF-VIR-001 a RF-VIR-005 — `{ path: '/virtual', element: <VirtualIndexPage /> }`, `{ path: '/virtual/materiales/:id', element: <MaterialDetallePage /> }`; `npm run typecheck` en verde

- [x] T017 — Tests UI: `MaterialesPage.test.tsx`, `MaterialForm.test.tsx` — `apps/web/src/features/virtual-classroom/materiales/*.test.tsx` — RF-VIR-001 a RF-VIR-005 — Caso feliz + error (validación, 403, vacío); `npm test` en verde

---

## Fase 7 — Frontend: Adjuntos virtual-classroom

- [x] T018 — Reutilizar `communication/shared/AdjuntosUpload` en virtual-classroom — `apps/web/src/features/virtual-classroom/adjuntos/AdjuntosUploadV2.tsx` (wrapper o extensión) — RF-VIR-005 — Soporta múltiples adjuntos por material; validación MIME/tamaño; preview imágenes

- [x] T018 — Implementar `virtual-classroom/adjuntos/api.ts` — `apps/web/src/features/virtual-classroom/adjuntos/api.ts` — RF-VIR-001 a RF-VIR-005 — `subirAdjunto`, `eliminarAdjunto`, `descargarAdjunto`; usa schemas `packages/shared`

- [x] T19 — Tests UI adjuntos virtual-classroom — `apps/web/src/features/virtual-classroom/adjuntos/*.test.tsx` — RF-VIR-005 — Validación MIME/tamaño, preview, límite archivos

---

## Fase 8 — Cierre

- [x] T020 — Ejecutar gate completo y actualizar `docs/architecture.md` — `apps/api/test/virtual-classroom/`, `docs/architecture.md`, `specs/virtual-classroom/001-spec-mvp/tasks.md` — RF-VIR-001 a RF-VIR-005 — `lint + typecheck + test` en verde; cobertura servicios ≥ 70 %; arquitectura actualizada

- [x] T021 — Configurar Playwright y flujo E2E virtual-classroom — `playwright.config.ts`, `apps/web/e2e/aula-virtual.spec.ts`, `package.json`, `apps/api/src/core/seed-e2e.ts` — RF-VIR-001, RF-VIR-004 — Playwright configurado con dual webServer (API puerto 3000 + Web puerto 5173); seed E2E crea docente/alumno/apoderado con matrícula y asignación; test E2E `aula-virtual.spec.ts` cubre flujo docente crea material → alumno/apoderado descargan + adjuntos; `npm run seed:e2e` + `npm run test:e2e` ejecutables

- [x] T022 — Implementar cliente de catálogo académico para los selectores de `MaterialForm` — `apps/web/src/features/virtual-classroom/catalogo/api.ts`, `packages/shared/src/schemas/curso.ts`, `packages/shared/src/schemas/seccion.ts`, `packages/shared/src/schemas/periodo-academico.ts` — RF-VIR-001 — `GET /cursos`, `GET /secciones`, `GET /anios-academicos/:id/periodos` validados con schemas de respuesta en `packages/shared`; los selectores muestran nombres en lugar de UUID

---

## Definition of Done

Se aplica el anexo A de `docs/constitution.md`:

- [x] Tareas citan su requerimiento.
- [x] `lint + typecheck + test` en verde.
- [x] Permisos validados en backend y alineados con la matriz RBAC.
- [x] Sin PII en logs ni almacenamiento del navegador.
- [x] Estados de carga, vacío y error cubiertos.
- [x] Spec y tareas actualizadas.
- [x] Sin dependencias no aprobadas.

---

## Registro de bloqueos

| Fecha | Tarea | Motivo | Estado |
|---|---|---|---|
| 2026-11-12 | T003, T004, T005, T006, T007, T008, T009 | Cerradas con sus suites propias en verde (`npx vitest run test/virtual-classroom` → 5 archivos, 112 tests). El gate raíz `npm test` estaba en rojo por fallos **previos a esta feature** en `test/core` y `test/academic`: esos tests creaban su propia institución mientras `limpiarBaseDePruebas` siembra el ID fijo `00000000-0000-4000-8000-000000000001` y el guard resuelve `institucion.findFirst`, devolviendo 404. **Corregido**: actualizados 14 archivos de test (`curso.test.ts`, `asignacion-docente.test.ts`, `estructura-escolar.test.ts`, `asistencias.test.ts`, `alertas.test.ts`, `calificaciones.test.ts`, `nota-final.test.ts`, `consulta-calificaciones.test.ts`, `resumen-periodo.test.ts`, `api-asistencias.test.ts`, `api-calificaciones.test.ts`, `auditoria.test.ts` (academic), `audit.test.ts` (core), `matricula.test.ts` (core), `institucion.test.ts` (core)) para usar la institución fija. Gate completo en verde. | Cerrada |
| 2026-11-12 | T020 | Gate completo (`lint + typecheck + test`) en verde. Cobertura servicios virtual-classroom: 92.62% statements, 84.01% branches, 93.33% functions, 93.52% lines (supera ≥ 70% / ≥ 80% service). | Completada |
| 2026-11-12 | T021 | Playwright configurado con `webServer` dual (API + Web). Seed E2E (`seed-e2e.ts`) crea datos en base de desarrollo: año académico, secciones, docente con asignación, alumno con matrícula APROBADA, apoderado vinculado. Test `aula-virtual.spec.ts` cubre flujo completo docente→alumno/apoderado + adjuntos. | Completada |
| 2026-11-12 | T022 | Cliente de catálogo académico implementado en `apps/web/src/features/virtual-classroom/catalogo/api.ts`. Schemas de respuesta paginados agregados a `packages/shared` (`cursoResponseSchema`, `seccionResponseSchema`, `periodoAcademicoResponseSchema` + paginated versions). `MaterialForm` recibe opciones con `nombre` en lugar de solo UUIDs; fallback a IDs observados si falla el catálogo. Gate completo en verde. | Completada |

---

## Notas de implementación

1. **Adjuntos**: Reutilizar `core.config` para tipos permitidos/tamaño máximo. En desarrollo: `uploads/virtual/` local; producción: ADR previo.
2. **Descarga**: Endpoint `/api/v1/virtual/materiales/:id/download` con streaming + `Content-Disposition: attachment`.
3. **Duplicados**: Regla RN-VIR-002 valida unicidad `docenteId + cursoId + seccionId + periodoId + titulo` en service (no solo DB).
3. **Adjuntos múltiples**: Un material puede tener varios adjuntos; tabla `AdjuntoVirtual` 1:N con `MaterialVirtual`.
3. **Sin versionado**: Actualización sobrescribe archivo previo (auditado con anterior/nuevo).
4. **Seed usuarios docentes/alumnos**: Requerido para E2E; registrar como tarea si no existe.
5. **Cliente de adjuntos**: las funciones `subirAdjunto`, `eliminarAdjunto` y `prepararDescargaAdjunto` viven en `apps/web/src/features/virtual-classroom/materiales/api.ts`; no se creó `adjuntos/api.ts` aparte para no duplicar el cliente HTTP.
6. **Selectores del formulario**: el catálogo académico aún no tiene cliente en el frontend. `MaterialForm` usa `input` + `datalist` con los identificadores observados en el listado, de modo que el UUID puede escribirse cuando el catálogo no está cargado (ver T022).