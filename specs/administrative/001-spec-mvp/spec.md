# Especificación MVP — Módulo Administrativo

| Campo | Valor |
|---|---|
| ID | `ADM-001` |
| Módulo | `administrative` |
| Versión | `1.0.0` |
| Estado | `borrador` |
| Autor | |
| Fecha | `2026-11-13` |

---

## 1. Contexto

El módulo **Administrativo** implementa la gestión de pagos, matrículas y certificados para la institución educativa (Inicial, Primaria y Secundaria). Es el sexto componente del MVP.

**Problema:** Falta un sistema centralizado para:
- Registro y consulta de pagos (cuotas, pensiones, otros conceptos)
- Gestión completa de matrículas (solicitud, aprobación, renovación, anulación)
- Emisión y solicitud de certificados y constancias (estudios, matrícula, no adeudo, etc.)

No se incluye pasarela de pagos en línea (fuera de alcance MVP).

---

## 2. Alcance

### Incluye

#### Pagos (RF-ADM-001 a RF-ADM-004)
- Registro de pagos por concepto (cuota mensual, matrícula, certificado, otros)
- Anulación de pagos con motivo y auditoría
- Consulta de estado de cuenta por alumno
- Reporte de morosidad y pagos pendientes
- **Sin pasarela de pagos** (registro manual por administrador/director)

#### Matrículas (RF-ADM-005 a RF-ADM-010)
- Solicitud de matrícula por apoderado (nueva y renovación)
- Aprobación/rechazo por administrador/director
- Estados: `SOLICITADA`, `APROBADA`, `RECHAZADA`, `RETIRADA`, `ANULADA`
- Validación: un apoderado principal, sección con capacidad, año académico activo
- Renovación anual automática (opcional, configurable)

#### Certificados y Constancias (RF-ADM-011 a RF-ADM-014)
- Emisión por director/administrador: estudios, matrícula, no adeudo, conducta, otros
- Solicitud por apoderado/alumno (aprobación administrativa)
- Descarga por roles autorizados
- Plantillas configurables con variables (datos alumno, institución, fechas)
- Numeración correlativa y control de emisión

### No incluye (MVP)
- Pasarela de pagos en línea (Stripe, Culqi, etc.)
- Facturación electrónica SUNAT
- Conciliación bancaria automática
- Notificaciones push/email transaccionales
- Módulo de contabilidad completa

---

## 3. Requerimientos Funcionales

### Pagos

| ID | Descripción | Prioridad |
|---|---|---|
| RF-ADM-001 | Registrar pago: alumno, concepto, monto, fecha, método, observaciones, comprobante (opcional) | Alta |
| RF-ADM-002 | Anular pago: motivo obligatorio, auditoría con anterior/nuevo, solo si no está conciliado | Alta |
| RF-ADM-003 | Consultar estado de cuenta: alumno, período, concepto; totales pagados/pendientes | Alta |
| RF-ADM-004 | Listar pagos con filtros: alumno, concepto, fecha rango, estado, método; paginación | Alta |

### Matrículas

| ID | Descripción | Prioridad |
|---|---|---|
| RF-ADM-005 | Solicitar matrícula: apoderado, alumno, año, nivel, grado, sección preferida, documentos | Alta |
| RF-ADM-006 | Aprobar matrícula: validar capacidad, apoderado principal, documentos; cambio a `APROBADA` | Alta |
| RF-ADM-007 | Rechazar matrícula: motivo obligatorio; notificación a apoderado | Alta |
| RF-ADM-008 | Retirar matrícula: fecha, motivo; libera cupo; historial conservado | Alta |
| RF-ADM-009 | Renovar matrícula: copia datos año anterior; validación de pagos al día (configurable) | Media |
| RF-ADM-010 | Listar matrículas con filtros: año, nivel, grado, sección, estado, alumno; paginación | Alta |

### Certificados y Constancias

| ID | Descripción | Prioridad |
|---|---|---|
| RF-ADM-011 | Emitir certificado: tipo (estudios, matrícula, no adeudo, conducta, otros), alumno, plantilla, variables, numeración | Alta |
| RF-ADM-012 | Solicitar certificado: apoderado/alumno selecciona tipo; estado `SOLICITADO` → `APROBADO`/`RECHAZADO` | Alta |
| RF-ADM-013 | Descargar certificado: PDF generado con plantilla; control de acceso por rol | Alta |
| RF-ADM-014 | Configurar plantillas: variables (alumno, institución, fechas, director), vista previa | Media |

---

## 4. Reglas de Negocio

### Pagos (RN-ADM-001 a RN-ADM-004)

| ID | Regla |
|---|---|
| RN-ADM-001 | Monto en `DECIMAL(10,2)`, moneda PEN. Prohibido `FLOAT`. |
| RN-ADM-002 | Un pago anulado no se puede reactivar; se registra nuevo pago. |
| RN-ADM-003 | Conceptos predefinidos: `CUOTA_MENSUAL`, `MATRICULA`, `CERTIFICADO`, `OTRO`. Extensibles por configuración. |
| RN-ADM-004 | Métodos de pago: `EFECTIVO`, `TRANSFERENCIA`, `DEPOSITO`, `OTRO`. Sin pasarela. |

### Matrículas (RN-ADM-005 a RN-ADM-010)

| ID | Regla |
|---|---|
| RN-ADM-005 | Un alumno solo puede tener una matrícula `APROBADA` por año académico. |
| RN-ADM-006 | Sección debe tener capacidad disponible (si se define). |
| RN-ADM-007 | Apoderado principal obligatorio para `APROBADA`. |
| RN-ADM-008 | Año académico debe estar `ACTIVO` o `PLANIFICADO`. |
| RN-ADM-009 | Retirar matrícula libera cupo en la sección. |
| RN-ADM-010 | Renovación requiere pagos al día (configurable por institución). |

### Certificados (RN-ADM-011 a RN-ADM-014)

| ID | Regla |
|---|---|
| RN-ADM-011 | Numeración correlativa por tipo de certificado y año (ej: `CERT-EST-2026-0001`). |
| RN-ADM-012 | Plantillas con variables: `{{alumno.nombres}}`, `{{institucion.nombre}}`, `{{fecha_emision}}`, etc. |
| RN-ADM-013 | Solo Director/Administrador emiten; Apoderado/Alumno solicitan y descargan propios. |
| RN-ADM-014 | PDF generado en servidor; firma digital del director (opcional, configurable). |

---

## 5. Modelo de Datos

### Entidades nuevas

```prisma
model Pago {
  id              String   @id @default(uuid()) @db.Char(36)
  alumnoId        String   @map("alumno_id") @db.Char(36)
  concepto        String   @db.VarChar(30)  // CUOTA_MENSUAL, MATRICULA, CERTIFICADO, OTRO
  monto           Decimal  @db.Decimal(10,2)
  moneda          String   @default("PEN") @db.Char(3)
  fechaPago       DateTime @map("fecha_pago") @db.DateTime(3)
  metodo          String   @db.VarChar(20)  // EFECTIVO, TRANSFERENCIA, DEPOSITO, OTRO
  comprobante     String?  @map("comprobante") @db.VarChar(100)
  observaciones   String?  @db.Text
  estado          String   @default("REGISTRADO") @db.VarChar(20) // REGISTRADO, ANULADO
  anuladoMotivo   String?  @map("anulado_motivo") @db.Text
  anuladoPorId    String?  @map("anulado_por_id") @db.Char(36)
  anuladoAt       DateTime? @map("anulado_at") @db.DateTime(3)

  createdAt DateTime  @default(now()) @map("created_at") @db.DateTime(3)
  updatedAt DateTime  @updatedAt @map("updated_at") @db.DateTime(3)
  createdBy String?   @map("created_by") @db.Char(36)
  updatedBy String?   @map("updated_by") @db.Char(36)
  deletedAt DateTime? @map("deleted_at") @db.DateTime(3)

  alumno    Alumno    @relation(fields: [alumnoId], references: [id], onDelete: Restrict)
  anuladoPor Usuario?  @relation("PagoAnuladoPor", fields: [anuladoPorId], references: [id], onDelete: SetNull)

  @@index([alumnoId, fechaPago])
  @@index([concepto])
  @@index([estado])
  @@map("pago")
}

model Matricula {
  id             String   @id @default(uuid()) @db.Char(36)
  alumnoId       String   @map("alumno_id") @db.Char(36)
  seccionId      String   @map("seccion_id") @db.Char(36)
  anioId         String   @map("anio_id") @db.Char(36)
  estado         String   @default("SOLICITADA") @db.VarChar(20) // SOLICITADA, APROBADA, RECHAZADA, RETIRADA, ANULADA
  fechaSolicitud DateTime @default(now()) @map("fecha_solicitud") @db.DateTime(3)
  fechaAprobacion DateTime? @map("fecha_aprobacion") @db.DateTime(3)
  fechaRetiro    DateTime? @map("fecha_retiro") @db.DateTime(3)
  motivoRetiro   String?  @map("motivo_retiro") @db.Text
  observaciones  String?  @db.Text

  createdAt DateTime  @default(now()) @map("created_at") @db.DateTime(3)
  updatedAt DateTime  @updatedAt @map("updated_at") @db.DateTime(3)
  createdBy String?   @map("created_by") @db.Char(36)
  updatedBy String?   @map("updated_by") @db.Char(36)
  deletedAt DateTime? @map("deleted_at") @db.DateTime(3)

  alumno   Alumno   @relation(fields: [alumnoId], references: [id], onDelete: Restrict)
  seccion  Seccion @relation(fields: [seccionId], references: [id], onDelete: Restrict)
  anio     AnioAcademico @relation(fields: [anioId], references: [id], onDelete: Restrict)
  pagos    Pago[]

  @@unique([alumnoId, anioId], map: "matricula_alumno_anio_key")
  @@index([seccionId, anioId])
  @@index([estado])
  @@map("matricula")
}

model Certificado {
  id            String   @id @default(uuid()) @db.Char(36)
  tipo          String   @db.VarChar(30) // ESTUDIOS, MATRICULA, NO_ADEUDO, CONDUCTA, OTRO
  numero        String   @unique @db.VarChar(30) // CERT-EST-2026-0001
  alumnoId      String   @map("alumno_id") @db.Char(36)
  anioId        String   @map("anio_id") @db.Char(36)
  plantillaId   String?  @map("plantilla_id") @db.Char(36)
  variables     Json     // { "alumno": "...", "fecha_emision": "...", ... }
  estado        String   @default("BORRADOR") @db.VarChar(20) // BORRADOR, EMITIDO, ANULADO
  solicitadoPorId String? @map("solicitado_por_id") @db.Char(36)
  solicitadoAt  DateTime? @map("solicitado_at") @db.DateTime(3)
  aprobadoPorId String?  @map("aprobado_por_id") @db.Char(36)
  aprobadoAt    DateTime? @map("aprobado_at") @db.DateTime(3)
  rechazadoMotivo String? @map("rechazado_motivo") @db.Text
  pdfRuta       String?  @map("pdf_ruta") @db.VarChar(500)

  createdAt DateTime  @default(now()) @map("created_at") @db.DateTime(3)
  updatedAt DateTime  @updatedAt @map("updated_at") @db.DateTime(3)
  createdBy String?   @map("created_by") @db.Char(36)
  updatedBy String?   @map("updated_by") @db.Char(36)
  deletedAt DateTime? @map("deleted_at") @db.DateTime(3)

  alumno       Alumno   @relation(fields: [alumnoId], references: [id], onDelete: Restrict)
  anio         AnioAcademico @relation(fields: [anioId], references: [id], onDelete: Restrict)
  plantilla    PlantillaCertificado? @relation(fields: [plantillaId], references: [id], onDelete: SetNull)
  solicitadoPor Usuario?  @relation("CertificadoSolicitadoPor", fields: [solicitadoPorId], references: [id], onDelete: SetNull)
  aprobadoPor  Usuario?  @relation("CertificadoAprobadoPor", fields: [aprobadoPorId], references: [id], onDelete: SetNull)

  @@index([alumnoId, anioId])
  @@index([tipo, anioId])
  @@index([estado])
  @@map("certificado")
}

model PlantillaCertificado {
  id          String   @id @default(uuid()) @db.Char(36)
  tipo        String   @db.VarChar(30)
  nombre      String   @db.VarChar(100)
  contenido   String   @db.Text // HTML/plantilla con variables {{variable}}
  activa      Boolean  @default(true)
  version     Int      @default(1)

  createdAt DateTime  @default(now()) @map("created_at") @db.DateTime(3)
  updatedAt DateTime  @updatedAt @map("updated_at") @db.DateTime(3)
  createdBy String?   @map("created_by") @db.Char(36)
  updatedBy String?   @map("updated_by") @db.Char(36)
  deletedAt DateTime? @map("deleted_at") @db.DateTime(3)

  certificados Certificado[]

  @@unique([tipo, version], map: "plantilla_certificado_tipo_version_key")
  @@map("plantilla_certificado")
}
```

### Relaciones con entidades existentes

- `Pago.alumnoId` → `Alumno.id`
- `Matricula` ya existe en core; se extiende con campos `estado`, `fechaSolicitud`, etc.
- `Certificado.alumnoId` → `Alumno.id`
- `Certificado.anioId` → `AnioAcademico.id`
- `Certificado.plantillaId` → `PlantillaCertificado.id`

---

## 6. Permisos (RBAC)

Según `docs/rbac-matrix.md` sección **Administrativo**:

| Acción | SA | DI | DO | PA | AL |
|---|---|---|---|---|---|
| Registrar/Anular pagos | ✔ | ✔ | ✖ | ✖ | ✖ |
| Consultar estado de cuenta | ⚠ | ✔ | ✖ | ⚠ | ⚠ |
| Gestionar matrículas | ✔ | ✔ | ✖ | ⚠¹⁰ | ✖ |
| Consultar matrícula | ✔ | ✔ | ✖ | ⚠⁶ | ⚠⁷ |
| Emitir certificados | ✔ | ✔ | ✖ | ✖ | ✖ |
| Solicitar certificados | ✖ | ✖ | ✖ | ⚠⁶ | ⚠⁷ |
| Descargar certificados | ✔ | ✔ | ✖ | ⚠⁶ | ⚠⁷ |

**Códigos de permiso** (se registran en `packages/shared`):
- `administrative.pagos.registrar` — SA, DI
- `administrative.pagos.anular` — SA, DI
- `administrative.pagos.leer` — SA (auditado), DI, PA (vinculado), AL (propio)
- `administrative.matriculas.gestionar` — SA, DI; PA inicia/renueva (⚠¹⁰)
- `administrative.matriculas.leer` — SA, DI, PA (vinculado), AL (propio)
- `administrative.certificados.emitir` — SA, DI
- `administrative.certificados.solicitar` — PA, AL (vinculados)
- `administrative.certificados.descargar` — SA, DI, PA (vinculado), AL (propio)

---

## 7. API Endpoints

### Pagos
| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| POST | `/api/v1/pagos` | `administrative.pagos.registrar` | Registrar pago |
| PATCH | `/api/v1/pagos/:id/anular` | `administrative.pagos.anular` | Anular pago |
| GET | `/api/v1/pagos` | `administrative.pagos.leer` | Listar pagos (filtros, paginación) |
| GET | `/api/v1/alumnos/:id/estado-cuenta` | `administrative.pagos.leer` | Estado de cuenta alumno |

### Matrículas
| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| POST | `/api/v1/administrative/matriculas` | `administrative.matriculas.gestionar` (PA inicia) | Solicitar matrícula |
| PATCH | `/api/v1/administrative/matriculas/:id/aprobar` | `administrative.matriculas.gestionar` | Aprobar matrícula |
| PATCH | `/api/v1/administrative/matriculas/:id/rechazar` | `administrative.matriculas.gestionar` | Rechazar matrícula |
| PATCH | `/api/v1/administrative/matriculas/:id/retirar` | `administrative.matriculas.gestionar` | Retirar matrícula |
| GET | `/api/v1/administrative/matriculas` | `administrative.matriculas.leer` | Listar matrículas |

### Certificados
| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| POST | `/api/v1/certificados` | `administrative.certificados.emitir` | Emitir certificado |
| POST | `/api/v1/certificados/solicitar` | `administrative.certificados.solicitar` | Solicitar certificado |
| PATCH | `/api/v1/certificados/:id/aprobar` | `administrative.certificados.emitir` | Aprobar solicitud |
| PATCH | `/api/v1/certificados/:id/rechazar` | `administrative.certificados.emitir` | Rechazar solicitud |
| GET | `/api/v1/certificados` | `administrative.certificados.leer` | Listar certificados |
| GET | `/api/v1/certificados/:id/download` | `administrative.certificados.descargar` | Descargar PDF |
| GET | `/api/v1/plantillas-certificados` | `administrative.certificados.emitir` | Listar plantillas |
| POST | `/api/v1/plantillas-certificados` | `administrative.certificados.emitir` | Crear plantilla |

---

## 8. Criterios de Aceptación

### Pagos
- [ ] Registrar pago con todos los campos obligatorios; respuesta 201 con DTO
- [ ] Anular pago con motivo; pago pasa a `ANULADO`; auditoría registrada
- [ ] Listar con filtros y paginación; respuesta con `meta.total`
- [ ] Estado de cuenta muestra totales pagados/pendientes por concepto

### Matrículas
- [ ] Apoderado crea solicitud; estado `SOLICITADA`; notificación
- [ ] Director aprueba; valida capacidad y apoderado principal; estado `APROBADA`
- [ ] Rechazo con motivo; estado `RECHAZADA`
- [ ] Retiro libera cupo; estado `RETIRADA`
- [ ] Filtros por año, nivel, grado, sección, estado funcionan

### Certificados
- [ ] Director emite certificado con plantilla; numeración correlativa
- [ ] Apoderado solicita; estado `SOLICITADO` → `APROBADO`/`RECHAZADO`
- [ ] Descarga PDF con variables resueltas; control de acceso por rol
- [ ] Plantillas CRUD con variables `{{variable}}`

---

## 9. Auditoría

Todas las operaciones de escritura (pagos, matrículas, certificados) registran auditoría con:
- `usuarioId`, `accion` (CREAR, ACTUALIZAR, ANULAR, APROBAR, RECHAZAR, EMITIR, SOLICITAR)
- `entidad` (`Pago`, `Matricula`, `Certificado`, `PlantillaCertificado`)
- `entidadId`, `anterior` (si aplica), `nuevo`, `ip`, `userAgent`

Accesos a estado de cuenta y descarga de certificados también se auditan (`ACCEDER`).

---

## 10. Fuera de Alcance (MVP)

- Pasarela de pagos en línea (Stripe, Culqi, etc.)
- Facturación electrónica SUNAT
- Conciliación bancaria automática
- Notificaciones push/email/SMS
- Módulo contable completo (mayor, balances, libros)
- Firma digital certificada (opcional post-MVP)

---

## 11. Constitution Check

| Sección | Cumple | Observación |
|---|---|---|
| Precedencia (§I) | ✔ | spec.md fuente única |
| SDD (§II) | ✔ | Requerimientos, modelo, criterios |
| Arquitectura (§III) | ✔ | Monorepo, shared, API REST |
| Datos (§IV) | ✔ | UUID, DECIMAL, auditoría, soft delete |
| RBAC (§V) | ✔ | Permisos en rbac-matrix.md |
| Privacidad (§VI) | ✔ | Sin PII en logs/URLs, auditoría con redaction |
| Pruebas (§VII) | ✔ | 70% cobertura, casos feliz+error |
| UX (§VIII) | ✔ | es-PE, mobile-first, WCAG 2.1 AA |
| Operación (§IX) | ✔ | Migraciones Prisma, health check |
| Gobernanza (§X) | ✔ | Versionado specs, ADRs, glosario |

---

## 12. Referencias

- `docs/constitution.md` v2.1.0
- `docs/rbac-matrix.md` (sección Administrativo)
- `docs/architecture.md` (estado actual)
- `specs/core/001-spec-mvp/` (entidades raíz: Alumno, Usuario, Institucion, AnioAcademico, etc.)
- `specs/academic/001-spec-mvp/` (entidades académicas: Curso, Seccion, Matricula base)