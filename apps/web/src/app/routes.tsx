import type { RouteObject } from 'react-router'
import { LoginPage } from '../features/auth/LoginPage'
import { AppLayout } from './layouts/AppLayout'
import { HomePage } from './pages/HomePage'

/**
 * Rutas de la aplicación.
 *
 * Se exportan para que las pruebas puedan montarlas con un router en memoria
 * sin depender del historial del navegador.
 */
export const routes: RouteObject[] = [
  {
    element: <AppLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/login', element: <LoginPage /> },
    ],
  },
]
