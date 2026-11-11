import { test, expect } from '@playwright/test'

/**
 * Flujo E2E completo: docente registra calificación y asistencia; apoderado consulta.
 *
 * Requiere que el backend y frontend estén corriendo (webServer en playwright.config.ts).
 * Los usuarios de prueba deben existir en la base de datos de desarrollo.
 */

test.describe('Flujo académico completo', () => {
  test.beforeEach(async ({ page }) => {
    // Ir a la página de login
    await page.goto('/login')
    await expect(page).toHaveTitle(/Intranet/)
  })

  test('docente registra calificación y asistencia; apoderado consulta', async ({ page }) => {
    // --- LOGIN DOCENTE ---
    await page.fill('input[name="identifier"]', 'docente1@ejemplo.edu.pe')
    await page.fill('input[name="password"]', 'Docente123!')
    await page.click('button[type="submit"]')

    // Verificar redirección a home
    await expect(page).toHaveURL('/')

    // --- CALIFICACIONES ---
    await page.goto('/calificaciones')
    await expect(page.locator('h1')).toContainText('Calificaciones y notas finales')

    // Seleccionar filtros (usar UUIDs de prueba conocidos)
    await page.fill('input[name="periodoId"]', '11111111-1111-4111-8111-111111111111')
    await page.fill('input[name="cursoId"]', '22222222-2222-4222-8222-222222222222')
    await page.fill('input[name="seccionId"]', '33333333-3333-4333-8333-333333333333')
    await page.click('button:has-text("Consultar")')

    // Esperar a que cargue la tabla
    await expect(page.locator('table')).toBeVisible()

    // Crear una calificación
    await page.click('button:has-text("Crear calificación")')
    await expect(page.locator('h3')).toContainText('Crear calificación')

    await page.fill('input[name="alumnoId"]', '44444444-4444-4444-8444-444444444444')
    await page.selectOption('select[name="valorLiteral"]', 'A')
    await page.fill('textarea[name="observacion"]', 'Buen desempeño')
    await page.click('button:has-text("Guardar calificación")')

    // Verificar mensaje de éxito
    await expect(page.locator('.text-emerald-800')).toContainText('Calificación registrada')

    // --- ASISTENCIAS ---
    await page.goto('/asistencias')
    await expect(page.locator('h1')).toContainText('Asistencias y justificaciones')

    await page.fill('input[name="anioId"]', '55555555-5555-4555-8555-555555555555')
    await page.fill('input[name="seccionId"]', '33333333-3333-4333-8333-333333333333')
    await page.fill('input[name="desde"]', '2024-05-01')
    await page.fill('input[name="hasta"]', '2024-05-31')
    await page.click('button:has-text("Consultar")')

    await expect(page.locator('table')).toBeVisible()

    // Registrar asistencia en lote
    await page.click('button:has-text("Registrar asistencia")')
    await expect(page.locator('h3')).toContainText('Registrar asistencia')

    await page.fill('input[name="seccionId"]', '33333333-3333-4333-8333-333333333333')
    await page.fill('input[name="fecha"]', '2024-05-02')
    await page.fill('input[name="alumnoId-0"]', '44444444-4444-4444-8444-444444444444')
    await page.selectOption('select[name="estado-0"]', 'PRESENTE')
    await page.click('button:has-text("Registrar asistencia")')

    await expect(page.locator('.text-emerald-800')).toContainText('Asistencia registrada para 1 alumno')

    // --- LOGOUT DOCENTE ---
    await page.click('button:has-text("Cerrar sesión")')
    await expect(page).toHaveURL('/login')

    // --- LOGIN APODERADO ---
    await page.fill('input[name="identifier"]', 'apoderado1@ejemplo.edu.pe')
    await page.fill('input[name="password"]', 'Apoderado123!')
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL('/')

    // --- CONSULTA CALIFICACIONES COMO APODERADO ---
    await page.goto('/calificaciones')
    await expect(page.locator('h1')).toContainText('Calificaciones y notas finales')

    // El apoderado solo ve las calificaciones de sus alumnos vinculados
    await page.fill('input[name="periodoId"]', '11111111-1111-4111-8111-111111111111')
    await page.click('button:has-text("Consultar")')

    await expect(page.locator('table')).toBeVisible()
    // Verificar que ve la calificación del alumno vinculado
    await expect(page.locator('td')).toContainText('A')

    // --- CONSULTA ASISTENCIAS COMO APODERADO ---
    await page.goto('/asistencias')
    await expect(page.locator('h1')).toContainText('Asistencias y justificaciones')

    await page.fill('input[name="anioId"]', '55555555-5555-4555-8555-555555555555')
    await page.click('button:has-text("Consultar")')

    await expect(page.locator('table')).toBeVisible()
    await expect(page.locator('td')).toContainText('Presente')

    // --- CONSULTA HORARIOS COMO APODERADO ---
    await page.goto('/horarios')
    await expect(page.locator('h1')).toContainText('Configuración académica')

    // Cambiar a pestaña Horarios
    await page.click('button:has-text("Horarios")')
    await expect(page.locator('h2')).toContainText('Horarios')

    await page.fill('input[name="anioId"]', '55555555-5555-4555-8555-555555555555')
    await page.click('button:has-text("Consultar")')

    await expect(page.locator('table')).toBeVisible()
    // Solo lectura - no botones de gestión
    await expect(page.locator('button:has-text("Crear horario")')).not.toBeVisible()
  })
})