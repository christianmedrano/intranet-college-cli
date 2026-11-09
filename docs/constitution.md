# Constitución del Proyecto: Intranet Escolar (MVP)

> **Versión:** 2.1.0
> **Ratificada:** 2026-11-05
> **Actualizada:** 2026-11-08
> **Ámbito:** repositorio `intranet-college-cli`
> **Autoridad:** este documento prevalece sobre `spec.md`, `plan.md`, `tasks.md` y el código.

## §0. Metadatos y alcance

### Alcance del MVP

1. **Core:** entidades raíz del dominio, autenticación, roles y auditoría.
2. **Académico:** calificaciones, asistencias y horarios.
3. **Administrativo:** pagos (solo registro y consulta), matrículas y certificados.
4. **Comunicación:** anuncios institucionales y mensajería docente ↔ apoderado.
5. **Aula virtual:** repositorio de materiales por curso y período.

### Fuera de alcance del MVP

- Pasarela de pagos en línea.
- Escala numérica interna 0–20. La escala oficial es literal **AD / A / B / C**.
- Notificaciones push o correo transaccional.
- Multi-colegio: un despliegue atiende a una sola institución educativa.
- Aplicación móvil nativa y videoconferencia.

### Estado del repositorio

Esta constitución describe el **estado objetivo**. El estado real de implementación se mantiene en `docs/architecture.md` (§ Estado actual). Ningún agente debe asumir que algo existe por estar descrito aquí: debe verificarlo en el repositorio.

---

## §I. Precedencia y enmiendas

### 1.1 Orden de autoridad

```
constitution.md  >  spec.md  >  plan.md  >  tasks.md  >  código
```

Ante cualquier conflicto, prevalece el documento de mayor jerarquía. Si el código contradice una spec, el código está mal.

### 1.2 Enmiendas

Toda modificación a esta constitución requiere:

1. Propuesta escrita con la cláusula afectada y su justificación.
2. Aprobación humana explícita.
3. Incremento de versión según semver (MAJOR si cambia un principio, MINOR si agrega una regla, PATCH si corrige redacción).
4. Registro en el historial de cambios al final del documento.

Un agente **no puede** modificar este archivo por iniciativa propia.

---

## §II. Spec-Driven Development y trazabilidad

### 2.1 La especificación es la fuente única de verdad

Ninguna funcionalidad de frontend, backend o base de datos se implementa si no está descrita y aprobada en `specs/<modulo>/<feature-folder>/spec.md`.

### 2.2 Ciclo obligatorio

| Archivo | Responde | Contenido mínimo |
|---|---|---|
| `spec.md` | ¿Qué? | Requerimientos, reglas de negocio, modelo de datos, criterios de aceptación |
| `plan.md` | ¿Cómo? | Arquitectura, contratos de API, migraciones, pruebas, **Constitution Check** |
| `tasks.md` | ¿Con qué pasos? | Tareas atómicas, ordenadas, con ID de requerimiento y criterio de aceptación |

No se escribe `plan.md` sin `spec.md` aprobada. No se escribe `tasks.md` sin `plan.md` aprobado. No se escribe código sin `tasks.md`.

### 2.3 Identificadores y trazabilidad

- Requerimiento funcional: `RF-<MOD>-NNN` (por ejemplo `RF-ACAD-012`).
- Regla de negocio: `RN-<MOD>-NNN`.
- Tarea: `TNNN`, siempre citando el `RF` o `RN` que implementa.
- Todo `plan.md` incluye una tabla de trazabilidad `RF → tareas`.

### 2.4 Cero adivinación de reglas de negocio

Si falta información sobre procesos escolares, el agente se detiene y pregunta. Está prohibido inventar escalas, fórmulas, umbrales, flujos de aprobación o permisos. Las preguntas abiertas se registran en la sección correspondiente del `spec.md`.

### 2.5 Constitution Check

Todo `plan.md` incluye una sección **Constitution Check** con el resultado explícito de revisar: precedencia, arquitectura, datos, seguridad, privacidad, pruebas y límites de alcance. Un plan con el check incompleto no se aprueba.

---

## §III. Arquitectura y stack tecnológico

### 3.1 Repositorio: monorepo con workspaces

```text
intranet-college-cli/
├─ apps/
│  ├─ web/          React 19 + Vite + TypeScript + Tailwind CSS
│  └─ api/          Node.js + Fastify + Prisma + MySQL 8
├─ packages/
│  └─ shared/       Tipos de dominio, schemas Zod y contratos de API
├─ specs/           Especificaciones (fuente de verdad)
├─ docs/            Gobernanza, arquitectura, plantillas y ADRs
├─ AGENTS.md
└─ CLAUDE.md
```

### 3.2 Reglas de dependencia

1. `packages/shared` es el **único** lugar para tipos de dominio, schemas Zod y contratos consumidos por más de una aplicación.
2. `apps/web` no importa código de `apps/api`, ni viceversa. La comunicación es por HTTP.
3. Una feature no importa código de otra feature. Lo transversal vive en `shared/`.
4. `specs/core` es dueño de las entidades raíz (`Alumno`, `Docente`, `Apoderado`, `Curso`, `Sección`, `Usuario`, `Rol`, `AnioAcademico`, `PeriodoAcademico`). Ningún módulo las redefine.
5. Las reglas de negocio autoritativas viven en los servicios de `apps/api`. El frontend solo las presenta y valida para mejorar la experiencia.

### 3.3 Stack obligatorio

| Capa | Tecnología |
|---|---|
| Frontend | React + TypeScript + Vite + Tailwind CSS |
| Backend | Node.js + Fastify + TypeScript |
| ORM y migraciones | Prisma |
| Base de datos | MySQL 8.0.16+ (InnoDB, `utf8mb4`) |
| Validación | Zod, compartido entre cliente y servidor |
| Pruebas | Vitest + Testing Library + Supertest + Playwright |

Cambiar cualquiera de estas piezas requiere una enmienda a la constitución y un ADR.

### 3.4 Política de dependencias

- Usar librerías es correcto cuando reducen riesgo o código propio; lo prohibido es instalar sin control.
- Toda dependencia fuera de la lista aprobada en `docs/stack.md` requiere aprobación humana y justificación registrada en el `plan.md` de la feature.
- Antes de proponer una dependencia, el agente debe verificar que el stack aprobado o una API nativa no cubran ya la necesidad.
- Prohibido agregar dependencias duplicadas, sin mantenimiento o más de una librería para la misma función.

### 3.5 Prohibiciones arquitectónicas

- Lógica de negocio en componentes de UI.
- Acceso directo a la base de datos desde `apps/web`.
- Tipos de dominio duplicados entre módulos.
- `any` sin justificación aprobada.
- Uso de `localStorage` para datos sensibles o de sesión.

---

## §IV. Datos y persistencia

### 4.1 Convenciones

- Clave primaria: UUID generado en la aplicación.
- Auditoría obligatoria en toda entidad: `created_at`, `updated_at`, `created_by`, `updated_by`.
- Nombres de tabla y columna en `snake_case`; modelos Prisma en `PascalCase`.
- Fechas almacenadas en **UTC**; se convierten a `America/Lima` solo en presentación.
- Montos monetarios en `DECIMAL(10,2)`, moneda `PEN`. Prohibido `FLOAT` para dinero.
- Charset `utf8mb4` y colación `utf8mb4_0900_ai_ci`.
- Migraciones versionadas con `prisma migrate`. Prohibido `db push` fuera de desarrollo local.
- Datos semilla solo en desarrollo; nunca en producción.
- Restricciones críticas se validan en base de datos **y** con Zod.

### 4.2 Integridad histórica

- Prohibido el borrado físico de calificaciones, asistencias, matrículas y pagos. Se usa borrado lógico (`deleted_at`) más auditoría.
- Toda corrección de nota, asistencia o pago queda registrada con autor, fecha y motivo.
- Cerrar un período académico bloquea la edición de calificaciones. La reapertura o corrección requiere permiso explícito y auditoría.

### 4.3 Escala de calificación

- La escala oficial es literal **AD / A / B / C** y aplica a Inicial, Primaria y Secundaria.
- Es la única escala válida para actas, libretas y certificados (equivalencia con SIAGIE).
- El MVP **no** implementa escala numérica interna 0–20 ni tablas de conversión.
- Todo documento oficial renderiza siempre el valor literal.
- Prohibido asumir equivalencias entre literal y numérico.

### 4.4 Períodos académicos

- La cantidad y duración de los períodos **no se codifica de forma fija**.
- Al inicio del año lectivo, Dirección o Administración configura el calendario: bimestral (4), trimestral (3) u otro esquema definido por la institución.
- El modelo debe soportar **N períodos** por año académico, cada uno con nombre, orden, fecha de inicio, fecha de fin y estado (`planificado`, `activo`, `cerrado`).
- Toda calificación se asocia a un período y a un año académico.
- Al cerrar un período se bloquea la edición de notas; toda corrección posterior requiere permiso explícito y queda auditada.
- **Prohibido** en código: constantes, enums, seeds o validaciones que asuman exactamente 4 bimestres.
- Debe existir una prueba que verifique el funcionamiento con 3 y con 4 períodos.

---

## §V. Seguridad, identidad y RBAC

### 5.1 Autoridad de permisos

- El backend es la única autoridad de autorización. El frontend solo oculta o muestra UI.
- Todo endpoint valida identidad, rol y vínculo con el recurso antes de devolver datos.
- La matriz de `docs/rbac-matrix.md` es normativa. Una feature puede restringir permisos, nunca ampliarlos.

### 5.2 Roles

`SuperAdmin`, `Director`, `Docente`, `Padre/Apoderado`, `Alumno`.

### 5.3 Autenticación

- Contraseñas con `Argon2id` (o `bcrypt` con coste mínimo 12).
- Token de acceso de vida corta y refresh token en cookie `httpOnly`, `Secure` y `SameSite`.
- Rotación y revocación de refresh tokens.
- Rate limiting en login: máximo 5 intentos fallidos por 15 minutos.
- Recuperación de contraseña con token de un solo uso y expiración.
- Prohibido almacenar tokens en `localStorage` o `sessionStorage`.

### 5.4 Validación y superficie de ataque

- Toda entrada se valida con Zod en el borde de la API.
- CORS restringido a orígenes explícitos por entorno.
- Errores al cliente sin trazas internas ni detalles de base de datos.
- Consultas parametrizadas vía Prisma; prohibido SQL concatenado.
- Archivos subidos: lista blanca de tipos, tamaño máximo configurable y nombre saneado.
- Secretos solo en variables de entorno; prohibido en el bundle del cliente.

### 5.5 Auditoría

- Todo acceso o modificación de calificaciones, pagos y datos personales se registra con usuario, fecha, recurso y acción.
- La auditoría no se puede desactivar por configuración de feature.

### 5.6 Catálogo de permisos

- Los permisos se nombran `modulo.recurso.accion` y su catálogo tipado vive en `packages/shared`.
- `docs/rbac-matrix.md` es la fuente normativa de la asignación rol–permiso y registra el código concreto de cada acción.
- Un permiso que no esté registrado en la matriz no puede implementarse.

---

## §VI. Privacidad y cumplimiento

1. **Marco legal:** Ley N.º 29733 de Protección de Datos Personales (Perú) y su reglamento.
2. **Minimización:** solo se recogen los datos necesarios para la finalidad declarada.
3. **Datos de menores:** acceso limitado a quien tenga vínculo legítimo; consentimiento gestionado a través del apoderado.
4. **Prohibido** registrar PII en logs, mensajes de error, URLs o almacenamiento del navegador.
5. **Retención:** los registros académicos y financieros se conservan según la normativa aplicable; la política concreta se define en cada spec.
6. **Derechos:** acceso, rectificación y cancelación se atienden por el canal que defina el módulo administrativo.
7. **Transferencias:** prohibido compartir datos con terceros sin base legal y consentimiento.
8. **Transporte:** HTTPS obligatorio en cualquier entorno distinto de local.

---

## §VII. Calidad y pruebas

### 7.1 Tipado

- `strict: true`, `noUncheckedIndexedAccess: true`, `noUnusedLocals`, `noUnusedParameters`.
- `@typescript-eslint/no-explicit-any` en nivel **error**.
- Prohibido `as` para silenciar errores de tipo. Si es imprescindible, requiere justificación y aprobación.
- TSDoc en funciones y servicios de dominio.

### 7.2 Tests como puerta

- **Toda tarea termina con sus tests en verde.** Prohibido marcar `[x]`, hacer commit o avanzar con tests en rojo.
- Prohibido `skip`, `todo` u `only` en la rama principal.
- Toda tarea de implementación incluye al menos: caso feliz + caso de error o validación.
- Gate obligatorio antes de cerrar una tarea:

```bash
npm run lint && npm run typecheck && npm test
```

- Si un test falla por una causa ajena a la tarea, el agente **se detiene y lo reporta**. No lo arregla en silencio, no lo deshabilita y no lo marca como conocido sin aprobación.
- Cobertura mínima: **70 %** en dominio y servicios. No se exige umbral en componentes de UI.

### 7.3 Estrategia por capa

| Capa | Herramienta | Alcance mínimo |
|---|---|---|
| Dominio y servicios | Vitest | Reglas de negocio y casos borde |
| API | Vitest + Supertest | Contratos, permisos y errores |
| UI | Testing Library | Flujos y estados |
| E2E | Playwright | Login, notas, asistencia, pagos |

### 7.4 Prohibiciones

- `console.log` en código de producción.
- Tests que dependan del orden de ejecución o de datos reales.
- Mocks que oculten la lógica que se pretende probar.

---

## §VIII. UX, accesibilidad e idioma

1. **Mobile-first:** padres y alumnos acceden principalmente desde el teléfono.
2. **Accesibilidad:** WCAG 2.1 AA. Navegación por teclado, foco visible, contraste y etiquetas en formularios.
3. **Idioma:** interfaz en `es-PE`. El código (identificadores) en inglés; los textos visibles en español.
4. **Estados obligatorios:** toda vista cubre carga, vacío, error y éxito.
5. **Fechas:** se muestran en `America/Lima`.
6. **Privacidad en URLs:** prohibido incluir datos personales en rutas o query strings.
7. **Mensajes de error:** claros para el usuario, sin detalles técnicos.

---

## §IX. Operación y entorno

1. **Node.js:** versión LTS 20 o superior.
2. **Variables de entorno:** validadas al arranque con Zod. `.env.example` documentado; `.env` nunca versionado.
3. **Git:** obligatorio. Ramas `feat/<modulo>-<feature>`, `fix/<descripcion>`; commits convencionales (`feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`).
4. **CI:** ejecuta `lint`, `typecheck` y `test` en cada push y pull request. Un pipeline rojo bloquea el merge.
5. **Migraciones:** se aplican en el despliegue con `prisma migrate deploy`.
6. **Respaldos:** diarios en producción, con restauración verificada.
7. **Logs:** estructurados, con nivel y correlación de petición; sin PII.
8. **Salud:** endpoint de health check para la API y la base de datos.

---

## §X. Gobernanza de cambios

1. **Versionado de specs:** un cambio de alcance genera una nueva carpeta `00N-spec-*`; no se sobrescribe una spec aprobada.
2. **ADRs:** toda decisión técnica relevante se registra en `docs/adr/` con contexto, decisión y consecuencias.
3. **Glosario:** todo término de dominio nuevo se agrega a `docs/glossary.md` antes de usarse en una spec.
4. **Revisión:** ninguna tarea se cierra sin revisión de cumplimiento (agente `reviewer` o revisión humana).
5. **Definition of Done:** el anexo A es la única lista de cierre válida.

---

## Anexo A. Definition of Done

Una tarea solo se marca como completada si cumple **todo** lo siguiente:

- [ ] Está definida en `tasks.md` y cita su `RF` o `RN`.
- [ ] El código compila con TypeScript estricto, sin `any` y sin advertencias de lint.
- [ ] Incluye pruebas del caso feliz y de al menos un caso de error.
- [ ] El gate `lint + typecheck + test` está en verde.
- [ ] Los permisos se validan en el backend y coinciden con la matriz RBAC.
- [ ] No se registran datos personales en logs ni en el navegador.
- [ ] La UI cubre estados de carga, vacío y error, y es navegable por teclado.
- [ ] `spec.md` y `tasks.md` reflejan el estado real.
- [ ] No se agregaron dependencias sin aprobación.

---

## Historial de cambios

| Versión | Fecha | Cambio |
|---|---|---|
| 1.0.0 | — | Versión inicial del proyecto |
| 2.0.0 | 2026-11-05 | Reescritura: precedencia, monorepo, MySQL 8, política de dependencias, períodos configurables, escala literal CNEB, tests como puerta, privacidad y Definition of Done |
| 2.1.0 | 2026-11-08 | Se incorpora el catálogo de permisos (§5.6) y se registran en la matriz RBAC los códigos académicos, incluido el docente tutor (`es_tutor`) |
