import type { RouteObject } from 'react-router'
import { CalificacionesPage } from '../features/academic/calificaciones/CalificacionesPage'
import { ChangePasswordPage } from '../features/auth/ChangePasswordPage'
import { ForgotPasswordPage } from '../features/auth/ForgotPasswordPage'
import { LoginPage } from '../features/auth/LoginPage'
import { RequireAuth } from './guards/RequireAuth'
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
      {
        element: <RequireAuth />,
        children: [
          { path: '/', element: <HomePage /> },
          { path: '/calificaciones', element: <CalificacionesPage /> },
          { path: '/cambiar-password', element: <ChangePasswordPage /> },
        ],
      },
      { path: '/login', element: <LoginPage /> },
      { path: '/recuperar-password', element: <ForgotPasswordPage /> },
    ],
  },
]
