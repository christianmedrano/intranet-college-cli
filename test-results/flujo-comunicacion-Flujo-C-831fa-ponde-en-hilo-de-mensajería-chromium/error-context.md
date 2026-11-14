# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: flujo-comunicacion.spec.ts >> Flujo Communication E2E: Anuncio + Mensajería >> Director crea anuncio institucional → Apoderado lo ve → Tutor responde en hilo de mensajería
- Location: apps\web\e2e\flujo-comunicacion.spec.ts:32:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.waitForFunction: Test timeout of 30000ms exceeded.
```

# Page snapshot

```yaml
- generic [ref=f2e3]:
  - banner [ref=f2e4]:
    - generic [ref=f2e5]:
      - link "Intranet Escolar" [ref=f2e6] [cursor=pointer]:
        - /url: /
      - link "Iniciar sesión" [ref=f2e7] [cursor=pointer]:
        - /url: /login
  - main [ref=f2e8]:
    - generic [ref=f2e9]:
      - generic [ref=f2e10]:
        - heading "Anuncios y Comunicados" [level=1] [ref=f2e11]
        - button "Crear anuncio" [active] [ref=f2e12]
      - generic [ref=f2e13]:
        - heading "Filtros" [level=2] [ref=f2e14]
        - generic [ref=f2e15]:
          - generic [ref=f2e16]:
            - generic [ref=f2e17]: Tipo
            - combobox "Tipo" [ref=f2e18]:
              - option "Todos" [selected]
              - option "Institucional"
              - option "Sección"
          - generic [ref=f2e19]:
            - generic [ref=f2e20]: Estado
            - combobox "Estado" [ref=f2e21]:
              - option "Todos" [selected]
              - option "Borrador"
              - option "Publicado"
              - option "Expirado"
              - option "Archivado"
          - generic [ref=f2e22]:
            - generic [ref=f2e23]: Nivel
            - combobox "Nivel" [ref=f2e24]:
              - option "Todos" [selected]
          - generic [ref=f2e25]:
            - generic [ref=f2e26]: Grado
            - combobox "Grado" [disabled] [ref=f2e27]:
              - option "Todos" [selected]
          - generic [ref=f2e28]:
            - generic [ref=f2e29]: Sección
            - combobox "Sección" [disabled] [ref=f2e30]:
              - option "Todos" [selected]
          - generic [ref=f2e31]:
            - generic [ref=f2e32]: Rol
            - combobox "Rol" [ref=f2e33]:
              - option "Todos" [selected]
              - option "SuperAdmin"
              - option "Director"
              - option "Docente"
              - option "Apoderado"
              - option "Alumno"
          - button "Limpiar" [ref=f2e35]
      - generic [ref=f2e36]:
        - generic [ref=f2e37]: No se encontraron anuncios.
        - generic [ref=f2e39]:
          - generic [ref=f2e40]:
            - heading "Crear anuncio" [level=2] [ref=f2e41]
            - button "Cerrar" [ref=f2e42]: ×
          - generic [ref=f2e44]:
            - generic [ref=f2e45]:
              - generic [ref=f2e46]: Título *
              - textbox "Título" [ref=f2e47]:
                - /placeholder: Título del anuncio
            - generic [ref=f2e48]:
              - generic [ref=f2e49]: Cuerpo *
              - textbox "Cuerpo" [ref=f2e50]:
                - /placeholder: Contenido del anuncio (soporta texto plano)...
              - paragraph [ref=f2e51]: Máx. 10,000 caracteres. Se renderiza como texto plano.
            - generic [ref=f2e52]:
              - generic [ref=f2e53]: Tipo *
              - combobox "Tipo" [ref=f2e54]:
                - option "Seleccionar tipo..." [selected]
                - option "Institucional (con segmentación)"
                - option "De sección (solo para tutores)"
            - generic [ref=f2e55]:
              - button [ref=f2e56]:
                - generic [ref=f2e58] [cursor=pointer]:
                  - paragraph [ref=f2e63]: Arrastra archivos aquí o haz clic para seleccionar
                  - paragraph [ref=f2e64]: "Tipos permitidos: PDF, MSWORD, VND.OPENXMLFORMATS-OFFICEDOCUMENT.WORDPROCESSINGML.DOCUMENT, VND.MS-EXCEL, VND.OPENXMLFORMATS-OFFICEDOCUMENT.SPREADSHEETML.SHEET, VND.MS-POWERPOINT, VND.OPENXMLFORMATS-OFFICEDOCUMENT.PRESENTATIONML.PRESENTATION, JPEG, PNG, WEBP • Máx. 10 MB"
              - paragraph [ref=f2e65]: 0 / 5 archivo(s)
            - generic [ref=f2e66]:
              - button "Cancelar" [ref=f2e67]
              - button "Crear anuncio" [ref=f2e68]
  - contentinfo [ref=f2e69]: Intranet Escolar
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test'
  2   | 
  3   | /**
  4   |  * Flujo E2E Communication: Director crea anuncio → Apoderado lo ve → Tutor responde en hilo.
  5   |  *
  6   |  * Requiere que el backend (puerto 3000) y frontend (puerto 5173) estén corriendo.
  7   |  * Los usuarios de prueba deben existir en la base de datos de desarrollo.
  8   |  * Ejecuta `npm run seed:e2e` antes para crear los datos.
  9   |  *
  10  |  * Usuarios semilla (creados por `npm run seed:e2e`):
  11  |  * - director1@ejemplo.edu.pe / Director123! (DIRECTOR)
  12  |  * - docente1@ejemplo.edu.pe / Docente123! (DOCENTE, tutor de Sección A)
  13  |  * - alumno1@ejemplo.edu.pe / Alumno123! (ALUMNO, matriculado en Sección A)
  14  |  * - apoderado1@ejemplo.edu.pe / Apoderado123! (APODERADO, vinculado a alumno1)
  15  |  *
  16  |  * IDs fijos del seed-e2e:
  17  |  * - ANIO_ID_E2E: 66666666-6666-4666-8666-666666666666
  18  |  * - SECCION_A: cccccccc-cccc-4ccc-8ccc-cccccccccccc (tutor docente1)
  19  |  * - ALUMNO_CODIGO: AL-001
  20  |  */
  21  | 
  22  | const ANIO_ID_E2E = '66666666-6666-4666-8666-666666666666'
  23  | const SECCION_A = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
  24  | 
  25  | test.describe('Flujo Communication E2E: Anuncio + Mensajería', () => {
  26  |   test.beforeEach(async ({ page }) => {
  27  |     // Ir a la página de login
  28  |     await page.goto('/login')
  29  |     await expect(page).toHaveTitle(/Intranet/)
  30  |   })
  31  | 
  32  |   test('Director crea anuncio institucional → Apoderado lo ve → Tutor responde en hilo de mensajería', async ({ page }) => {
  33  |     // ==========================================
  34  |     // 1. DIRECTOR: CREAR ANUNCIO INSTITUCIONAL
  35  |     // ==========================================
  36  |     await page.goto('/login')
  37  |     await page.waitForLoadState('networkidle')
  38  |     // Wait for React app to mount
  39  |     await page.waitForFunction(() => document.getElementById('root')?.children.length > 0, { timeout: 30000 })
  40  |     const bodyText = await page.locator('body').textContent()
  41  |     console.log('Login page body:', bodyText?.substring(0, 500))
  42  |     await expect(page.locator('h1:has-text("Iniciar sesión")')).toBeVisible({ timeout: 30000 })
  43  |     await page.waitForSelector('input[name="identifier"]', { state: 'visible', timeout: 15000 })
  44  |     await page.fill('input[name="identifier"]', 'director1@ejemplo.edu.pe')
  45  |     await page.fill('input[name="password"]', 'Director123!')
  46  |     await page.click('button[type="submit"]')
  47  |     await expect(page).toHaveURL('/')
  48  |     console.log('After login URL:', page.url())
  49  | 
  50  |     // Ir a página de anuncios
  51  |     await page.goto('/anuncios')
  52  |     await page.waitForLoadState('networkidle')
  53  |     console.log('Current URL:', page.url())
  54  |     await expect(page).toHaveURL(/\/anuncios/)
  55  |     await expect(page.locator('h1')).toContainText('Anuncios y Comunicados')
  56  | 
  57  |     // Abrir modal "Crear anuncio"
  58  |     await page.click('button:has-text("Crear anuncio")')
  59  |     await expect(page.locator('h2:has-text("Crear anuncio")')).toBeVisible()
  60  | 
  61  |     // Esperar a que los catálogos se carguen
> 62  |     await page.waitForFunction(() => {
      |                ^ Error: page.waitForFunction: Test timeout of 30000ms exceeded.
  63  |       const select = document.querySelector('select[name="anioId"]')
  64  |       return select && select.options.length > 1
  65  |     }, { timeout: 15000 })
  66  | 
  67  |     // Llenar formulario: tipo INSTITUCIONAL, audiencia general
  68  |     await page.selectOption('select[name="tipo"]', 'INSTITUCIONAL')
  69  |     await page.fill('input[name="titulo"]', 'Anuncio E2E: Reunión de Padres')
  70  |     await page.fill('textarea[name="cuerpo"]', 'Se convoca a reunión de padres el próximo viernes a las 10:00 AM.')
  71  | 
  72  |     // Seleccionar audiencia: todos los roles
  73  |     await page.selectOption('select[name="audienciaRoles"]', ['SUPER_ADMIN', 'DIRECTOR', 'DOCENTE', 'APODERADO', 'ALUMNO'])
  74  | 
  75  |     // Año académico
  76  |     await page.selectOption('select[name="anioId"]', '66666666-6666-4666-8666-666666666666')
  77  | 
  78  |     await page.click('button:has-text("Crear anuncio")')
  79  |     await expect(page.locator('.text-emerald-800')).toContainText('Anuncio creado')
  80  | 
  81  |     // Verificar que aparece en la lista con estado PUBLICADO (al crearlo como Director se publica directo)
  82  |     await expect(page.locator('table')).toBeVisible()
  83  |     await expect(page.locator('td')).toContainText('Reunión de Padres')
  84  | 
  85  |     // ==========================================
  86  |     // 2. APODERADO: VER ANUNCIO
  87  |     // ==========================================
  88  |     await page.click('button:has-text("Cerrar sesión")')
  89  |     await expect(page).toHaveURL('/login')
  90  | 
  91  |     await page.fill('input[name="identifier"]', 'apoderado1@ejemplo.edu.pe')
  92  |     await page.fill('input[name="password"]', 'Apoderado123!')
  93  |     await page.click('button[type="submit"]')
  94  |     await expect(page).toHaveURL('/')
  95  | 
  96  |     // Ir a anuncios
  97  |     await page.goto('/anuncios')
  98  |     await expect(page.locator('table')).toBeVisible()
  99  | 
  100 |     // El apoderado ve el anuncio (filtrado por su rol APODERADO)
  101 |     await expect(page.locator('td')).toContainText('Reunión de Padres')
  102 | 
  103 |     // Ver detalle del anuncio
  104 |     await page.locator('tbody tr').first().locator('button:has-text("Editar")').click()
  105 |     // Como apoderado no tiene permiso de gestión, no debería ver botón editar
  106 |     // En su lugar, verificar que ve el título en la tabla
  107 |     await expect(page.locator('td')).toContainText('Reunión de Padres')
  108 | 
  109 |     // ==========================================
  110 |     // 3. DOCENTE (TUTOR): RESPONDER EN HILLO DE MENSAJERÍA
  111 |     // ==========================================
  112 |     await page.click('button:has-text("Cerrar sesión")')
  113 |     await expect(page).toHaveURL('/login')
  114 | 
  115 |     await page.fill('input[name="identifier"]', 'docente1@ejemplo.edu.pe')
  116 |     await page.fill('input[name="password"]', 'Docente123!')
  117 |     await page.click('button[type="submit"]')
  118 |     await expect(page).toHaveURL('/')
  119 | 
  120 |     // Ir a mensajería de la Sección A
  121 |     await page.goto('/mensajeria/cccccccc-cccc-4ccc-8ccc-cccccccccccc')
  122 |     await expect(page.locator('h1')).toContainText('Mensajería de Sección')
  123 | 
  124 |     // El docente (tutor) ve el formulario para nuevo mensaje
  125 |     await expect(page.locator('button:has-text("Nuevo mensaje")')).toBeVisible()
  126 | 
  127 |     // Enviar mensaje en el hilo
  128 |     await page.click('button:has-text("Nuevo mensaje")')
  129 |     await expect(page.locator('h2:has-text("Nuevo mensaje")')).toBeVisible()
  130 | 
  131 |     await page.fill('textarea[name="cuerpo"]', 'Estimados padres, confirmo la reunión para el viernes. Les esperamos.')
  132 |     
  133 |     await page.click('button:has-text("Enviar mensaje")')
  134 |     await expect(page.locator('.text-emerald-800')).toContainText('Mensaje enviado')
  135 | 
  136 |     // Verificar que el mensaje aparece en el hilo
  137 |     await expect(page.locator('text=Estimados padres')).toBeVisible()
  138 |     await expect(page.locator('text=confirmo la reunión')).toBeVisible()
  139 | 
  140 |     // Verificar que aparece el autor y su rol
  141 |     await expect(page.locator('text=Carlos Pérez García')).toBeVisible()
  142 |     await expect(page.locator('text=Docente')).toBeVisible()
  143 |     await expect(page.locator('text=Tuyo')).toBeVisible() // Marcado como propio
  144 | 
  145 |     // ==========================================
  146 |     // 4. APODERADO: VER RESPUESTA DEL TUTOR EN HILLO
  147 |     // ==========================================
  148 |     await page.click('button:has-text("Cerrar sesión")')
  149 |     await expect(page).toHaveURL('/login')
  150 | 
  151 |     await page.fill('input[name="identifier"]', 'apoderado1@ejemplo.edu.pe')
  152 |     await page.fill('input[name="password"]', 'Apoderado123!')
  153 |     await page.click('button[type="submit"]')
  154 |     await expect(page).toHaveURL('/')
  155 | 
  156 |     // Ir a mensajería de la Sección A
  157 |     await page.goto('/mensajeria/cccccccc-cccc-4ccc-8ccc-cccccccccccc')
  158 |     await expect(page.locator('table')).toBeVisible()
  159 | 
  160 |     // El apoderado ve el mensaje del tutor
  161 |     await expect(page.locator('text=Estimados padres')).toBeVisible()
  162 |     await expect(page.locator('text=confirmo la reunión')).toBeVisible()
```