import { defineConfig, devices } from '@playwright/test'

/**
 * Configuración de Playwright para la intranet escolar.
 *
 * Ejecuta: `npx playwright test`
 * Con UI: `npx playwright test --ui`
 * En headed: `npx playwright test --headed`
 *
 * Requiere que el backend (puerto 3000) y frontend (puerto 5173) estén corriendo.
 * En desarrollo local, usa `npm run dev` en otra terminal antes de ejecutar tests.
 * En CI, el webServer arranca ambos con concurrently.
 */
export default defineConfig({
  testDir: './apps/web/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: process.env.USE_WEBSERVER === 'false' ? undefined : [
    {
      command: process.env.CI ? 'npm run dev:api' : 'npm run dev:api',
      url: 'http://localhost:3000/health',
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
    {
      command: process.env.CI ? 'npm run dev:web' : 'npm run dev:web',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
})