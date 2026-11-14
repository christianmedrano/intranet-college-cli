import { test, expect } from '@playwright/test'

/**
 * Flujo E2E de matrícula: director crea matrícula → estado APROBADA.
 *
 * Requiere que el backend (puerto 3000) y frontend (puerto 5173) estén corriendo.
 * Los usuarios de prueba deben existir en la base de datos de desarrollo.
 * Ejecuta `npm run seed:e2e` antes para crear los datos.
 *
 * Usuarios semilla (creados por `npm run seed:e2e`):
 * - director1@ejemplo.edu.pe / Director123! (DIRECTOR)
 * - apoderado1@ejemplo.edu.pe / Apoderado123! (APODERADO, vinculado a alumno1)
 * - alumno1@ejemplo.edu.pe / Alumno123! (ALUMNO)
 *
 * IDs fijos del seed-e2e:
 * - ANIO_ID_E2E: 66666666-6666-4666-8666-666666666666
 * - ALUMNO_CODIGO: AL-001 (se usa como label en select)
 */

const ANIO_ID_E2E = '66666666-6666-4666-8666-666666666666'

test.describe('Flujo matrícula E2E: director solicita y aprueba', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await expect(page).toHaveTitle(/Intranet/)
  })

  test('director solicita matrícula y la aprueba', async ({ page }) => {
    // ==========================================
    // 1. DIRECTOR: SOLICITAR MATRÍCULA
    // ==========================================
    await page.fill('input[name="identifier"]', 'director1@ejemplo.edu.pe')
    await page.fill('input[name="password"]', 'Director123!')
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL('/')

    await page.goto('/administrative/matriculas')
    await expect(page.locator('h1')).toContainText('Matrículas')

    // Abrir modal "Nueva matrícula"
    await page.click('button:has-text("Nueva matrícula")')
    await expect(page.locator('h2:has-text("Nueva matrícula")')).toBeVisible()

    // Esperar a que los catálogos se carguen - polling hasta que el select tenga opciones
    await page.waitForFunction(() => {
      const select = document.querySelector('select[name="alumnoId"]')
      return select && select.options.length > 1
    }, { timeout: 30000, polling: 'raf' })

    // Pequeña pausa adicional para estabilidad
    await page.waitForTimeout(500)

    // Llenar formulario: alumno, año, nivel, grado, sección
    const alumnoOption = await page.locator('select[name="alumnoId"] option').allTextContents()
    const alumnoValue = alumnoOption.find(t => t.includes('AL-001'))?.split(' - ')[0] || ''
    await page.selectOption('select[name="alumnoId"]', alumnoValue)
    await page.selectOption('select[name="anioId"]', ANIO_ID_E2E)
    await page.selectOption('select[name="nivelId"]', { label: 'Primaria' })
    await page.selectOption('select[name="gradoId"]', { label: 'Primero' })
    await page.selectOption('select[name="seccionId"]', { label: 'A' })

    await page.click('button:has-text("Solicitar matrícula")')
    await expect(page.locator('.text-emerald-800')).toContainText('Matrícula solicitada')

    // Verificar que aparece en la lista con estado SOLICITADA
    await page.goto('/administrative/matriculas')
    await expect(page.locator('table')).toBeVisible()
    await expect(page.locator('td')).toContainText('SOLICITADA')

    const filaMatricula = page.locator('tbody tr', { hasText: 'AL-001' }).first()
    await expect(filaMatricula).toBeVisible()
    await expect(filaMatricula.locator('td')).toContainText('SOLICITADA')

    // ==========================================
    // 2. DIRECTOR: APROBAR MATRÍCULA
    // ==========================================
    await filaMatricula.locator('button:has-text("Aprobar")').click()
    await expect(page.locator('.text-emerald-800')).toContainText('Matrícula aprobada')

    // Verificar que el estado cambió a APROBADA
    await page.goto('/administrative/matriculas')
    await expect(page.locator('tbody tr', { hasText: 'AL-001' }).first().locator('td')).toContainText('APROBADA')
  })
})