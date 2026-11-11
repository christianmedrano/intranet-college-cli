import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../../../core/auth/guards.js'
import { requirePermission } from '../../../core/rbac.js'
import {
  descargarAdjuntoAnuncioController,
  descargarAdjuntoMensajeController,
  eliminarAdjuntoAnuncioController,
  eliminarAdjuntoMensajeController,
  subirAdjuntoAnuncioController,
  subirAdjuntoMensajeController,
} from './adjunto.controller.js'

/**
 * Rutas de adjuntos. Se registran bajo `/api/v1`.
 *
 * Subida/eliminación de adjuntos en anuncios: `communication.anuncios.gestionar`
 * Subida/eliminación de adjuntos en mensajes: `communication.mensajeria.gestionar`
 * Descarga: mismo permiso que lectura del recurso padre.
 */
export async function adjuntoRoutes(app: FastifyInstance): Promise<void> {
  const gestionarAnuncios = [requireAuth, requirePermission('communication.anuncios.gestionar')]
  const gestionarMensajes = [requireAuth, requirePermission('communication.mensajeria.gestionar')]

  // Adjuntos de anuncios
  app.post('/anuncios/:id/adjuntos', { preHandler: gestionarAnuncios }, subirAdjuntoAnuncioController)
  app.delete('/anuncios/adjuntos/:id', { preHandler: gestionarAnuncios }, eliminarAdjuntoAnuncioController)
  app.get('/anuncios/adjuntos/:id/download', { preHandler: [requireAuth, requirePermission('communication.anuncios.leer')] }, descargarAdjuntoAnuncioController)

  // Adjuntos de mensajes
  app.post('/mensajes/:id/adjuntos', { preHandler: gestionarMensajes }, subirAdjuntoMensajeController)
  app.delete('/mensajes/adjuntos/:id', { preHandler: gestionarMensajes }, eliminarAdjuntoMensajeController)
  app.get('/mensajes/adjuntos/:id/download', { preHandler: [requireAuth, requirePermission('communication.mensajeria.gestionar')] }, descargarAdjuntoMensajeController)
}