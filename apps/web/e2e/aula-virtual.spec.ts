import { test, expect } from '@playwright/test'

/**
 * Flujo E2E del Aula Virtual: docente sube material → alumno/apoderado descarga.
 *
 * Requiere que el backend (puerto 3000) y frontend (puerto 5173) estén corriendo.
 * Los usuarios de prueba deben existir en la base de datos de desarrollo.
 * Ejecuta `npm run seed:e2e` antes para crear los datos.
 *
 * Usuarios semilla (creados por `npm run seed:e2e`):
 * - docente1@ejemplo.edu.pe / Docente123! — Docente con asignación a curso/sección
 * - alumno1@ejemplo.edu.pe / Alumno123! — Alumno matriculado en esa sección
 * - apoderado1@ejemplo.edu.pe / Apoderado123! — Apoderado del alumno
 */

// ANIO_ID_E2E fijo creado por seed-e2e
const ANIO_ID_E2E = '66666666-6666-4666-8666-666666666666'

test.describe('Aula Virtual — flujo docente crea material, alumno/apoderado descarga', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await expect(page).toHaveTitle(/Intranet/)
  })

  test('docente crea material y alumno/apoderado lo descargan', async ({ page }) => {
    // --- LOGIN DOCENTE ---
    await page.fill('input[name="identifier"]', 'docente1@ejemplo.edu.pe')
    await page.fill('input[name="password"]', 'Docente123!')
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL('/')

    // Ir a Aula Virtual (requiere anioId en query)
    await page.goto('/virtual?anioId=' + ANIO_ID_E2E)
    await expect(page.locator('h1')).toContainText('Materiales del Aula Virtual')

    // --- CREAR MATERIAL ---
    await page.click('button:has-text("Crear material")')
    await expect(page.locator('h3')).toContainText('Crear material')

    // Llenar formulario: curso, sección, período (usando datalist/autocompletado)
    // Los valores son UUIDs; en dev se conocen por el seed
    await page.fill('input[name="cursoId"]', ANIO_ID_E2E === '66666666-6666-4666-8666-666666666666'
      ? 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
      : 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')
    await page.fill('input[name="seccionId"]', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc')
    await page.fill('input[name="periodoId"]', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd')

    await page.fill('input[name="titulo"]', 'Guía de fracciones E2E')
    await page.fill('textarea[name="descripcion"]', 'Material de prueba creado por Playwright')

    // Subir archivo PDF (10 MB máx)
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: 'guia-fracciones.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 contenido de prueba E2E'),
    })

    // Verificar que el archivo se cargó (nombre y tamaño)
    await expect(page.locator('input[name="archivoNombre"]')).toHaveValue('guia-fracciones.pdf')

    await page.click('button:has-text("Guardar material")')
    await expect(page.locator('.text-emerald-800')).toContainText('Material creado')

    // El material aparece en la lista
    await expect(page.locator('table')).toBeVisible()
    await expect(page.locator('td')).toContainText('Guía de fracciones E2E')

    // Obtener el ID del material recién creado para la descarga
    // El enlace al detalle está en la primera columna
    const primeraFila = page.locator('tbody tr').first()
    await primeraFila.locator('button:has-text("Ver")').click()
    await expect(page.locator('h4')).toContainText('Guía de fracciones E2E')

    // --- DESCARGAR MATERIAL COMO DOCENTE ---
    await page.click('button:has-text("Descargar material")')
    // La descarga se dispara via <a download>, Playwright puede interceptar
    const downloadPromise = page.waitForEvent('download')
    await page.click('button:has-text("Descargar material")')
    const download = await downloadPromise
    expect(download.suggestedFilename()).toBe('guia-fracciones.pdf')

    // Cerrar detalle
    await page.click('button:has-text("Cerrar")')

    // --- LOGOUT DOCENTE ---
    await page.click('button:has-text("Cerrar sesión")')
    await expect(page).toHaveURL('/login')

    // --- LOGIN ALUMNO ---
    await page.fill('input[name="identifier"]', 'alumno1@ejemplo.edu.pe')
    await page.fill('input[name="password"]', 'Alumno123!')
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL('/')

    // Ir a Aula Virtual (mismo ANIO_ID_E2E)
    await page.goto('/virtual?ANIO_ID_E2E=' + ANIO_ID_E2E)
    await expect(page.locator('h1')).toContainText('Materiales del Aula Virtual')

    // El alumno ve el material en su sección
    await expect(page.locator('td')).toContainText('Guía de fracciones E2E')

    // Ver detalle y descargar
    await page.locator('tbody tr').first().locator('button:has-text("Ver")').click()
    await expect(page.locator('h4')).toContainText('Guía de fracciones E2E')

    const downloadAlumno = await page.waitForEvent('download')
    await page.click('button:has-text("Descargar material")')
    expect(downloadAlumno.suggestedFilename()).toBe('guia-fracciones.pdf')

    await page.click('button:has-text("Cerrar")')

    // --- LOGOUT ALUMNO ---
    await page.click('button:has-text("Cerrar sesión")')
    await expect(page).toHaveURL('/login')

    // --- LOGIN APODERADO ---
    await page.fill('input[name="identifier"]', 'apoderado1@ejemplo.edu.pe')
    await page.fill('input[name="password"]', 'Apoderado123!')
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL('/')

    await page.goto('/virtual?ANIO_ID_E2E=' + ANIO_ID_E2E)
    await expect(page.locator('td')).toContainText('Guía de fracciones E2E')

    await page.locator('tbody tr').first().locator('button:has-text("Ver")').click()
    await expect(page.locator('h4')).toContainText('Guía de fracciones E2E')

    const downloadApoderado = await page.waitForEvent('download')
    await page.click('button:has-text("Descargar material")')
    expect(downloadApoderado.suggestedFilename()).toBe('guia-fracciones.pdf')
  })
})

test.describe('Aula Virtual — adjuntos', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await expect(page).toHaveTitle(/Intranet/)
  })

  test('docente sube adjunto a material y alumno lo descarga', async ({ page }) => {
    await page.fill('input[name="identifier"]', 'docente1@ejemplo.edu.pe')
    await page.fill('input[name="password"]', 'Docente123!')
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL('/')

    await page.goto('/virtual?anioId=' + ANIO_ID_E2E)
    await expect(page.locator('h1')).toContainText('Materiales del Aula Virtual')

    // Crear material base si no existe
    const tieneMateriales = await page.locator('tbody tr').count()
    if (tieneMateriales === 0) {
      await page.click('button:has-text("Crear material")')
      await page.fill('input[name="cursoId"]', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
      await page.fill('input[name="seccionId"]', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc')
      await page.fill('input[name="periodoId"]', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd')
      await page.fill('input[name="titulo"]', 'Material base para adjuntos')
      const fileInput = page.locator('input[type="file"]')
      await fileInput.setInputFiles({
        name: 'base.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('%PDF-1.4 base'),
      })
      await page.click('button:has-text("Guardar material")')
      await expect(page.locator('.text-emerald-800')).toContainText('Material creado')
    }

    // Abrir detalle del primer material
    await page.locator('tbody tr').first().locator('button:has-text("Ver")').click()

    // Subir adjunto
    await page.click('button:has-text("Agregar adjunto")')
    const adjuntoInput = page.locator('input[type="file"]').last()
    await adjuntoInput.setInputFiles({
      name: 'anexo-ejercicios.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 anexo ejercicios'),
    })
    await page.click('button:has-text("Subir adjunto")')
    await expect(page.locator('.text-emerald-800')).toContainText('Adjunto subido')

    // Verificar que aparece en la lista de adjuntos
    await expect(page.locator('text=anexo-ejercicios.pdf')).toBeVisible()

    // Descargar adjunto
    const downloadAdjunto = await page.waitForEvent('download')
    await page.locator('text=anexo-ejercicios.pdf').locator('..').locator('button:has-text("Descargar")').click()
    expect(downloadAdjunto.suggestedFilename()).toBe('anexo-ejercicios.pdf')

    // Cerrar y logout
    await page.click('button:has-text("Cerrar")')
    await page.click('button:has-text("Cerrar sesión")')
    await expect(page).toHaveURL('/login')

    // Login alumno y verificar descarga adjunto
    await page.fill('input[name="identifier"]', 'alumno1@ejemplo.edu.pe')
    await page.fill('input[name="password"]', 'Alumno123!')
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL('/')

    await page.goto('/virtual?ANIO_ID_E2E=' + ANIO_ID_E2E)
    await page.locator('tbody tr').first().locator('button:has-text("Ver")').click()
    await expect(page.locator('text=anexo-ejercicios.pdf')).toBeVisible()

    const downloadAlumnoAdjunto = await page.waitForEvent('download')
    await page.locator('text=anexo-ejercicios.pdf').locator('..').locator('button:has-text("Descargar")').click()
    expect(downloadAlumnoAdjunto.suggestedFilename()).toBe('anexo-ejercicios.pdf')
  })
})