import { test, expect } from '@playwright/test'

/**
 * Flujo E2E administrativo simplificado: director emite certificado → apoderado descarga.
 *
 * Requiere que el backend (puerto 3000) y frontend (puerto 5173) estén corriendo.
 * Los usuarios de prueba deben existir en la base de datos de desarrollo.
 * Ejecuta `npm run seed:e2e` antes para crear los datos.
 *
 * Usuarios semilla (creados por `npm run seed:e2e`):
 * - director1@ejemplo.edu.pe / Director123! (DIRECTOR)
 * - apoderado1@ejemplo.edu.pe / Apoderado123! (APODERADO, vinculado a alumno1)
 * - alumno1@ejemplo.edu.pe / Alumno123! (ALUMNO, matriculado en Sección A)
 *
 * IDs fijos del seed-e2e:
 * - ANIO_ID_E2E: 66666666-6666-4666-8666-666666666666
 * - ALUMNO_CODIGO: AL-001 (se usa como label en select)
 */

const ANIO_ID_E2E = '66666666-6666-4666-8666-666666666666'

test.describe('Flujo administrativo E2E: certificado', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await expect(page).toHaveTitle(/Intranet/)
  })

  test('director emite certificado → apoderado descarga', async ({ page }) => {
    // ==========================================
    // 1. DIRECTOR: EMITIR CERTIFICADO
    // ==========================================
    await page.fill('input[name="identifier"]', 'director1@ejemplo.edu.pe')
    await page.fill('input[name="password"]', 'Director123!')
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL('/')

    await page.goto('/administrative/certificados')
    await expect(page.locator('h1')).toContainText('Certificados y Constancias')

    // Abrir modal "Emitir certificado"
    await page.click('button:has-text("Emitir certificado")')
    await expect(page.locator('h2:has-text("Emitir certificado")')).toBeVisible()

    // Esperar a que los catálogos se carguen (el select de tipo tenga opciones)
    await page.waitForFunction(() => {
      const select = document.querySelector('select[name="tipo"]')
      return select && select.options.length > 1
    }, { timeout: 15000 })

    // Llenar formulario: tipo ESTUDIOS, alumno AL-001, año 2026
    // Los campos son selects (no inputs)
    await page.selectOption('select[name="tipo"]', 'ESTUDIOS')
    await page.selectOption('select[name="alumnoId"]', { label: 'AL-001' })
    await page.selectOption('select[name="anioId"]', ANIO_ID_E2E)

    await page.click('button:has-text("Emitir certificado")')
    await expect(page.locator('.text-emerald-800')).toContainText('Certificado emitido')

    // Verificar que aparece en la lista con estado EMITIDO y número
    await page.goto('/administrative/certificados')
    await expect(page.locator('table')).toBeVisible()
    await expect(page.locator('td')).toContainText('EMITIDO')
    await expect(page.locator('td')).toContainText('CERT-ESTUDIOS')

    const filaCertificado = page.locator('tbody tr').first()
    await expect(filaCertificado.locator('td')).toContainText('EMITIDO')

    // ==========================================
    // 2. APODERADO: DESCARGAR CERTIFICADO
    // ==========================================
    await page.click('button:has-text("Cerrar sesión")')
    await expect(page).toHaveURL('/login')

    await page.fill('input[name="identifier"]', 'apoderado1@ejemplo.edu.pe')
    await page.fill('input[name="password"]', 'Apoderado123!')
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL('/')

    await page.goto('/administrative/certificados')
    await expect(page.locator('table')).toBeVisible()
    await expect(page.locator('td')).toContainText('EMITIDO')

    await filaCertificado.locator('button:has-text("Ver")').click()
    await expect(page.locator('h4')).toContainText('Certificado')

    const downloadPromise = page.waitForEvent('download')
    await page.click('button:has-text("Descargar")')
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/\.pdf$/)

    await page.click('button:has-text("Cerrar")')

    // Verificación final
    await expect(page.locator('tbody tr').first().locator('td')).toContainText('EMITIDO')
  })
})