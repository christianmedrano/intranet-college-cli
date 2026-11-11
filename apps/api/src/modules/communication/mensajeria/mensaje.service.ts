import type {
  MensajeResponse,
  CrearMensajeInput,
  PaginationInput,
  Paginated,
} from '@intranet/shared'
import type { PrismaClient } from '../../../generated/prisma/client.js'
import { getPrisma } from '../../../core/db.js'
import { AppError } from '../../../core/errors.js'
import { registrarAuditoria } from '../../../core/audit.js'
import { assertPermiso, type ActorAcademico } from '../../academic/scope.js'
import { institucionActual } from '../../core/estructura/institucion-actual.js'
import {
  obtenerOCrearHilo,
  crearMensaje,
  archivarMensaje,
} from './mensaje.repository.js'
import {
  construirAlcanceMensajes,
  type FiltrosConsultaMensajes,
} from './mensaje.scope.js'

/**
 * Envía un mensaje al hilo de una sección (RF-COM-004).
 *
 * Valida permiso `communication.mensajeria.gestionar`, resuelve el hilo
 * (creándolo si no existe), valida que el autor tenga vínculo con la sección
 * (tutor o apoderado con alumno en la sección), crea el mensaje y lo audita.
 */
export async function enviarMensajeService(
  seccionId: string,
  input: CrearMensajeInput,
  actor: ActorAcademico,
  prisma: PrismaClient = getPrisma(),
): Promise<MensajeResponse> {
  assertPermiso(actor, 'communication.mensajeria.gestionar')

  await institucionActual(prisma)

  // Verificar alcance antes de crear
  const { where } = await construirAlcanceMensajes(actor, { seccionId }, prisma)

  if (where.id === 'NINGUNO') {
    throw new AppError('FORBIDDEN', 'No tienes vínculo con esta sección para enviar mensajes.')
  }

  return prisma.$transaction(async (tx) => {
    // Obtener o crear hilo
    const hilo = await obtenerOCrearHilo(seccionId, tx)

    // Crear mensaje
    const mensaje = await crearMensaje(hilo.id, actor.id, input.cuerpo, tx)

    await registrarAuditoria(tx, {
      usuarioId: actor.id,
      accion: 'CREAR',
      entidad: 'MENSAJE_SECCION',
      entidadId: mensaje.id,
      datos: { hiloId: hilo.id, seccionId, cuerpo: input.cuerpo },
    })

    return mensaje
  })
}

/**
 * Lista los mensajes de un hilo de sección con paginación y alcance (RF-COM-005).
 *
 * El alcance se resuelve en `mensaje.scope.ts`: SuperAdmin/Director ven todo;
 * Docente tutor ve los de sus secciones; Apoderado ve los de secciones de sus alumnos.
 * El acceso de SuperAdmin se audita.
 */
export async function listarMensajesService(
  filtros: FiltrosConsultaMensajes,
  paginacion: PaginationInput,
  actor: ActorAcademico,
  prisma: PrismaClient = getPrisma(),
): Promise<Paginated<MensajeResponse>> {
  assertPermiso(actor, 'communication.mensajeria.gestionar')

  const { where, hiloId, auditarAcceso } = await construirAlcanceMensajes(actor, filtros, prisma)

  if (!hiloId) {
    return { data: [], meta: { page: paginacion.page, pageSize: paginacion.pageSize, total: 0 } }
  }

  const [total, filas] = await prisma.$transaction([
    prisma.mensajeSeccion.count({ where }),
    prisma.mensajeSeccion.findMany({
      where,
      include: { adjuntos: true, autor: { select: { persona: { select: { nombres: true, apellidos: true } } } } },
      orderBy: { createdAt: 'desc' },
      skip: (paginacion.page - 1) * paginacion.pageSize,
      take: paginacion.pageSize,
    }),
  ])

  if (auditarAcceso) {
    await registrarAuditoria(prisma, {
      usuarioId: actor.id,
      accion: 'ACCEDER',
      entidad: 'MENSAJE_SECCION',
      entidadId: null,
      datos: { hiloId, total },
    })
  }

  const { aFechaISO } = await import('../../core/estructura/fechas.js')

  const data = filas.map((fila) => ({
    id: fila.id,
    hiloId: fila.hiloId,
    autorId: fila.autorId,
    autorNombre: `${fila.autor.persona.nombres} ${fila.autor.persona.apellidos}`,
    autorRol: 'TODO',
    cuerpo: fila.cuerpo,
    createdAt: aFechaISO(fila.createdAt),
    updatedAt: aFechaISO(fila.updatedAt),
    adjuntos: fila.adjuntos.map((a) => ({
      id: a.id,
      nombreOriginal: a.nombreOriginal,
      url: `/api/v1/mensajes/adjuntos/${a.id}/download`,
      tipoMime: a.tipoMime,
      tamanoBytes: a.tamanoBytes,
      createdAt: aFechaISO(a.createdAt),
    })),
  }))

  return {
    data,
    meta: {
      page: paginacion.page,
      pageSize: paginacion.pageSize,
      total,
    },
  }
}

/**
 * Borrado lógico de un mensaje (RF-COM-005).
 *
 * Solo el autor o un Director pueden archivar. Se audita.
 */
export async function archivarMensajeService(
  id: string,
  actor: ActorAcademico,
  prisma: PrismaClient = getPrisma(),
): Promise<void> {
  assertPermiso(actor, 'communication.mensajeria.gestionar')

  // Verificar autoría o rol Director
  const mensaje = await prisma.mensajeSeccion.findUnique({
    where: { id, deletedAt: null },
    select: { autorId: true },
  })

  if (!mensaje) {
    throw new AppError('NOT_FOUND', 'El mensaje no existe.')
  }

  const esAutor = mensaje.autorId === actor.id
  const esDirector = actor.roles.includes('DIRECTOR')

  if (!esAutor && !esDirector) {
    throw new AppError('FORBIDDEN', 'Solo el autor o un Director pueden archivar este mensaje.')
  }

  await prisma.$transaction(async (tx) => {
    await archivarMensaje(id, tx)

    await registrarAuditoria(tx, {
      usuarioId: actor.id,
      accion: 'ARCHIVAR',
      entidad: 'MENSAJE_SECCION',
      entidadId: id,
      datos: {},
    })
  })
}