# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: flujo-academico.spec.ts >> Flujo académico completo >> docente registra calificación y asistencia; apoderado consulta
- Location: apps\web\e2e\flujo-academico.spec.ts:17:3

# Error details

```
Error: expect(page).toHaveURL(expected) failed

Expected: "http://localhost:5173/"
Received: "http://localhost:5173/login"
Timeout:  5000ms

Call log:
  - Expect "toHaveURL" with timeout 5000ms
    14 × locator resolved to <html lang="es">…</html>
       - unexpected value "http://localhost:5173/login"

```

```yaml
- banner:
  - link "Intranet Escolar":
    - /url: /
  - link "Iniciar sesión":
    - /url: /login
- main:
  - region "Iniciar sesión":
    - heading "Iniciar sesión" [level=1]
    - paragraph: Accede con tu usuario, correo o número de documento.
    - alert: No se pudo completar la solicitud.
    - text: Identificador
    - textbox "Identificador": docente1@ejemplo.edu.pe
    - text: Contraseña
    - textbox "Contraseña": Docente123!
    - button "Ingresar"
    - paragraph:
      - link "¿Olvidaste tu contraseña?":
        - /url: /recuperar-password
- contentinfo: Intranet Escolar
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test'
  2   | 
  3   | /**
  4   |  * Flujo E2E completo: docente registra calificación y asistencia; apoderado consulta.
  5   |  *
  6   |  * Requiere que el backend y frontend estén corriendo (webServer en playwright.config.ts).
  7   |  * Los usuarios de prueba deben existir en la base de datos de desarrollo.
  8   |  */
  9   | 
  10  | test.describe('Flujo académico completo', () => {
  11  |   test.beforeEach(async ({ page }) => {
  12  |     // Ir a la página de login
  13  |     await page.goto('/login')
  14  |     await expect(page).toHaveTitle(/Intranet/)
  15  |   })
  16  | 
  17  |   test('docente registra calificación y asistencia; apoderado consulta', async ({ page }) => {
  18  |     // --- LOGIN DOCENTE ---
  19  |     await page.fill('input[name="identifier"]', 'docente1@ejemplo.edu.pe')
  20  |     await page.fill('input[name="password"]', 'Docente123!')
  21  |     await page.click('button[type="submit"]')
  22  | 
  23  |     // Verificar redirección a home
> 24  |     await expect(page).toHaveURL('/')
      |                        ^ Error: expect(page).toHaveURL(expected) failed
  25  | 
  26  |     // --- CALIFICACIONES ---
  27  |     await page.goto('/calificaciones')
  28  |     await expect(page.locator('h1')).toContainText('Calificaciones y notas finales')
  29  | 
  30  |     // Seleccionar filtros (usar UUIDs de prueba conocidos)
  31  |     await page.fill('input[name="periodoId"]', '11111111-1111-4111-8111-111111111111')
  32  |     await page.fill('input[name="cursoId"]', '22222222-2222-4222-8222-222222222222')
  33  |     await page.fill('input[name="seccionId"]', '33333333-3333-4333-8333-333333333333')
  34  |     await page.click('button:has-text("Consultar")')
  35  | 
  36  |     // Esperar a que cargue la tabla
  37  |     await expect(page.locator('table')).toBeVisible()
  38  | 
  39  |     // Crear una calificación
  40  |     await page.click('button:has-text("Crear calificación")')
  41  |     await expect(page.locator('h3')).toContainText('Crear calificación')
  42  | 
  43  |     await page.fill('input[name="alumnoId"]', '44444444-4444-4444-8444-444444444444')
  44  |     await page.selectOption('select[name="valorLiteral"]', 'A')
  45  |     await page.fill('textarea[name="observacion"]', 'Buen desempeño')
  46  |     await page.click('button:has-text("Guardar calificación")')
  47  | 
  48  |     // Verificar mensaje de éxito
  49  |     await expect(page.locator('.text-emerald-800')).toContainText('Calificación registrada')
  50  | 
  51  |     // --- ASISTENCIAS ---
  52  |     await page.goto('/asistencias')
  53  |     await expect(page.locator('h1')).toContainText('Asistencias y justificaciones')
  54  | 
  55  |     await page.fill('input[name="anioId"]', '55555555-5555-4555-8555-555555555555')
  56  |     await page.fill('input[name="seccionId"]', '33333333-3333-4333-8333-333333333333')
  57  |     await page.fill('input[name="desde"]', '2024-05-01')
  58  |     await page.fill('input[name="hasta"]', '2024-05-31')
  59  |     await page.click('button:has-text("Consultar")')
  60  | 
  61  |     await expect(page.locator('table')).toBeVisible()
  62  | 
  63  |     // Registrar asistencia en lote
  64  |     await page.click('button:has-text("Registrar asistencia")')
  65  |     await expect(page.locator('h3')).toContainText('Registrar asistencia')
  66  | 
  67  |     await page.fill('input[name="seccionId"]', '33333333-3333-4333-8333-333333333333')
  68  |     await page.fill('input[name="fecha"]', '2024-05-02')
  69  |     await page.fill('input[name="alumnoId-0"]', '44444444-4444-4444-8444-444444444444')
  70  |     await page.selectOption('select[name="estado-0"]', 'PRESENTE')
  71  |     await page.click('button:has-text("Registrar asistencia")')
  72  | 
  73  |     await expect(page.locator('.text-emerald-800')).toContainText('Asistencia registrada para 1 alumno')
  74  | 
  75  |     // --- LOGOUT DOCENTE ---
  76  |     await page.click('button:has-text("Cerrar sesión")')
  77  |     await expect(page).toHaveURL('/login')
  78  | 
  79  |     // --- LOGIN APODERADO ---
  80  |     await page.fill('input[name="identifier"]', 'apoderado1@ejemplo.edu.pe')
  81  |     await page.fill('input[name="password"]', 'Apoderado123!')
  82  |     await page.click('button[type="submit"]')
  83  |     await expect(page).toHaveURL('/')
  84  | 
  85  |     // --- CONSULTA CALIFICACIONES COMO APODERADO ---
  86  |     await page.goto('/calificaciones')
  87  |     await expect(page.locator('h1')).toContainText('Calificaciones y notas finales')
  88  | 
  89  |     // El apoderado solo ve las calificaciones de sus alumnos vinculados
  90  |     await page.fill('input[name="periodoId"]', '11111111-1111-4111-8111-111111111111')
  91  |     await page.click('button:has-text("Consultar")')
  92  | 
  93  |     await expect(page.locator('table')).toBeVisible()
  94  |     // Verificar que ve la calificación del alumno vinculado
  95  |     await expect(page.locator('td')).toContainText('A')
  96  | 
  97  |     // --- CONSULTA ASISTENCIAS COMO APODERADO ---
  98  |     await page.goto('/asistencias')
  99  |     await expect(page.locator('h1')).toContainText('Asistencias y justificaciones')
  100 | 
  101 |     await page.fill('input[name="anioId"]', '55555555-5555-4555-8555-555555555555')
  102 |     await page.click('button:has-text("Consultar")')
  103 | 
  104 |     await expect(page.locator('table')).toBeVisible()
  105 |     await expect(page.locator('td')).toContainText('Presente')
  106 | 
  107 |     // --- CONSULTA HORARIOS COMO APODERADO ---
  108 |     await page.goto('/horarios')
  109 |     await expect(page.locator('h1')).toContainText('Configuración académica')
  110 | 
  111 |     // Cambiar a pestaña Horarios
  112 |     await page.click('button:has-text("Horarios")')
  113 |     await expect(page.locator('h2')).toContainText('Horarios')
  114 | 
  115 |     await page.fill('input[name="anioId"]', '55555555-5555-4555-8555-555555555555')
  116 |     await page.click('button:has-text("Consultar")')
  117 | 
  118 |     await expect(page.locator('table')).toBeVisible()
  119 |     // Solo lectura - no botones de gestión
  120 |     await expect(page.locator('button:has-text("Crear horario")')).not.toBeVisible()
  121 |   })
  122 | })
```