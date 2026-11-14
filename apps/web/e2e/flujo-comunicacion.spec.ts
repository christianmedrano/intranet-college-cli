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
    await expect(page.locator('h1:has-text("Iniciar sesión")')).toBeVisible({ timeout: 30000 })
    await page.fill('input[name="identifier"]', 'director1@ejemplo.edu.pe')
    await page.fill('input[name="password"]', 'Director123!')
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL('/')

    // Ir a página de anuncios
    await page.goto('/anuncios')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/\/anuncios/)
    await expect(page.locator('h1')).toContainText('Anuncios y Comunicados')

    // Abrir modal "Crear anuncio"
    await page.click('button:has-text("Crear anuncio")')
    await expect(page.locator('h2:has-text("Crear anuncio")')).toBeVisible()

    // Seleccionar tipo INSTITUCIONAL (revela el selector de año académico)
    await page.selectOption('select[name="tipo"]', 'INSTITUCIONAL')

    // Esperar a que el catálogo de años académicos se cargue
    await page.waitForFunction(() => {
      const select = document.querySelector('select[name="anioId"]')
      return select !== null && select.options.length > 1
    }, { timeout: 20000 })
    await page.fill('input[name="titulo"]', 'Anuncio E2E: Reunión de Padres')
    await page.fill('textarea[name="cuerpo"]', 'Se convoca a reunión de padres el próximo viernes a las 10:00 AM.')

    // Seleccionar audiencia: todos los roles
    await page.selectOption('select[name="audienciaRoles"]', ['SUPER_ADMIN', 'DIRECTOR', 'DOCENTE', 'APODERADO', 'ALUMNO'])

    // Año académico
    await page.selectOption('select[name="anioId"]', _ANIO_ID_E2E)

    // Publicar directamente (RF-COM-001: el Director publica el anuncio)
    await page.selectOption('select[name="estado"]', 'PUBLICADO')

    await page.locator('form button[type="submit"]').click()

    // El anuncio aparece en la lista con estado PUBLICADO
    const filaAnuncio = page.locator('tbody tr', { hasText: 'Reunión de Padres' }).first()
    await expect(filaAnuncio).toBeVisible()
    await expect(filaAnuncio).toContainText('PUBLICADO')

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
    await expect(page.locator('tbody tr', { hasText: 'Reunión de Padres' }).first()).toBeVisible()

    // El apoderado no tiene permiso de gestión: no ve acciones de edición
    await expect(page.locator('button:has-text("Editar")')).toHaveCount(0)

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

    // El mensaje aparece en el hilo con su autor
    const hilo = page.locator('main')
    await expect(hilo).toContainText('Estimados padres, confirmo la reunión para el viernes.')
    await expect(hilo).toContainText('Carlos Pérez García')
    await expect(hilo).toContainText('Docente')
    await expect(hilo).toContainText('Tuyo') // Marcado como propio

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
    await expect(page.locator('h1')).toContainText('Mensajería de Sección')

    // El apoderado ve el mensaje del tutor
    const hiloApoderado = page.locator('main')
    await expect(hiloApoderado).toContainText('Estimados padres, confirmo la reunión')
    await expect(hiloApoderado).toContainText('Carlos Pérez García')
    await expect(hiloApoderado).toContainText('Docente')

    // El apoderado NO ve botón "Nuevo mensaje" (solo lectura para apoderados en mensajería)
    // Según especificación, solo tutor y apoderados con vínculo pueden enviar
    // En este caso, el apoderado SÍ puede enviar (tiene vínculo), pero verificamos que ve el mensaje
    await expect(page.locator('button:has-text("Nuevo mensaje")')).toBeVisible()
  })
})