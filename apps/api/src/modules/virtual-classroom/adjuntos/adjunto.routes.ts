import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../../../core/auth/guards.js'
import { requirePermission } from '../../../core/rbac.js'
import {
  subirAdjuntoController,
  eliminarAdjuntoController,
  descargarAdjuntoController,
  listarAdjuntosController,
} from './adjunto.controller.js'

/**
 * Rutas del módulo Aula Virtual - Adjuntos.
 *
 * Prefijo base: /api/v1/virtual
 * Permisos según docs/rbac-matrix.md:
 * - virtual.leer: lectura de adjuntos (DI, DO vinculado, PA vinculado, AL vinculado, SA auditado)
 * - virtual.gestionar: escritura de adjuntos (DI, DO vinculado)
 *
 * `requireAuth` hidrata `request.authUser`; sin él `requirePermission` responde
 * `401` aunque el token sea válido.
 */
export async function adjuntoVirtualRoutes(app: FastifyInstance): Promise<void> {
  const leer = [requireAuth, requirePermission('virtual.leer')]
  const gestionar = [requireAuth, requirePermission('virtual.gestionar')]

  // POST /api/v1/virtual/materiales/:id/adjuntos - Subir adjunto a material (RF-VIR-005)
  app.post<{ Params: { id: string } }>(
    '/virtual/materiales/:id/adjuntos',
    { preHandler: gestionar },
    subirAdjuntoController,
  )

  // GET /api/v1/virtual/materiales/:id/adjuntos - Listar adjuntos de un material (RF-VIR-005)
  app.get<{
    Params: { id: string }
    Querystring: { page?: string; pageSize?: string }
  }>(
    '/virtual/materiales/:id/adjuntos',
    { preHandler: leer },
    listarAdjuntosController,
  )

  // DELETE /api/v1/virtual/adjuntos/:id - Eliminar adjunto (RF-VIR-005)
  app.delete<{ Params: { id: string }; Querystring: { materialId: string } }>(
    '/virtual/adjuntos/:id',
    { preHandler: gestionar },
    eliminarAdjuntoController,
  )

  // GET /api/v1/virtual/adjuntos/:id/download - Descargar adjunto (RF-VIR-005)
  app.get<{ Params: { id: string }; Querystring: { materialId: string } }>(
    '/virtual/adjuntos/:id/download',
    { preHandler: leer },
    descargarAdjuntoController,
  )
}
