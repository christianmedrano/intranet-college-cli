import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../../../core/auth/guards.js'
import { requirePermission, requireAnyPermission } from '../../../core/rbac.js'
import {
  crearMaterialController,
  actualizarMaterialController,
  eliminarMaterialController,
  listarMaterialesController,
  obtenerMaterialController,
  descargarMaterialController,
} from './material.controller.js'
import {
  type CrearMaterialInput,
  type ActualizarMaterialInput,
  type ListarMaterialesQuery,
} from '@intranet/shared'

/**
 * Rutas del módulo Aula Virtual - Materiales.
 *
 * Prefijo base: /api/v1/virtual
 * Permisos según docs/rbac-matrix.md:
 * - virtual.leer: lectura (DI, DO vinculado, PA vinculado, AL vinculado, SA auditado)
 * - virtual.gestionar: escritura (DI, DO vinculado)
 * - virtual.eliminar: eliminación (DI, DO vinculado, SA)
 *
 * `requireAuth` hidrata `request.authUser`; sin él `requirePermission` responde
 * `401` aunque el token sea válido.
 */
export async function materialRoutes(app: FastifyInstance): Promise<void> {
  const leer = [requireAuth, requirePermission('virtual.leer')]
  const gestionar = [requireAuth, requirePermission('virtual.gestionar')]
  const eliminar = [
    requireAuth,
    requireAnyPermission(['virtual.gestionar', 'virtual.eliminar']),
  ]

  // POST /api/v1/virtual/materiales - Crear material (RF-VIR-001)
  app.post<{ Body: CrearMaterialInput }>(
    '/virtual/materiales',
    { preHandler: gestionar },
    crearMaterialController,
  )

  // GET /api/v1/virtual/materiales - Listar materiales (RF-VIR-004)
  app.get<{ Querystring: ListarMaterialesQuery }>(
    '/virtual/materiales',
    { preHandler: leer },
    listarMaterialesController,
  )

  // GET /api/v1/virtual/materiales/:id - Detalle material (RF-VIR-003)
  app.get<{ Params: { id: string } }>(
    '/virtual/materiales/:id',
    { preHandler: leer },
    obtenerMaterialController,
  )

  // PATCH /api/v1/virtual/materiales/:id - Actualizar material (RF-VIR-002)
  app.patch<{ Params: { id: string }; Body: ActualizarMaterialInput }>(
    '/virtual/materiales/:id',
    { preHandler: gestionar },
    actualizarMaterialController,
  )

  // DELETE /api/v1/virtual/materiales/:id - Eliminar material (RF-VIR-003)
  app.delete<{ Params: { id: string } }>(
    '/virtual/materiales/:id',
    { preHandler: eliminar },
    eliminarMaterialController,
  )

  // GET /api/v1/virtual/materiales/:id/download - Descargar material (RF-VIR-005)
  app.get<{ Params: { id: string } }>(
    '/virtual/materiales/:id/download',
    { preHandler: leer },
    descargarMaterialController,
  )
}
