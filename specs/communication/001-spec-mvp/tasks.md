# Tareas — Módulo de Comunicación (MVP)

**Versión:** 1.0.0
**Fecha:** 2026-11-11
**Spec:** `specs/communication/001-spec-mvp/spec.md`
**Plan:** `specs/communication/001-spec-mvp/plan.md`

---

## Formato

```md
- [ ] TNNN — Descripción — rutas — RF — Criterio de aceptación
```

- `TNNN` único y correlativo.
- Cita siempre un `RF-COM-NNN`.
- Indica rutas de archivo afectadas.
- Incluye criterio de aceptación verificable.
- `- [x]` solo cuando gate (`lint + typecheck + test`) en verde.

---

## Fase 1 — Shared (tipos, schemas, contratos)

- [x] T001 — Definir schemas Zod de anuncio, mensaje y adjunto en `packages/shared` — `packages/shared/src/schemas/communication/*.ts`, `packages/shared/src/contracts/communication/*.ts` — RF-COM-001 a RF-COM-006 — `crearAnuncioSchema`, `actualizarAnuncioSchema`, `listarAnunciosQuerySchema`, `crearMensajeSchema`, `listarMensajesQuerySchema`, contratos de respuesta; `npm run build -w @intranet/shared` en verde

---

## Fase 2 — Migración y entidades base

- [x] T002 — Crear migración `communication_init` con modelos Anuncio, AdjuntoAnuncio, HiloMensajeria, MensajeSeccion, AdjuntoMensaje — `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/` — RF-COM-001 a RF-COM-006 — `prisma migrate dev --name communication_init` aplica sin errores; tablas creadas con índices y enums

---

## Fase 3 — Backend: Anuncios

- [x] T003 — Implementar `anuncio.repository.ts` con CRUD y mapeo a DTO — `apps/api/src/modules/communication/anuncios/anuncio.repository.ts` — RF-COM-001, RF-COM-002, RF-COM-003 — `create`, `findById`, `update`, `softDelete`, `findMany` con filtros y paginación; tests de repositorio en verde

- [x] T004 — Implementar `anuncio.scope.ts` con `construirAlcanceAnuncios` — `apps/api/src/modules/communication/anuncios/anuncio.scope.ts` — RF-COM-003 — Segmentación: DI ve todos, DO ve institucionales + secciones donde es tutor + secciones asignadas, PA ve vinculados a sus alumnos, AL ve su sección/grado/nivel/rol ALUMNO; SA ve todos (auditado); tests de scope en verde

- [x] T005 — Implementar `anuncio.service.ts` con reglas de negocio — `apps/api/src/modules/communication/anuncios/anuncio.service.ts` — RF-COM-001, RF-COM-002, RF-COM-003 — Validación audiencia institucional, estado borrador/publicado, expiración automática, auditoría en escritura; tests de servicio ≥ 80 % cobertura

- [x] T006 — Implementar `anuncio.controller.ts` y `anuncio.routes.ts` — `apps/api/src/modules/communication/anuncios/anuncio.controller.ts`, `apps/api/src/modules/communication/anuncios/anuncio.routes.ts` — RF-COM-001, RF-COM-002, RF-COM-003 — Rutas: `POST /anuncios`, `PATCH /anuncios/:id`, `DELETE /anuncios/:id`, `GET /anuncios`, `GET /anuncios/:id`; guards: `communication.anuncios.gestionar` (escritura), `communication.anuncios.leer` (lectura); tests de contrato en verde

- [x] T007 — Registrar rutas de anuncios en `apps/api/src/app.ts` — `apps/api/src/app.ts` — RF-COM-001 a RF-COM-003 — `app.register(anuncioRoutes, { prefix: '/api/v1' })`; `npm run typecheck` en verde

---

## Fase 4 — Backend: Mensajería

- [x] T008 — Implementar `mensaje.repository.ts` y `hilo.repository.ts` — `apps/api/src/modules/communication/mensajeria/mensaje.repository.ts` — RF-COM-004, RF-COM-005 — Hilo único por sección (upsert), CRUD mensajes con paginación, adjuntos; tests de repositorio en verde

- [x] T009 — Implementar `mensaje.scope.ts` con `construirAlcanceMensajes` — `apps/api/src/modules/communication/mensajeria/mensaje.scope.ts` — RF-COM-004, RF-COM-005 — DO tutor + PA con alumno en sección (matrícula APROBADA); DI ve todo (auditado); SA ve todo (auditado, denuncia); tests de scope en verde

- [x] T010 — Implementar `mensaje.service.ts` — `apps/api/src/modules/communication/mensajeria/mensaje.service.ts` — RF-COM-004, RF-COM-005 — Crear hilo al primer mensaje si no existe, validar autor (tutor/apoderado vinculado), auditoría en escritura; tests de servicio ≥ 80 % cobertura

- [x] T011 — Implementar `mensaje.controller.ts` y `mensaje.routes.ts` — `apps/api/src/modules/communication/mensajeria/mensaje.controller.ts`, `apps/api/src/modules/communication/mensajeria/mensaje.routes.ts` — RF-COM-004, RF-COM-005 — Rutas: `GET /secciones/:id/mensajes`, `POST /secciones/:id/mensajes`, `DELETE /mensajes/:id`; guards: `communication.mensajeria.gestionar` (escritura tutor/apoderado), `communication.mensajeria.supervisar` (lectura DI/SA); tests de contrato en verde

- [x] T012 — Registrar rutas de mensajería en `apps/api/src/app.ts` — `apps/api/src/app.ts` — RF-COM-004, RF-COM-005 — `app.register(mensajeRoutes, { prefix: '/api/v1' })`; `npm run typecheck` en verde

---

## Fase 5 — Backend: Adjuntos (compartido anuncios y mensajes)

- [x] T013 — Implementar `adjunto.service.ts` con validación tipos/tamaño — `apps/api/src/modules/communication/adjuntos/adjunto.service.ts` — RF-COM-006 — Lista blanca y tamaño máximo desde config institucional (`core.config`), almacenamiento local en desarrollo, nombre saneado, ruta no predecible; tests en verde

- [x] T014 — Implementar `adjunto.controller.ts` y rutas — `apps/api/src/modules/communication/adjuntos/adjunto.controller.ts`, `apps/api/src/modules/communication/adjuntos/adjunto.routes.ts` — RF-COM-006 — `POST /anuncios/:id/adjuntos`, `DELETE /anuncios/adjuntos/:id`, `POST /mensajes/:id/adjuntos`, `DELETE /mensajes/adjuntos/:id`; guards según recurso padre; tests en verde

- [x] T015 — Registrar rutas de adjuntos en `apps/api/src/app.ts` — `apps/api/src/app.ts` — RF-COM-006 — `app.register(adjuntoRoutes, { prefix: '/api/v1' })`; `npm run typecheck` en verde

---

## Fase 6 — Frontend: Shared

- [ ] T016 — Crear `communication/shared/formato.ts` y `adjuntos.ts` — `apps/web/src/features/communication/shared/formato.ts`, `apps/web/src/features/communication/shared/adjuntos.ts` — RF-COM-001 a RF-COM-006 — `mensajeError`, `truncarTexto`, `formatoFecha`, componente `AdjuntosUpload` con validación cliente; `npm run lint` en verde

---

## Fase 7 — Frontend: Anuncios

- [ ] T017 — Implementar `anuncios/api.ts` cliente tipado — `apps/web/src/features/communication/anuncios/api.ts` — RF-COM-001 a RF-COM-003 — `listarAnuncios`, `crearAnuncio`, `actualizarAnuncio`, `eliminarAnuncio`, `subirAdjuntoAnuncio`, `eliminarAdjuntoAnuncio`; usa schemas de `packages/shared`

- [ ] T018 — Implementar `AnuncioForm.tsx` (crear/editar) — `apps/web/src/features/communication/anuncios/AnuncioForm.tsx` — RF-COM-001, RF-COM-002 — Campos: título, cuerpo (rich text), tipo (institucional/sección), segmentación condicional, adjuntos, estado; validación Zod cliente + mensajes en español; accesible (labels, foco, ARIA)

- [ ] T019 — Implementar `AnunciosPage.tsx` (lista + filtros) — `apps/web/src/features/communication/anuncios/AnunciosPage.tsx` — RF-COM-003 — Tabla paginada, filtros: tipo, estado, nivel, grado, sección, rol, fechas; estados carga/vacío/error; botón crear según permiso; enlace a detalle

- [ ] T020 — Implementar `AnuncioDetalle.tsx` — `apps/web/src/features/communication/anuncios/AnuncioDetalle.tsx` — RF-COM-003 — Vista completa: título, cuerpo renderizado, metadatos (autor, fecha, audiencia), adjuntos descargables; botones editar/archivar según permiso

- [ ] T021 — Registrar ruta `/anuncios` en `apps/web/src/app/routes.tsx` — `apps/web/src/app/routes.tsx` — RF-COM-001 a RF-COM-003 — `{ path: '/anuncios', element: <AnunciosPage /> }`, `{ path: '/anuncios/:id', element: <AnuncioDetallePage /> }`; `npm run typecheck` en verde

- [ ] T022 — Tests UI: `AnunciosPage.test.tsx`, `AnuncioForm.test.tsx` — `apps/web/src/features/communication/anuncios/*.test.tsx` — RF-COM-001 a RF-COM-003 — Caso feliz + error (validación, 403, vacío); `npm test` en verde

---

## Fase 8 — Frontend: Mensajería

- [ ] T023 — Implementar `mensajeria/api.ts` cliente tipado — `apps/web/src/features/communication/mensajeria/api.ts` — RF-COM-004, RF-COM-005 — `listarMensajes`, `enviarMensaje`, `subirAdjuntoMensaje`, `eliminarAdjuntoMensaje`

- [ ] T024 — Implementar `MensajeForm.tsx` — `apps/web/src/features/communication/mensajeria/MensajeForm.tsx` — RF-COM-004 — Cuerpo (rich text), adjuntos, validación cliente, accesible

- [ ] T025 — Implementar `MensajeriaPage.tsx` (hilo de sección) — `apps/web/src/features/communication/mensajeria/MensajeriaPage.tsx` — RF-COM-004, RF-COM-005 — Lista mensajes cronológica, paginación, formulario envío fijo abajo, adjuntos visibles; solo lectura para DI/SA (sin formulario); estados carga/vacío/error

- [ ] T026 — Registrar ruta `/mensajeria/:seccionId` en `apps/web/src/app/routes.tsx` — `apps/web/src/app/routes.tsx` — RF-COM-004, RF-COM-005 — `{ path: '/mensajeria/:seccionId', element: <MensajeriaPage /> }`; `npm run typecheck` en verde

- [ ] T027 — Tests UI: `MensajeriaPage.test.tsx`, `MensajeForm.test.tsx` — `apps/web/src/features/communication/mensajeria/*.test.tsx` — RF-COM-004, RF-COM-005 — Caso feliz + error (403 sin vínculo, validación, vacío); `npm test` en verde

---

## Fase 9 — Cierre

- [ ] T028 — Ejecutar gate completo y actualizar `docs/architecture.md` — `apps/api/test/communication/`, `docs/architecture.md`, `specs/communication/001-spec-mvp/tasks.md` — RF-COM-001 a RF-COM-006 — `lint + typecheck + test` en verde; cobertura servicios ≥ 70 %; arquitectura actualizada

- [ ] T029 — Configurar Playwright test E2E: Director crea anuncio → apoderado lo ve → tutor responde en hilo — `playwright.config.ts`, `apps/web/e2e/`, `package.json` — RF-COM-001, RF-COM-004 — `npx playwright test` completa flujo sin fallos (requiere seed usuarios)

---

## Definition of Done

Se aplica el anexo A de `docs/constitution.md`:

- [ ] Tareas citan su requerimiento.
- [ ] `lint + typecheck + test` en verde.
- [ ] Permisos validados en backend y alineados con la matriz RBAC.
- [ ] Sin PII en logs ni almacenamiento del navegador.
- [ ] Estados de carga, vacío y error cubiertos.
- [ ] Spec y tareas actualizadas.
- [ ] Sin dependencias no aprobadas.

---

## Registro de bloqueos

| Fecha | Tarea | Motivo | Estado |
|---|---|---|---|
| | | | |

---

## Notas de implementación

1. **Rich text**: Usar `marked` + `dompurify` para Markdown → HTML seguro (decisión pendiente §10.1 spec).
2. **Adjuntos**: Reutilizar config `core.config` (tipos permitidos, tamaño máx, ruta base). En desarrollo: `uploads/` local.
3. **Expiración anuncios**: Job cron o verificación en `listar` (cambiar estado a `EXPIRADO` si `expiraEn < now()`).
4. **Hilo mensajería**: Se crea automáticamente en primer `POST /secciones/:id/mensajes` si no existe (upsert en service).
5. **Auditoría**: Usar `registrarAuditoria` de `core.audit` dentro de transacción Prisma en service.
6. **Permisos**: Ver `docs/rbac-matrix.md` § Comunicación. Códigos: `communication.anuncios.gestionar`, `communication.anuncios.leer`, `communication.mensajeria.gestionar`, `communication.mensajeria.supervisar`.