import type {
  AnuncioResponse,
  CrearAnuncioInput,
  ActualizarAnuncioInput,
  PaginationInput,
  Paginated,
  RoleCode,
} from '@intranet/shared'
import type { PrismaClient } from '../../../generated/prisma/client.js'
import { getPrisma } from '../../../core/db.js'
import { AppError } from '../../../core/errors.js'
import { institucionActual } from '../../core/estructura/institucion-actual.js'
import { registrarAuditoria } from '../../../core/audit.js'
import { auditarAccesoAcademico } from '../../academic/consulta-audit.js'
import { assertPermiso, type ActorAcademico } from '../../academic/scope.js'
import {
  archivarAnuncio,
  actualizarAnuncio,
  crearAnuncio,
  encontrarAnuncioPorId,
} from './anuncio.repository.js'
import {
  construirAlcanceAnuncios,
  type FiltrosConsultaAnuncios,
} from './anuncio.scope.js'
import { aFechaISO } from '../../core/estructura/fechas.js'

/**
 * Crea un anuncio institucional o de sección (RF-COM-001, RF-COM-002).
 *
 * Valida permiso `communication.anuncios.gestionar`, resuelve la institución
 * actual, crea el registro y lo audita.
 */
export async function crearAnuncioService(
  input: CrearAnuncioInput,
  actor: ActorAcademico,
  prisma: PrismaClient = getPrisma(),
): Promise<AnuncioResponse> {
  assertPermiso(actor, 'communication.anuncios.gestionar')

  const institucion = await institucionActual(prisma)

  return prisma.$transaction(async (tx) => {
    const anuncio = await crearAnuncio(
      { ...input, autorId: actor.id, institucionId: institucion.id },
      tx,
    )

    await registrarAuditoria(tx, {
      usuarioId: actor.id,
      accion: 'CREAR',
      entidad: 'ANUNCIO',
      entidadId: anuncio.id,
      datos: { titulo: anuncio.titulo, tipo: anuncio.tipo },
    })

    return anuncio
  })
}

/**
 * Obtiene un anuncio por ID (RF-COM-003).
 *
 * Valida permiso `communication.anuncios.leer` y alcance según vínculo.
 */
export async function obtenerAnuncioService(
  id: string,
  actor: ActorAcademico,
  prisma: PrismaClient = getPrisma(),
): Promise<AnuncioResponse | null> {
  assertPermiso(actor, 'communication.anuncios.leer')

  const anuncio = await encontrarAnuncioPorId(id, prisma)

  if (!anuncio) return null

  // Verificar alcance
  const { where } = await construirAlcanceAnuncios(
    actor,
    { tipo: anuncio.tipo as 'INSTITUCIONAL' | 'SECCION' },
    prisma,
  )
  const permitido = await getPrisma().anuncio.findFirst({ where: { ...where, id } })
  
  if (!permitido) return null

  return anuncio
}

/**
 * Actualiza parcialmente un anuncio (RF-COM-001, RF-COM-002).
 *
 * Solo el autor o un Director pueden editar. Se audita con valores anterior/nuevo.
 */
export async function actualizarAnuncioService(
  id: string,
  input: ActualizarAnuncioInput,
  actor: ActorAcademico,
  prisma: PrismaClient = getPrisma(),
): Promise<AnuncioResponse> {
  assertPermiso(actor, 'communication.anuncios.gestionar')

  const actual = await encontrarAnuncioPorId(id, prisma)

  if (!actual) {
    throw new AppError('NOT_FOUND', 'El anuncio no existe.')
  }

  // Verificar autoría o rol Director
  const esAutor = actual.autorId === actor.id
  const esDirector = actor.roles.includes('DIRECTOR')

  if (!esAutor && !esDirector) {
    throw new AppError('FORBIDDEN', 'Solo el autor o un Director pueden editar este anuncio.')
  }

  const anterior = { ...actual }

  return prisma.$transaction(async (tx) => {
    const actualizado = await actualizarAnuncio(id, input, tx)

    await registrarAuditoria(tx, {
      usuarioId: actor.id,
      accion: 'ACTUALIZAR',
      entidad: 'ANUNCIO',
      entidadId: id,
      datos: {
        titulo: { anterior: anterior.titulo, nuevo: actualizado.titulo },
        cuerpo: { anterior: anterior.cuerpo, nuevo: actualizado.cuerpo },
        tipo: { anterior: anterior.tipo, nuevo: actualizado.tipo },
        estado: { anterior: anterior.estado, nuevo: actualizado.estado },
        audienciaNiveles: { anterior: anterior.audienciaNiveles, nuevo: actualizado.audienciaNiveles },
        audienciaGrados: { anterior: anterior.audienciaGrados, nuevo: actualizado.audienciaGrados },
        audienciaSecciones: { anterior: anterior.audienciaSecciones, nuevo: actualizado.audienciaSecciones },
        audienciaRoles: { anterior: anterior.audienciaRoles, nuevo: actualizado.audienciaRoles },
        expiraEn: { anterior: anterior.expiraEn, nuevo: actualizado.expiraEn },
      },
    })

    return actualizado
  })
}

/**
 * Archiva (borrado lógico) un anuncio (RF-COM-001, RF-COM-002).
 *
 * Solo el autor o un Director pueden archivar. El estado pasa a ARCHIVADO
 * y se setea deletedAt. Se audita.
 */
export async function archivarAnuncioService(
  id: string,
  actor: ActorAcademico,
  prisma: PrismaClient = getPrisma(),
): Promise<void> {
  assertPermiso(actor, 'communication.anuncios.gestionar')

  const actual = await encontrarAnuncioPorId(id, prisma)

  if (!actual) {
    throw new AppError('NOT_FOUND', 'El anuncio no existe.')
  }

  const esAutor = actual.autorId === actor.id
  const esDirector = actor.roles.includes('DIRECTOR')

  if (!esAutor && !esDirector) {
    throw new AppError('FORBIDDEN', 'Solo el autor o un Director pueden archivar este anuncio.')
  }

  await prisma.$transaction(async (tx) => {
    await archivarAnuncio(id, tx)

    await registrarAuditoria(tx, {
      usuarioId: actor.id,
      accion: 'ARCHIVAR',
      entidad: 'ANUNCIO',
      entidadId: id,
      datos: { estado: { anterior: actual.estado, nuevo: 'ARCHIVADO' } },
    })
  })
}

/**
 * Lista anuncios con filtros, paginación y alcance según vínculo (RF-COM-003).
 *
 * El alcance se resuelve en `anuncio.scope.ts`: SuperAdmin/Director ven todo;
 * Docente ve institucionales + sus secciones; Apoderado/Alumno ven según sus
 * vínculos. El acceso de SuperAdmin se audita.
 */
export async function listarAnunciosService(
  filtros: FiltrosConsultaAnuncios,
  paginacion: PaginationInput,
  actor: ActorAcademico,
  prisma: PrismaClient = getPrisma(),
): Promise<Paginated<AnuncioResponse>> {
  assertPermiso(actor, 'communication.anuncios.leer')

  const { where, auditarAcceso } = await construirAlcanceAnuncios(actor, filtros, prisma)

  const [total, filas] = await prisma.$transaction([
    prisma.anuncio.count({ where }),
    prisma.anuncio.findMany({
      where,
      include: { adjuntos: true },
      orderBy: [{ publicadoEn: 'desc' }, { createdAt: 'desc' }],
      skip: (paginacion.page - 1) * paginacion.pageSize,
      take: paginacion.pageSize,
    }),
  ])

  if (auditarAcceso) {
    await auditarAccesoAcademico(
      prisma,
      actor,
      'ANUNCIO',
      { entidadId: null, datos: { filtros: JSON.parse(JSON.stringify(filtros)), total } },
      {},
    )
  }

  const data = filas.map((fila) => ({
    id: fila.id,
    institucionId: fila.institucionId,
    autorId: fila.autorId,
    titulo: fila.titulo,
    cuerpo: fila.cuerpo,
    tipo: fila.tipo as 'INSTITUCIONAL' | 'SECCION',
    estado: fila.estado as 'BORRADOR' | 'PUBLICADO' | 'EXPIRADO' | 'ARCHIVADO',
    audienciaNiveles: (fila.audienciaNiveles as string[]) ?? [],
    audienciaGrados: (fila.audienciaGrados as string[]) ?? [],
    audienciaSecciones: (fila.audienciaSecciones as string[]) ?? [],
    audienciaRoles: ((fila.audienciaRoles as string[]) ?? []) as RoleCode[],
    publicadoEn: fila.publicadoEn ? aFechaISO(fila.publicadoEn) : null,
    expiraEn: fila.expiraEn ? aFechaISO(fila.expiraEn) : null,
    createdAt: fila.createdAt.toISOString(),
    updatedAt: fila.updatedAt.toISOString(),
    adjuntos: fila.adjuntos.map((a) => ({
      id: a.id,
      nombreOriginal: a.nombreOriginal,
      url: `/api/v1/anuncios/adjuntos/${a.id}/download`,
      tipoMime: a.tipoMime,
      tamanoBytes: a.tamanoBytes,
      createdAt: a.createdAt.toISOString(),
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