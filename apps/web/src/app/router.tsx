import { createBrowserRouter, RouterProvider } from 'react-router'
import { routes } from './routes'

/** Router del navegador para la aplicación montada. */
export function AppRouter() {
  return <RouterProvider router={createBrowserRouter(routes)} />
}
