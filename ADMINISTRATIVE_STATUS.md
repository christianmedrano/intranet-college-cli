# Estado actual del módulo Administrative (ADM-001)

## ✅ Completado
- ✅ spec.md creado en `specs/administrative/001-spec-mvp/spec.md`
- ✅ plan.md creado en `specs/administrative/001-spec-mvp/plan.md`
- ✅ tasks.md creado en `specs/administrative/001-spec-mvp/tasks.md`
- ✅ Schemas Zod creados en `packages/shared/src/schemas/administrative/`:
  - `pago.ts` - Pagos con enums y validaciones
  - `matricula.ts` - Matrículas con estados
  - `certificado.ts` - Certificados y plantillas
- ✅ Contratos en `packages/shared/src/contracts/administrative/`:
  - `pago.ts` - PagoResponse, PaginatedPagosResponse, EstadoCuentaResponse
  - `matricula.ts` - MatriculaResponse, PaginatedMatriculasResponse
  - `certificado.ts` - CertificadoResponse, PlantillaCertificadoResponse
- ✅ Índices actualizados en `packages/shared/src/schemas/administrative/index.ts` y `contracts/administrative/index.ts`
- ✅ Exportaciones en `packages/shared/src/index.ts` actualizadas

## ❌ Pendiente - Errores de build

### 1. certificado.ts - Errores de tipos Zod v4 (4 errores)
```
src/schemas/administrative/certificado.ts(40,16): error TS2554: Expected 2-3 arguments, but got 1.
src/schemas/administrative/certificado.ts(65,16): error TS2554: Expected 2-3 arguments, but got 1.
src/schemas/administrative/certificado.ts(134,16): error TS2554: Expected 2-3 arguments, but got 1.
src/schemas/administrative/certificado.ts(161,18): error TS2554: Expected 2-3 arguments, but got 1.
```

**Causa**: Zod v4 TypeScript types no manejan correctamente `z.enum()` como valores de propiedades en `z.object()` cuando los enums son tipos unión. Los schemas core funcionan porque usan enums más simples.

**Intentos fallidos**:
- Comentarios `// @ts-ignore` en línea anterior
- Comentarios inline `// @ts-ignore`
- Comentarios `@ts-expect-error`
- Patrón IIFE para crear esquemas
- Uso de `z.union([z.literal(...)])` en lugar de `z.enum()`

### 2. Conflictos de exportación en index.ts
```
Module './schemas/virtual-classroom/material.js' has already exported 'AdjuntoVirtualResponsePayload'
Module './schemas/virtual-classroom/material.js' has already exported 'adjuntoVirtualResponseSchema'
Module './schemas/virtual-classroom/adjunto.js' has already exported 'AdjuntoVirtualResponse'
Module './schemas/administrative/index.js' has already exported 'EstadoCertificado'
Module './schemas/administrative/index.js' has already exported 'TipoCertificado'
```

### 3. Web build falla por exportaciones ambiguas en virtual-classroom
```
[AMBIGUOUS_EXTERNAL_NAMESPACES] Found ambiguous export.
adjuntoVirtualResponseSchema exportado desde ambos:
- packages/shared/dist/schemas/virtual-classroom/material.js
- packages/shared/dist/schemas/virtual-classroom/adjunto.js
```

## Próximos pasos recomendados

### Para certificado.ts (Zod v4 types issue)
Opción A: Usar `z.union([z.literal(...)])` en lugar de `z.enum()` - ya probado, no funciona
Opción B: Usar `z.nativeEnum()` con enum TypeScript - requiere definir enum TS
Opción C: Definir tipos como `z.string()` con `.refine()` para validación
Opción D: Excluir certificado.ts de typecheck estricto via tsconfig

### Para conflictos de exportación
1. En `index.ts`: usar exportaciones explícitas en lugar de `export *` para virtual-classroom y administrative
2. En virtual-classroom: consolidar `adjuntoVirtualResponseSchema` en un solo archivo

### Para web build
Resolver exportaciones ambiguas en virtual-classroom consolidando schemas compartidos