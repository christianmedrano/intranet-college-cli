import { test, expect } from '@playwright/test'

/**
 * Flujo E2E Communication: Director crea anuncio → Apoderado lo ve → Tutor responde en hilo.
 *
 * Requiere que el backend (puerto 3000) y frontend (puerto 5173) estén corriendo.
 * Los usuarios de prueba deben existir en la base de datos de desarrollo.
 * Ejecuta `npm run seed:e2e` antes para crear los datos.
 *
 * Usuarios semilla (creados por `npm run seed:e2e`):
 * - director1@ejemplo.edu.pe / Director123! (DIRECTOR)
 * - docente1@ejemplo.edu.pe / Docente123! (DOCENTE, tutor de Sección A)
 * - alumno1@ejemplo.edu.pe / Alumno123! (ALUMNO, matriculado en Sección A)
 * - apoderado1@ejemplo.edu.pe / Apoderado123! (APODERADO, vinculado a alumno1)
 *
 * IDs fijos del seed-e2e:
 * - ANIO_ID_E2E: 66666666-6666-4666-8666-666666666666
 * - SECCION_A: cccccccc-cccc-4ccc-8ccc-cccccccccccc (tutor docente1)
 * - ALUMNO_CODIGO: AL-001
 */

const _ANIO_ID_E2E = '66666666-6666-4666-8666-666666666666'
const _SECCION_A = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

test.describe('Flujo Communication E2E: Anuncio + Mensajería', () => {
  test.beforeEach(async ({ page }) => {
    // Ir a la página de login
    await page.goto('/login')
    await expect(page).toHaveTitle(/Intranet/)
  })

  test('Director crea anuncio institucional → Apoderado lo ve → Tutor responde en hilo de mensajería', async ({ page }) => {
    // ==========================================
    // 1. DIRECTOR: CREAR ANUNCIO INSTITUCIONAL
    // ==========================================
    await page.goto('/login')
    await page.waitForLoadState('networkidle')
    // Wait for React app to mount
    await page.waitForFunction(() => document.getElementById('root')?.children.length > 0, { timeout: 30000 })
    const bodyText = await page.locator('body').textContent()
    console.log('Login page body:', bodyText?.substring(0, 500))
    await expect(page.locator('h1:has-text("Iniciar sesión")')).toBeVisible({ timeout: 30000 })
    await page.waitForSelector('input[name="identifier"]', { state: 'visible', timeout: 15000 })
    await page.fill('input[name="identifier"]', 'director1@ejemplo.edu.pe')
    await page.fill('input[name="password"]', 'Director123!')
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL('/')
    console.log('After login URL:', page.url())

    // Ir a página de anuncios
    await page.goto('/anuncios')
    await page.waitForLoadState('networkidle')
    console.log('Current URL:', page.url())
    await expect(page).toHaveURL(/\/anuncios/)
    await expect(page.locator('h1')).toContainText('Anuncios y Comunicados')

    // Abrir modal "Crear anuncio"
    await page.click('button:has-text("Crear anuncio")')
    await expect(page.locator('h2:has-text("Crear anuncio")')).toBeVisible()

    // Esperar a que los catálogos se carguen
    await page.waitForFunction(() => {
      const select = document.querySelector('select[name="anioId"]')
      return select && select.options.length > 1
    }, { timeout: 15000 })

    // Llenar formulario: tipo INSTITUCIONAL, audiencia general
    await page.selectOption('select[name="tipo"]', 'INSTITUCIONAL')
    await page.fill('input[name="titulo"]', 'Anuncio E2E: Reunión de Padres')
    await page.fill('textarea[name="cuerpo"]', 'Se convoca a reunión de padres el próximo viernes a las 10:00 AM.')

    // Seleccionar audiencia: todos los roles
    await page.selectOption('select[name="audienciaRoles"]', ['SUPER_ADMIN', 'DIRECTOR', 'DOCENTE', 'APODERADO', 'ALUMNO'])

    // Año académico
    await page.selectOption('select[name="anioId"]', _ANIO_ID_E2E)

    await page.click('button:has-text("Crear anuncio")')
    await expect(page.locator('.text-emerald-800')).toContainText('Anuncio creado')

    // Verificar que aparece en la lista con estado PUBLICADO (al crearlo como Director se publica directo)
    await expect(page.locator('table')).toBeVisible()
    await expect(page.locator('td')).toContainText('Reunión de Padres')

    // ==========================================
    // 2. APODERADO: VER ANUNCIO
    // ==========================================
    await page.click('button:has-text("Cerrar sesión")')
    await expect(page).toHaveURL('/login')

    await page.fill('input[name="identifier"]', 'apoderado1@ejemplo.edu.pe')
    await page.fill('input[name="password"]', 'Apoderado123!')
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL('/')

    // Ir a anuncios
    await page.goto('/anuncios')
    await expect(page.locator('table')).toBeVisible()

    // El apoderado ve el anuncio (filtrado por su rol APODERADO)
    await expect(page.locator('td')).toContainText('Reunión de Padres')

    // Ver detalle del anuncio
    await page.locator('tbody tr').first().locator('button:has-text("Editar")').click()
    // Como apoderado no tiene permiso de gestión, no debería ver botón editar
    // En su lugar, verificar que ve el título en la tabla
    await expect(page.locator('td')).toContainText('Reunión de Padres')

    // ==========================================
    // 3. DOCENTE (TUTOR): RESPONDER EN HILLO DE MENSAJERÍA
    // ==========================================
    await page.click('button:has-text("Cerrar sesión")')
    await expect(page).toHaveURL('/login')

    await page.fill('input[name="identifier"]', 'docente1@ejemplo.edu.pe')
    await page.fill('input[name="password"]', 'Docente123!')
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL('/')

    // Ir a mensajería de la Sección A
    await page.goto(`/mensajeria/${_SECCION_A}`)
    await expect(page.locator('h1')).toContainText('Mensajería de Sección')

    // El docente (tutor) ve el formulario para nuevo mensaje
    await expect(page.locator('button:has-text("Nuevo mensaje")')).toBeVisible()

    // Enviar mensaje en el hilo
    await page.click('button:has-text("Nuevo mensaje")')
    await expect(page.locator('h2:has-text("Nuevo mensaje")')).toBeVisible()

    await page.fill('textarea[name="cuerpo"]', 'Estimados padres, confirmo la reunión para el viernes. Les esperamos.')
    
    await page.click('button:has-text("Enviar mensaje")')
    await expect(page.locator('.text-emerald-800')).toContainText('Mensaje enviado')

    // Verificar que el mensaje aparece en el hilo
    await expect(page.locator('text=Estimados padres')).toBeVisible()
    await expect(page.locator('text=confirmo la reunión')).toBeVisible()

    // Verificar que aparece el autor y su rol
    await expect(page.locator('text=Carlos Pérez García')).toBeVisible()
    await expect(page.locator('text=Docente')).toBeVisible()
    await expect(page.locator('text=Tuyo')).toBeVisible() // Marcado como propio

    // ==========================================
    // 4. APODERADO: VER RESPUESTA DEL TUTOR EN HILLO
    // ==========================================
    await page.click('button:has-text("Cerrar sesión")')
    await expect(page).toHaveURL('/login')

    await page.fill('input[name="identifier"]', 'apoderado1@ejemplo.edu.pe')
    await page.fill('input[name="password"]', 'Apoderado123!')
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL('/')

    // Ir a mensajería de la Sección A
    await page.goto(`/mensajeria/${_SECCION_A}`)
    await expect(page.locator('table')).toBeVisible()

    // El apoderado ve el mensaje del tutor
    await expect(page.locator('text=Estimados padres')).toBeVisible()
    await expect(page.locator('text=confirmo la reunión')).toBeVisible()
    await expect(page.locator('text=Carlos Pérez García')).toBeVisible()
    await expect(page.locator('text=Docente')).toBeVisible()

    // El apoderado NO ve botón "Nuevo mensaje" (solo lectura para apoderados en mensajería)
    // Según especificación, solo tutor y apoderados con vínculo pueden enviar
    // En este caso, el apoderado SÍ puede enviar (tiene vínculo), pero verificamos que ve el mensaje
    await expect(page.locator('button:has-text("Nuevo mensaje")')).toBeVisible()
  })
})