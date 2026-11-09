# Matriz RBAC

> Documento normativo. Referenciado por `docs/constitution.md` §V.
> El backend es la autoridad de permisos; el frontend solo oculta UI.

## Leyenda

| Símbolo | Significado |
|---|---|
| ✔ | Permitido |
| ✖ | Prohibido |
| ⚠ | Permitido con restricción (se indica en la nota) |

## Roles

`SA` SuperAdmin · `DI` Director · `DO` Docente · `PA` Padre/Apoderado · `AL` Alumno

## Matriz

### Core y configuración

| Recurso / acción | SA | DI | DO | PA | AL |
|---|---|---|---|---|---|
| Configuración de la institución | ✔ | ✔ | ✖ | ✖ | ✖ |
| Gestión de usuarios y roles | ✔ | ⚠¹ | ✖ | ✖ | ✖ |
| Año académico y períodos | ✔ | ✔ | ✖ | ✖ | ✖ |
| Cierre y reapertura de período | ✔ | ✔ | ✖ | ✖ | ✖ |
| Consulta de auditoría | ✔ | ⚠² | ✖ | ✖ | ✖ |

¹ El Director solo gestiona docentes, apoderados y alumnos de su institución. No puede crear SuperAdmins.
² El Director accede en modo lectura y solo a eventos de su institución.

### Académico

| Recurso / acción | SA | DI | DO | PA | AL |
|---|---|---|---|---|---|
| Registrar o editar calificaciones | ✖ | ⚠³ | ⚠⁴ | ✖ | ✖ |
| Consultar calificaciones | ⚠⁵ | ✔ | ⚠⁴ | ⚠⁶ | ⚠⁷ |
| Registrar asistencia | ✖ | ✔ | ⚠⁴ | ✖ | ✖ |
| Justificar falta | ✖ | ✔ | ⚠⁸ | ⚠⁹ | ✖ |
| Consultar asistencia | ✖ | ✔ | ⚠⁴ | ⚠⁶ | ⚠⁷ |
| Gestionar horarios | ✔ | ✔ | ✖ | ✖ | ✖ |
| Consultar horarios | ✔ | ✔ | ⚠⁴ | ⚠⁶ | ⚠⁷ |

³ Solo correcciones posteriores al cierre de período, con motivo obligatorio y auditoría.
⁴ Limitado a los cursos y secciones asignados al docente.
⁵ El SuperAdmin accede para soporte técnico; todo acceso queda auditado.
⁶ Limitado a los alumnos de los que es apoderado.
⁷ Limitado al propio alumno.
⁸ Solo el docente tutor de la sección (`AsignacionDocente.es_tutor`) o el Director.
⁹ El apoderado puede solicitar la justificación; la aprobación es del docente tutor o director.

**Códigos de permiso académicos**

Los códigos siguientes son la implementación normativa de la tabla anterior y se registran en `packages/shared`:

| Código | SA | DI | DO | PA | AL | Restricción |
|---|---|---|---|---|---|---|
| `academic.calificaciones.gestionar` | ✖ | ✖ | ✔ | ✖ | ✖ | Solo cursos y secciones asignados; período no cerrado |
| `academic.calificaciones.corregir` | ✖ | ✔ | ✖ | ✖ | ✖ | Solo tras el cierre, con motivo y auditoría |
| `academic.calificaciones.leer` | ✔ | ✔ | ✔ | ✔ | ✔ | SA auditado; DO asignado; PA vinculado; AL propio |
| `academic.asistencias.gestionar` | ✖ | ✔ | ✔ | ✖ | ✖ | DO solo en sus secciones |
| `academic.asistencias.leer` | ✖ | ✔ | ✔ | ✔ | ✔ | DO asignado; PA vinculado; AL propio |
| `academic.asistencias.solicitar` | ✖ | ✖ | ✖ | ✔ | ✖ | Solo alumnos vinculados |
| `academic.asistencias.justificar` | ✖ | ✔ | ✔ | ✖ | ✖ | DO solo como tutor de la sección |
| `academic.horarios.gestionar` | ✔ | ✔ | ✖ | ✖ | ✖ | — |
| `academic.horarios.leer` | ✔ | ✔ | ✔ | ✔ | ✔ | DO asignado; PA vinculado; AL propio |

La configuración del umbral de inasistencias reutiliza `core.estructura.gestionar` (SA y DI); las alertas se consultan con `academic.asistencias.leer`.

### Administrativo

| Recurso / acción | SA | DI | DO | PA | AL |
|---|---|---|---|---|---|
| Registrar o anular pagos | ✔ | ✔ | ✖ | ✖ | ✖ |
| Consultar estado de cuenta | ⚠⁵ | ✔ | ✖ | ⚠⁶ | ⚠⁷ |
| Gestionar matrículas | ✔ | ✔ | ✖ | ⚠¹⁰ | ✖ |
| Consultar matrícula | ✔ | ✔ | ✖ | ⚠⁶ | ⚠⁷ |
| Emitir certificados y constancias | ✔ | ✔ | ✖ | ✖ | ✖ |
| Solicitar certificados | ✖ | ✖ | ✖ | ⚠⁶ | ⚠⁷ |
| Descargar certificados emitidos | ✔ | ✔ | ✖ | ⚠⁶ | ⚠⁷ |

¹⁰ El apoderado inicia o renueva la solicitud; la aprobación es administrativa.

### Comunicación

| Recurso / acción | SA | DI | DO | PA | AL |
|---|---|---|---|---|---|
| Publicar anuncios institucionales | ✔ | ✔ | ✖ | ✖ | ✖ |
| Publicar anuncios de sección | ✖ | ✔ | ⚠¹¹ | ✖ | ✖ |
| Leer anuncios | ✔ | ✔ | ✔ | ⚠¹² | ⚠¹² |
| Enviar mensajes | ✖ | ⚠¹³ | ⚠¹⁴ | ⚠¹⁴ | ⚠¹⁵ |
| Supervisar mensajes | ⚠⁵ | ⚠¹⁶ | ✖ | ✖ | ✖ |

¹¹ Solo en secciones donde el docente es tutor.
¹² Solo anuncios dirigidos a su nivel, grado, sección o rol.
¹³ Solo comunicaciones institucionales.
¹⁴ Solo entre docentes y apoderados con vínculo académico.
¹⁵ Solo si la spec de comunicación lo habilita; por defecto deshabilitado.
¹⁶ Solo ante una denuncia o auditoría formal, con registro de acceso.

### Aula virtual

| Recurso / acción | SA | DI | DO | PA | AL |
|---|---|---|---|---|---|
| Subir o editar materiales | ✖ | ✔ | ⚠⁴ | ✖ | ✖ |
| Consultar y descargar materiales | ⚠⁵ | ✔ | ⚠⁴ | ⚠⁶ | ⚠⁷ |
| Eliminar materiales | ✔ | ✔ | ⚠⁴ | ✖ | ✖ |

## Reglas de aplicación

1. La matriz es un **máximo**: una feature puede restringir, nunca ampliar.
2. Todo endpoint valida rol **y** vínculo con el recurso (sección, curso, alumno).
3. Los permisos no se deducen del frontend: se revalidan en el backend.
4. Todo acceso a calificaciones, pagos y datos personales se audita.
5. Un permiso nuevo requiere actualizar este documento y la constitución antes de implementarse.
