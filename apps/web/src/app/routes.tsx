import type { RouteObject } from 'react-router'
import { AsistenciasPage } from '../features/academic/asistencias/AsistenciasPage'
import { CalificacionesPage } from '../features/academic/calificaciones/CalificacionesPage'
import { ChangePasswordPage } from '../features/auth/ChangePasswordPage'
import { ForgotPasswordPage } from '../features/auth/ForgotPasswordPage'
import { HorariosIndexPage } from '../features/academic/horarios/HorariosIndexPage'
import { LoginPage } from '../features/auth/LoginPage'
import { MaterialesPage } from '../features/virtual-classroom/materiales/MaterialesPage'
import { RequireAuth } from './guards/RequireAuth'
import { AppLayout } from './layouts/AppLayout'
import { HomePage } from './pages/HomePage'

/** Páginas administrativas */
import { PagosPage } from '../features/administrative/pagos/PagosPage'
import { PagoNuevoPage } from '../features/administrative/pagos/PagoNuevoPage'
import { EstadoCuentaPage } from '../features/administrative/pagos/EstadoCuentaPage'
import { MatriculasPage } from '../features/administrative/matriculas/MatriculasPage'
import { CertificadosPage } from '../features/administrative/certificados/CertificadosPage'
import { PlantillasPage } from '../features/administrative/certificados/PlantillasPage'

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
          { path: '/asistencias', element: <AsistenciasPage /> },
          { path: '/horarios', element: <HorariosIndexPage /> },
          { path: '/cambiar-password', element: <ChangePasswordPage /> },
          { path: '/virtual', element: <MaterialesPage /> },
          // Rutas administrativas
          { path: '/administrative/pagos', element: <PagosPage /> },
          { path: '/administrative/pagos/nuevo', element: <PagoNuevoPage /> },
          { path: '/administrative/estado-cuenta/:alumnoId', element: <EstadoCuentaPage /> },
          { path: '/administrative/matriculas', element: <MatriculasPage /> },
          { path: '/administrative/certificados', element: <CertificadosPage /> },
          { path: '/administrative/plantillas', element: <PlantillasPage /> },
        ],
      },
      { path: '/login', element: <LoginPage /> },
      { path: '/recuperar-password', element: <ForgotPasswordPage /> },
    ],
  },
]
