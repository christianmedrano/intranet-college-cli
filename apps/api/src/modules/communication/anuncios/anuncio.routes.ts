import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../../../core/auth/guards.js'
import { requirePermission } from '../../../core/rbac.js'
import {
  archivarAnuncioController,
  actualizarAnuncioController,
  crearAnuncioController,
  listarAnunciosController,
  obtenerAnuncioController,
} from './anuncio.controller.js'

/**
 * Rutas de anuncios. Se registran bajo `/api/v1`.
 *
 * Escritura exige `communication.anuncios.gestionar`; lectura, `communication.anuncios.leer`.
 * El alcance por vínculo se resuelve en el servicio (RF-COM-001 a RF-COM-003).
 */
export async function anuncioRoutes(app: FastifyInstance): Promise<void> {
  const gestionar = [
    requireAuth,
    requirePermission('communication.anuncios.gestionar'),
  ]
  const leer = [
    requireAuth,
    requirePermission('communication.anuncios.leer'),
  ]

  app.post('/anuncios', { preHandler: gestionar }, crearAnuncioController)

  app.get('/anuncios', { preHandler: leer }, listarAnunciosController)

  app.get('/anuncios/:id', { preHandler: leer }, obtenerAnuncioController)

  app.patch('/anuncios/:id', { preHandler: gestionar }, actualizarAnuncioController)

  app.delete('/anuncios/:id', { preHandler: gestionar }, archivarAnuncioController)

  // Adjuntos se manejan en rutas separadas (adjunto.routes.ts)
}