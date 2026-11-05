# Stack Tecnológico Aprobado

> Referenciado por `docs/constitution.md` §III.4.
> Lo listado aquí se puede instalar sin consultar. Cualquier otra dependencia requiere aprobación.

## Runtime

| Herramienta | Versión | Nota |
|---|---|---|
| Node.js | LTS 20+ | Runtime de frontend y backend |
| npm | 10+ | Workspaces del monorepo |
| MySQL | 8.0.16+ | InnoDB, `utf8mb4`, `CHECK` aplicado |
| TypeScript | 7.x | Modo estricto |

## Frontend (`apps/web`)

| Paquete | Uso |
|---|---|
| `react`, `react-dom` | UI |
| `vite`, `@vitejs/plugin-react` | Build y desarrollo |
| `tailwindcss` | Estilos |
| `react-router` | Ruteo |
| `@tanstack/react-query` | Estado del servidor y caché |
| `react-hook-form` | Formularios |
| `zod` | Validación y schemas |
| `date-fns` | Fechas |

## Backend (`apps/api`)

| Paquete | Uso |
|---|---|
| `fastify` | Servidor HTTP |
| `@fastify/cors` | CORS |
| `@fastify/rate-limit` | Rate limiting |
| `@fastify/cookie` | Cookies de refresh |
| `@fastify/multipart` | Subida de archivos |
| `prisma`, `@prisma/client` | ORM y migraciones |
| `zod` | Validación de entrada y entorno |
| `argon2` | Hash de contraseñas |
| `jose` o `jsonwebtoken` | Tokens de acceso |
| `pino` | Logs estructurados |

## Compartido (`packages/shared`)

| Paquete | Uso |
|---|---|
| `zod` | Schemas de dominio y contratos |

## Pruebas y calidad

| Paquete | Uso |
|---|---|
| `vitest` | Pruebas unitarias e integración |
| `@testing-library/react` | Pruebas de UI |
| `@testing-library/jest-dom` | Matchers de DOM |
| `supertest` | Pruebas de API |
| `@playwright/test` | E2E |
| `eslint`, `typescript-eslint` | Lint |
| `prettier` | Formato |

## Requieren aprobación

- Generación de PDF: `pdfkit`, `@react-pdf/renderer` u otro.
- Componentes de UI: `shadcn/ui`, `radix-ui`, `headlessui`.
- Fechas y zonas horarias: `luxon`, `dayjs` (si `date-fns` no alcanza).
- Almacenamiento de archivos en la nube: `@aws-sdk/client-s3`, `cloudinary`.
- Correo: `nodemailer`, `resend`.
- Cualquier ORM, framework o librería de estado distinta a las listadas.

## Reglas

1. Una sola librería por función.
2. Sin dependencias abandonadas o sin mantenimiento.
3. Toda dependencia nueva se registra en el `plan.md` con su justificación.
4. Las versiones exactas se fijan en `package.json` al instalar.
