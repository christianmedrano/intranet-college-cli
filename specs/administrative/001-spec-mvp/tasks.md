# Tareas — Módulo Administrativo (MVP)

**Versión:** 1.0.0
**Fecha:** 2026-11-13
**Spec:** `specs/administrative/001-spec-mvp/spec.md`
**Plan:** `specs/administrative/001-spec-mvp/plan.md`

---

## Formato

```md
- [ ] TNNN — Descripción — rutas — RF — Criterio de aceptación
```

- `TNNN` único y correlativo.
- Cita siempre un `RF-ADM-NNN` o `RN-ADM-NNN`.
- Indica rutas de archivo afectadas.
- Incluye criterio de aceptación verificable.
- `- [x]` solo cuando gate (`lint + typecheck + test`) en verde.

---

## Fase 1 — Shared (tipos, schemas, contratos)

- [ ] T001 — Definir schemas Zod de pago, matrícula, certificado y plantilla en `packages/shared` — `packages/shared/src/schemas/administrative/*.ts`, `packages/shared/src/contracts/administrative/*.ts` — RF-ADM-001 a RF-ADM-014 — `crearPagoSchema`, `solicitarMatriculaSchema`, `crearCertificadoSchema`, `plantillaCertificadoSchema`, contratos de respuesta; `npm run build -w @intranet/shared` en verde

- [x] T002 — Registrar permisos administrativos en `packages/shared/src/domain/permissions.ts` — `packages/shared/src/domain/permissions.ts`, `packages/shared/src/index.ts` — RF-ADM-001 a RF-ADM-014 — `administrative.pagos.registrar`, `administrative.pagos.anular`, `administrative.pagos.leer`, `administrative.matriculas.gestionar`, `administrative.matriculas.leer`, `administrative.certificados.emitir`, `administrative.certificados.solicitar`, `administrative.certificados.descargar`; `npm run build -w @intranet/shared` en verde

---

## Fase 2 — Migración y entidades base

- [x] T003 — Crear migración `administrative_init` con modelos `Pago`, `Certificado`, `PlantillaCertificado` y extensiones a `Matricula` — `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/` — RF-ADM-001 a RF-ADM-014 — `prisma migrate dev --name administrative_init` aplica sin errores; tablas creadas con índices, relaciones y restricciones

---

## Fase 3 — Backend: Pagos

- [x] T004 — Implementar `pago.repository.ts` con CRUD y mapeo a DTO — `apps/api/src/modules/administrative/pagos/pago.repository.ts` — RF-ADM-001 a RF-ADM-004 — `create`, `findById`, `anular`, `findMany` con filtros/paginación, `estadoCuenta`; tests repositorio en verde

- [x] T005 — Implementar `pago.scope.ts` con `construirAlcancePagos` — `apps/api/src/modules/administrative/pagos/pago.scope.ts` — RF-ADM-003 a RF-ADM-004 — Segmentación: SA/DI ven todos, PA ve sus alumnos, AL ve propios; tests scope en verde

- [x] T006 — Implementar `pago.service.ts` con reglas de negocio — `apps/api/src/modules/administrative/pagos/pago.service.ts` — RF-ADM-001 a RF-ADM-004, RN-ADM-001 a RN-ADM-004 — Validación alumno/concepto/monto/fecha, anulación con motivo, auditoría; tests servicio ≥ 80 % cobertura

- [x] T007 — Implementar `pago.controller.ts` y `pago.routes.ts` — `apps/api/src/modules/administrative/pagos/pago.controller.ts`, `apps/api/src/modules/administrative/pagos/pago.routes.ts` — RF-ADM-001 a RF-ADM-004 — Rutas: `POST /pagos`, `PATCH /pagos/:id/anular`, `GET /pagos`, `GET /alumnos/:id/estado-cuenta`; guards: `administrative.pagos.registrar` (escritura), `administrative.pagos.leer` (lectura); tests de contrato en verde

- [x] T008 — Registrar rutas de pagos en `apps/api/src/app.ts` — `apps/api/src/app.ts` — RF-ADM-001 a RF-ADM-004 — `app.register(pagoRoutes, { prefix: '/api/v1' })`; `npm run typecheck` en verde

---

## Fase 4 — Backend: Matrículas

- [x] T009 — Implementar `matricula.repository.ts` (extiende existente) — `apps/api/src/modules/administrative/matriculas/matricula.repository.ts` — RF-ADM-005 a RF-ADM-010 — CRUD estados, `findMany` con filtros/paginación; tests repositorio en verde

- [x] T010 — Implementar `matricula.scope.ts` con `construirAlcanceMatriculas` — `apps/api/src/modules/administrative/matriculas/matricula.scope.ts` — RF-ADM-005 a RF-ADM-010 — Segmentación: SA/DI ven todas, PA ve sus alumnos (SOLICITADA/APROBADA), AL ve propia; tests scope en verde

- [x] T011 — Implementar `matricula.service.ts` con reglas de negocio — `apps/api/src/modules/administrative/matriculas/matricula.service.ts` — RF-ADM-005 a RF-ADM-010, RN-ADM-005 a RN-ADM-010 — Validación capacidad, apoderado principal, año activo, retiro libera cupo; tests servicio ≥ 80 % cobertura

- [x] T012 — Implementar `matricula.controller.ts` y `matricula.routes.ts` — `apps/api/src/modules/administrative/matriculas/matricula.controller.ts`, `apps/api/src/modules/administrative/matriculas/matricula.routes.ts` — RF-ADM-005 a RF-ADM-010 — Rutas: `POST /matriculas`, `PATCH /matriculas/:id/aprobar`, `PATCH /matriculas/:id/rechazar`, `PATCH /matriculas/:id/retirar`, `PATCH /matriculas/:id/anular`, `GET /matriculas`; guards: `administrative.matriculas.gestionar` (escritura), `administrative.matriculas.leer` (lectura); tests de contrato en verde

- [x] T013 — Registrar rutas de matrículas en `apps/api/src/app.ts` — `apps/api/src/app.ts` — RF-ADM-005 a RF-ADM-010 — `app.register(matriculaRoutes, { prefix: '/api/v1' })`; `npm run typecheck` en verde

---

## Fase 5 — Backend: Certificados y Plantillas

- [x] T014 — Implementar `plantillaCertificado.repository.ts` — `apps/api/src/modules/administrative/certificados/plantilla.repository.ts` — RF-ADM-011 a RF-ADM-014 — CRUD plantillas con versionado; tests repositorio en verde

- [x] T015 — Implementar `certificado.repository.ts` — `apps/api/src/modules/administrative/certificados/certificado.repository.ts` — RF-ADM-011 a RF-ADM-014 — CRUD certificados, numeración correlativa por tipo/año; tests repositorio en verde

- [x] T016 — Implementar `certificado.scope.ts` con `construirAlcanceCertificados` — `apps/api/src/modules/administrative/certificados/certificado.scope.ts` — RF-ADM-011 a RF-ADM-014 — Segmentación: SA/DI emiten/aprueban/rechazan, PA/AL solicitan/descargan propios; tests scope en verde

- [x] T017 — Implementar `certificado.service.ts` con reglas de negocio — `apps/api/src/modules/administrative/certificados/certificado.service.ts` — RF-ADM-011 a RF-ADM-014, RN-ADM-011 a RN-ADM-014 — Emisión con plantilla, numeración correlativa por tipo/año, variables, PDF, solicitud/aprobación/rechazo; tests servicio ≥ 80 % cobertura

- [x] T018 — Implementar `plantilla.service.ts` y `plantilla.controller.ts` + routes — `apps/api/src/modules/administrative/certificados/plantilla.service.ts`, `apps/api/src/modules/administrative/certificados/plantilla.controller.ts`, `apps/api/src/modules/administrative/certificados/plantilla.routes.ts` — RF-ADM-014 — CRUD plantillas con versionado, variables `{{variable}}`, preview; guards `administrative.certificados.emitir`; tests servicio/contrato en verde

- [x] T018 — Implementar `certificado.controller.ts` y `certificado.routes.ts` — `apps/api/src/modules/administrative/certificados/certificado.controller.ts`, `apps/api/src/modules/administrative/certificados/certificado.routes.ts` — RF-ADM-011 a RF-ADM-013 — Rutas: `POST /certificados`, `POST /certificados/solicitar`, `PATCH /certificados/:id/aprobar`, `PATCH /certificados/:id/rechazar`, `GET /certificados`, `GET /certificados/:id/download`, `GET /plantillas-certificados`; guards: `administrative.certificados.emitir` (escritura), `administrative.certificados.solicitar`/`administrative.certificados.descargar` (lectura); tests de contrato en verde

- [x] T019 — Registrar rutas de certificados en `apps/api/src/app.ts` — `apps/api/src/app.ts` — RF-ADM-011 a RF-ADM-014 — `app.register(certificadoRoutes, { prefix: '/api/v1' })`, `app.register(plantillaRoutes, { prefix: '/api/v1' })`; `npm run typecheck` en verde

---

## Fase 6 — Frontend: Shared

- [x] T020 — Crear `administrative/shared/formato.ts` y `PlantillaEditor.tsx` — `apps/web/src/features/administrative/shared/formato.ts`, `apps/web/src/features/administrative/shared/PlantillaEditor.tsx` — RF-ADM-001 a RF-ADM-014 — `formatoMoneda`, `formatoFecha`, `formatoNumeroCertificado`, editor HTML con preview variables; `npm run lint` en verde

---

## Fase 7 — Frontend: Pagos

- [x] T021 — Implementar `administrative/pagos/api.ts` cliente tipado — `apps/web/src/features/administrative/pagos/api.ts` — RF-ADM-001 a RF-ADM-004 — `listarPagos`, `crearPago`, `anularPago`, `estadoCuenta`; usa schemas `packages/shared`

- [x] T022 — Implementar `PagoForm.tsx` (crear) — `apps/web/src/features/administrative/pagos/PagoForm.tsx` — RF-ADM-001 — Campos: alumno (selector), concepto, monto, fecha, método, comprobante, observaciones; validación Zod cliente + mensajes español; accesible

- [x] T023 — Implementar `PagosPage.tsx` (lista + filtros) — `apps/web/src/features/administrative/pagos/PagosPage.tsx` — RF-ADM-004 — Tabla paginada, filtros: alumno, concepto, fecha rango, estado, método; botón nuevo según permiso; enlace a estado cuenta

- [x] T024 — Implementar `EstadoCuentaPage.tsx` — `apps/web/src/features/administrative/pagos/EstadoCuentaPage.tsx` — RF-ADM-003 — Totales por concepto y general, pagos pendientes/pagados, filtros por período

- [x] T025 — Tests UI: `PagoForm.test.tsx`, `PagosPage.test.tsx`, `EstadoCuentaPage.test.tsx` — `apps/web/src/features/administrative/pagos/*.test.tsx` — RF-ADM-001 a RF-ADM-004 — Caso feliz + error (validación, 403, vacío); `npm test` en verde

---

## Fase 8 — Frontend: Matrículas

- [x] T026 — Implementar `administrative/matriculas/api.ts` cliente tipado — `apps/web/src/features/administrative/matriculas/api.ts` — RF-ADM-005 a RF-ADM-010 — `solicitarMatricula`, `aprobarMatricula`, `rechazarMatricula`, `retirarMatricula`, `listarMatriculas`; usa schemas `packages/shared`

- [x] T027 — Implementar `MatriculaForm.tsx` (solicitar/editar) — `apps/web/src/features/administrative/matriculas/MatriculaForm.tsx` — RF-ADM-005 — Campos: alumno, año, nivel, grado, sección, documentos; validación Zod + mensajes español; accesible

- [x] T028 — Implementar `MatriculasPage.tsx` (lista + filtros + acciones) — `apps/web/src/features/administrative/matriculas/MatriculasPage.tsx` — RF-ADM-005 a RF-ADM-010 — Tabla paginada, filtros: año, nivel, grado, sección, estado, alumno; botones aprobar/rechazar/retirar según permiso y estado

- [x] T029 — Tests UI: `MatriculaForm.test.tsx`, `MatriculasPage.test.tsx` — `apps/web/src/features/administrative/matriculas/*.test.tsx` — RF-ADM-005 a RF-ADM-010 — Caso feliz + error (validación, 403, capacidad llena, sin apoderado); `npm test` en verde

---

## Fase 9 — Frontend: Certificados y Plantillas

- [x] T030 — Implementar `administrative/certificados/api.ts` cliente tipado — `apps/web/src/features/administrative/certificados/api.ts` — RF-ADM-011 a RF-ADM-014 — `listarCertificados`, `crearCertificado`, `solicitarCertificado`, `aprobarCertificado`, `rechazarCertificado`, `descargarCertificado`, `listarPlantillas`, `crearPlantilla`, `actualizarPlantilla`, `eliminarPlantilla`; usa schemas `packages/shared`

- [x] T031 — Implementar `PlantillaForm.tsx` y `PlantillasPage.tsx` — `apps/web/src/features/administrative/certificados/PlantillaForm.tsx`, `apps/web/src/features/administrative/certificados/PlantillasPage.tsx` — RF-ADM-014 — CRUD plantillas con editor HTML + preview variables `{{variable}}`; lista con versión

- [x] T032 — Implementar `CertificadoForm.tsx` (emitir/solicitar) — `apps/web/src/features/administrative/certificados/CertificadoForm.tsx` — RF-ADM-011, RF-ADM-012 — Campos: tipo, alumno, año, plantilla, variables; validación Zod; preview PDF

- [x] T033 — Implementar `CertificadosPage.tsx` (lista + filtros + acciones) — `apps/web/src/features/administrative/certificados/CertificadosPage.tsx` — RF-ADM-011 a RF-ADM-013 — Tabla paginada, filtros: tipo, alumno, año, estado; botones emitir/solicitar/aprobar/rechazar/descargar según permiso/estado

- [ ] T034 — Tests UI: `PlantillaForm.test.tsx`, `CertificadoForm.test.tsx`, `CertificadosPage.test.tsx` — `apps/web/src/features/administrative/certificados/*.test.tsx` — RF-ADM-011 a RF-ADM-014 — Caso feliz + error (validación, 403, plantilla inválida, variables faltantes); `npm test` en verde

---

## Fase 10 — Cierre

- [ ] T035 — Ejecutar gate completo y actualizar `docs/architecture.md` — `apps/api/test/administrative/`, `docs/architecture.md`, `specs/administrative/001-spec-mvp/tasks.md` — RF-ADM-001 a RF-ADM-014 — `lint + typecheck + test` en verde; cobertura servicios ≥ 70 %; arquitectura actualizada

- [ ] T036 — Configurar Playwright y flujo E2E administrative — `playwright.config.ts`, `apps/web/e2e/`, `package.json` — RF-ADM-001, RF-ADM-005, RF-ADM-011 — `npx playwright test` completa flujo: apoderado solicita matrícula → director aprueba → director emite certificado → apoderado descarga

---

## Definition of Done

Se aplica el anexo A de `docs/constitution.md` (Anexo A):

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

1. **Pagos**: Sin pasarela; registro manual. Monto `DECIMAL(10,2)`, moneda PEN.
2. **Matrículas**: Extiende modelo core existente. Estados: `SOLICITADA`→`APROBADA`/`RECHAZADA`/`RETIRADA`/`ANULADA`. Validar capacidad y apoderado principal.
3. **Certificados**: Numeración correlativa `CERT-{TIPO}-{AÑO}-{SEQ}`. Plantillas con variables `{{variable}}`. PDF generado en servidor.
4. **Plantillas**: Versionado por `tipo + version`. Editor HTML con preview variables `{{variable}}`.
5. **Seed**: Plantillas base idempotentes (`ESTUDIOS`, `MATRICULA`, `NO_ADEUDO`, `CONDUCTA`).
6. **E2E**: Requiere seed apoderado/alumno con matrícula aprobada + director.
7. **ADR pendiente**: Almacenamiento PDFs producción (local/S3/BD) antes de T017.