import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'mysql://test:test@localhost:3306/intranet_college_test',
      JWT_SECRET: 'clave-de-pruebas-con-mas-de-32-caracteres',
    },
  },
})
