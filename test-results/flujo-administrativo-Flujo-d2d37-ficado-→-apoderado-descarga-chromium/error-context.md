# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: flujo-administrativo.spec.ts >> Flujo administrativo E2E: certificado >> director emite certificado → apoderado descarga
- Location: apps\web\e2e\flujo-administrativo.spec.ts:29:3

# Error details

```
Test timeout of 30000ms exceeded.
```

# Page snapshot

```yaml
- generic [ref=f1e3]:
  - banner [ref=f1e4]:
    - generic [ref=f1e5]:
      - link "Intranet Escolar" [ref=f1e6] [cursor=pointer]:
        - /url: /
      - link "Iniciar sesión" [ref=f1e7] [cursor=pointer]:
        - /url: /login
  - main [ref=f1e8]:
    - generic [ref=f1e9]:
      - generic [ref=f1e10]:
        - heading "Certificados y Constancias" [level=1] [ref=f1e11]
        - button "Emitir certificado" [active] [ref=f1e13]
      - generic [ref=f1e14]:
        - heading "Filtros" [level=2] [ref=f1e15]
        - generic [ref=f1e16]:
          - generic [ref=f1e17]:
            - generic [ref=f1e18]: Tipo
            - combobox "Tipo" [ref=f1e19]:
              - option "Todos" [selected]
              - option "Certificado de Estudios"
              - option "Certificado de Matrícula"
              - option "Certificado de No Adeudo"
              - option "Certificado de Conducta"
              - option "Otro Certificado"
          - generic [ref=f1e20]:
            - generic [ref=f1e21]: Alumno
            - combobox "Alumno" [ref=f1e22]:
              - option "Todos" [selected]
              - option "AL-001 - María López Torres"
          - generic [ref=f1e23]:
            - generic [ref=f1e24]: Año académico
            - combobox "Año académico" [ref=f1e25]:
              - option "Todos" [selected]
              - option "2026"
          - generic [ref=f1e26]:
            - generic [ref=f1e27]: Estado
            - combobox "Estado" [ref=f1e28]:
              - option "Todos" [selected]
              - option "Borrador"
              - option "Solicitado"
              - option "Aprobado"
              - option "Rechazado"
              - option "Emitido"
              - option "Anulado"
          - generic [ref=f1e29]:
            - button "Limpiar filtros" [ref=f1e30]
            - generic [ref=f1e31]: 0 resultado(s)
      - generic [ref=f1e32]: No se encontraron certificados
      - generic [ref=f1e35]:
        - generic [ref=f1e36]:
          - heading "Emitir certificado" [level=2] [ref=f1e37]
          - button "Cerrar" [ref=f1e38]: ×
        - generic [ref=f1e40]:
          - generic [ref=f1e41]:
            - generic [ref=f1e42]: Tipo de certificado *
            - combobox "Tipo de certificado" [ref=f1e43]:
              - option "Certificado de Estudios" [selected]
              - option "Certificado de Matrícula"
              - option "Certificado de No Adeudo"
              - option "Certificado de Conducta"
              - option "Otro Certificado"
          - generic [ref=f1e44]:
            - generic [ref=f1e45]: Alumno *
            - combobox "Alumno" [ref=f1e46]:
              - option "Seleccionar alumno..." [selected]
              - option "AL-001 - María López Torres"
          - generic [ref=f1e47]:
            - generic [ref=f1e48]: Año académico *
            - combobox "Año académico" [ref=f1e49]:
              - option "Seleccionar año..." [selected]
              - option "2026"
          - generic [ref=f1e50]:
            - generic [ref=f1e51]: Plantilla (opcional)
            - combobox "Plantilla (opcional)" [ref=f1e52]:
              - option "Plantilla base del tipo" [selected]
          - generic [ref=f1e53]:
            - button "Cancelar" [ref=f1e54]
            - button "Emitir certificado" [ref=f1e55]
  - contentinfo [ref=f1e56]: Intranet Escolar
```