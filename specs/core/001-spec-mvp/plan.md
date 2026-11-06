# Plan Técnico: Núcleo del Dominio y Autenticación

| Campo | Valor |
|---|---|
| Spec asociada | `specs/core/001-spec-mvp/spec.md` |
| Versión | `1.1.0` |
| Estado | `aprobado` |
| Fecha | 2026-11-05 |

## 1. Resumen

Se implementa el módulo `core` de la API: modelo de datos base, autenticación con tokens, RBAC con permisos granulares, estructura escolar configurable (N períodos), gestión de personas y auditoría. En el frontend se añade el esqueleto de autenticación: router, contexto de sesión, pantalla de login y guard de rutas.

No se implementa lógica de negocio de los otros cuatro módulos.

## 2. Constitution Check

| Principio | Cumple | Observación |
|---|---|---|
| Precedencia y alcance del MVP | Sí | Solo entidades núcleo; nada de pagos ni notas |
| Arquitectura y límites entre features | Sí | `apps/api/src/modules/core`, contratos en `packages/shared` |
| Datos: UUID, auditoría, borrado lógico | Sí | Aplicado en todas las entidades |
| Escala literal AD/A/B/C | No aplica | Se usará en el módulo académico |
| Períodos configurables (sin hardcodeo) | Sí | `PeriodoAcademico` con N registros; prueba con 3 y 4 |
| RBAC validado en backend | Sí | Permisos `core.*` y verificación de vínculo |
| Privacidad (sin PII en logs) | Sí | Logger con redacción de campos sensibles |
| Tests como puerta | Sí | Vitest + Supertest desde la primera tarea |
| Accesibilidad y estados de UI | Sí | Login con etiquetas, foco y estados de error |

## 3. Arquitectura de la feature

### Backend

```text
apps/api/src/
├─ core/
│  ├─ config.ts            # entorno validado con Zod
│  ├─ db.ts                # PrismaClient singleton
│  ├─ errors.ts            # clases de error y sobre de respuesta
│  ├─ audit.ts             # servicio de auditoría
│  ├─ auth/
│  │  ├─ password.ts       # argon2id
│  │  ├─ tokens.ts         # jose: access + refresh
│  │  └─ guards.ts         # requireAuth, requirePermission, requireVinculo
│  └─ rbac.ts              # catálogo de permisos y unión por roles
├─ modules/core/
│  ├─ auth/                # rutas, controller, service
│  ├─ usuarios/
│  ├─ estructura/          # años, períodos, niveles, grados, secciones, cursos
│  ├─ personas/            # alumnos, docentes, apoderados
│  ├─ matriculas/
│  └─ auditoria/
└─ server.ts
```

Separación `routes → controller → service → repository` en cada módulo.

### Contratos compartidos

```text
packages/shared/src/
├─ domain/                 # tipos de entidad
├─ schemas/core/           # Zod: crear/editar, filtros, paginación
└─ contracts/core/         # DTOs de request/response
```

### Frontend

```text
apps/web/src/
├─ app/
│  ├─ router.tsx
│  ├─ providers.tsx
│  └─ guards/RequireAuth.tsx
├─ features/auth/
│  ├─ api.ts
│  ├─ AuthProvider.tsx
│  ├─ LoginPage.tsx
│  └─ ForgotPasswordPage.tsx
└─ shared/api/client.ts
```

El token de acceso se guarda **en memoria**. El refresh vive en cookie `httpOnly` y se usa al recargar la página (`POST /auth/refresh`).

## 4. Modelo de datos y migraciones

Migración inicial: `core_init`.

| Cambio | Entidad | Tipo |
|---|---|---|
| Crear | `Institucion`, `Persona`, `Usuario`, `Rol`, `UsuarioRol` | tablas |
| Crear | `SesionRefresh`, `TokenRecuperacion` | tablas |
| Crear | `AnioAcademico`, `PeriodoAcademico` | tablas |
| Crear | `Nivel`, `Grado`, `Seccion`, `Curso` | tablas |
| Crear | `Alumno`, `Docente`, `Apoderado`, `ApoderadoAlumno` | tablas |
| Crear | `Matricula`, `AsignacionDocente` | tablas |
| Crear | `Auditoria` | tabla |
| Índices | `usuario.username`, `usuario.email`, `persona(tipo_documento, numero_documento)`, `matricula(alumno_id, anio_id)` | únicos |
| Índices | `periodo(anio_id, orden)`, `seccion(grado_id, anio_id, nombre)` | únicos |

Notas específicas de MySQL:

- No hay índices parciales: la unicidad del año activo y del apoderado principal se garantiza en el servicio dentro de una transacción, con prueba de concurrencia.
- Enums como `VARCHAR` con validación Zod + `CHECK` donde aplique, para evitar migraciones costosas al agregar valores.
- Fechas `DATETIME(3)` en UTC.
- Datos personales y tokens se almacenan con los campos mínimos.

Seed de desarrollo (`prisma/seed.ts`):

- 5 roles con sus permisos.
- Institución de ejemplo.
- Un `SuperAdmin` creado desde variables de entorno (`SEED_ADMIN_USERNAME`, `SEED_ADMIN_PASSWORD`).
- **Nunca** se ejecuta en producción.

## 5. Contratos de API

Se implementan los endpoints de la spec §7. Convenciones:

- Prefijo `/api/v1`.
- `accessToken` en `Authorization: Bearer`.
- Refresh en cookie `refresh_token`: `httpOnly`, `Secure` en producción, `SameSite=Lax`, path `/api/v1/auth`.
- Errores con `{ error: { code, message, details } }`.
- Paginación `?page&pageSize` con `meta`.
- Validación Zod en cada endpoint.

Recuperación de contraseña (RF-CORE-007):

- `POST /auth/forgot-password` es público y **siempre** responde `202`, exista o no el correo.
- `POST /auth/reset-password` consume el token de un solo uso (30 minutos) y revoca todas las sesiones del usuario.
- `POST /usuarios/:id/token-recuperacion` permite a quien tenga `core.usuarios.gestionar` obtener el token en claro una única vez, ya que el MVP no envía correo. Emitir uno nuevo invalida el anterior sin usar.
- El token se guarda solo como hash SHA-256; el valor en claro nunca se persiste ni se registra en logs.

Permisos:

- `core.institucion.editar`
- `core.usuarios.gestionar`
- `core.estructura.gestionar`
- `core.matriculas.gestionar`
- `core.auditoria.leer`
- `core.perfil.leer`

## 6. Dependencias nuevas

Todas están en `docs/stack.md`, por lo que no requieren aprobación adicional:

| Paquete | Motivo |
|---|---|
| `prisma`, `@prisma/client` | ORM y migraciones |
| `@prisma/adapter-mariadb` | Driver adapter de Prisma 7 para MySQL (ver nota) |
| `argon2` | Hash de contraseñas |
| `jose` | Firma y verificación de JWT |
| `react-router` | Router del frontend |

**Nota sobre `@prisma/adapter-mariadb`:** Prisma 7 activa el *query compiler* y elimina el motor Rust. `new PrismaClient()` sin opciones falla con «A driver adapter is required to connect to your database». Se evaluó bajar a Prisma 6 para evitarlo, pero el adaptador es oficial, añade una dependencia mínima y mantiene la versión mayor actual. Aprobado el 2026-11-05.

No se agregarán librerías de UI en esta fase.

## 7. Estrategia de pruebas

| Nivel | Casos |
|---|---|
| Dominio | Unión de permisos por roles; validación de estados; configuración de 3 y 4 períodos |
| API | Login válido/inválido, rate limit, refresh y revocación, recuperación con token de un solo uso, CRUD con permisos, matrícula duplicada, año activo único |
| Integración | Transacción de activación de año; cierre de período; vínculo apoderado–alumno |
| UI | Render de login, error de credenciales, redirección de guard |
| E2E | Diferido a la primera feature con flujo completo |

Cobertura mínima: 70 % en servicios de `core`.

## 8. Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Unicidad del año activo sin índice parcial | Datos inconsistentes | Transacción + prueba de concurrencia |
| Roles múltiples complican el RBAC | Permisos mal evaluados | Permisos efectivos calculados en un solo servicio y probados |
| Recuperación de contraseña sin correo | Usuarios bloqueados | Token entregado por administración vía endpoint protegido (Q4) |
| Refresh token robado | Suplantación | Rotación, revocación y almacenamiento del hash |
| Prisma + MySQL en Windows | Fricción de configuración | Documentar `.env` y usar `prisma migrate dev` |
| Crecimiento del módulo core | Acoplamiento | Submódulos por carpeta y límites de importación |

## 9. Orden de implementación

1. Prisma, base de datos y migración inicial.
2. Contratos y schemas en `packages/shared`.
3. Configuración, errores y auditoría.
4. Autenticación y RBAC.
5. Estructura académica y personas.
6. Matrículas y asignaciones.
7. Frontend de autenticación.
8. Pruebas de cierre y documentación.

## 10. Trazabilidad requisito → tarea

| Requerimiento | Tareas |
|---|---|
| RF-CORE-001 | T020 |
| RF-CORE-002, RF-CORE-003 | T009, T010, T017, T018 |
| RF-CORE-004, RF-CORE-006 | T011, T013, T015 |
| RF-CORE-005 | T012 |
| RF-CORE-007 | T014 |
| RF-CORE-008, RF-CORE-009 | T021, T022, T028 |
| RF-CORE-010, RF-CORE-011 | T023, T024, T027 |
| RF-CORE-012, RF-CORE-013, RF-CORE-014 | T025 |
| RF-CORE-015 | T026 |
| RF-CORE-016 | T029, T030, T031 |
| RF-CORE-017 | T039 |
| Autenticación en UI | T033–T038 |

## 11. Notas de implementación

- Los permisos se definen como constantes en `packages/shared` para que el frontend y el backend usen los mismos códigos.
- El guard de vínculo es obligatorio: rol correcto **no** implica acceso al recurso.
- El logger debe redactar `password`, `passwordHash`, `token`, `refreshToken` y `authorization`.
- Las operaciones que cambian notas, pagos o datos personales escriben auditoría dentro de la misma transacción.
- No se implementa envío de correo en esta fase.
