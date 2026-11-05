# Constitución del Proyecto: Intranet Escolar (MVP)

## I. Principios de Spec-Driven Development (SDD)
1. **La Especificación es la Fuente Única de Verdad:** Ninguna funcionalidad de frontend, backend o base de datos se implementará si no está descrita, aprobada y documentada formalmente en su correspondiente archivo `spec.md` dentro de la jerarquía `/specs/<modulo>/<feature-folder>/`.
2. **Ciclo Spec -> Plan -> Tasks:** Todo desarrollo debe seguir el flujo estricto de tres documentos por funcionalidad:
   - `spec.md`: Define el *qué* (requerimientos funcionales, reglas de negocio y modelos de datos).
   - `plan.md`: Define el *cómo* (arquitectura técnica, decisiones de diseño e integración).
   - `tasks.md`: Define las *acciones* (tareas atómicas y secuenciales ejecutable por agentes de IA).
3. **Cero Adivinación de Reglas de Negocio:** Si falta información sobre procesos escolares (escalas de notas por nivel, roles, asistencias, etc.), el agente debe detenerse y solicitar aclaración.

## II. Estándares de Arquitectura y Stack Tecnológico
1. **Frontend:** React + TypeScript + Vite.
   - Todo el código de interfaz debe utilizar TypeScript estricto (`strict: true`). Se prohíbe el uso de `any`.
   - Componentes funcionales, modulares y estilizados con Tailwind CSS.
2. **Backend & Persistencia:** 
   - Arquitectura orientada a servicios / API REST con Node.js (TypeScript) y PostgreSQL.
   - Las interfaces de TypeScript y contratos de API deben coincidir exactamente con lo especificado en la carpeta del módulo correspondiente.

## III. Gobernanza de Seguridad y Permisos
1. **Control de Acceso Basado en Roles (RBAC):** 
   - Gestión de 5 roles principales: `SuperAdmin`, `Director`, `Docente`, `Padre`, `Alumno`.
   - Validación obligatoria de rol e identidad en frontend y backend antes de exponer información sensible.
2. **Privacidad de Datos:** Manejo estricto de la privacidad de los datos personales y académicos de los estudiantes.

## IV. Calidad de Código y Entregables
1. **Verificabilidad:** Pruebas unitarias o de integración según corresponda a cada tarea finalizada.
2. **Documentación:** Código limpio con anotaciones TSDoc/JSDoc en funciones y componentes clave.