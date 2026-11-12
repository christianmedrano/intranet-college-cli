import {
  TAMANO_MAXIMO_BYTES_VIR,
  esTipoMimePermitidoVir,
  type CrearMaterialInput,
  type ActualizarMaterialInput,
  type MaterialResponsePayload,
  type PaginatedMaterialesPayload,
  type ListarMaterialesQuery,
  materialResponseSchema,
} from '@intranet/shared'
import { getPrisma } from '../../../core/db.js'
import { AppError } from '../../../core/errors.js'
import { registrarAuditoria } from '../../../core/audit.js'
import { hasPermission } from '../../../core/rbac.js'
import {
  assertPermiso,
  construirAlcanceMateriales,
  assertVinculoMaterial,
  assertDocenteDeCursoSeccion,
  esAdministrativo,
  resolverDocenteDelActor,
  type ActorVirtual,
  type FiltrosMateriales,
} from './material.scope.js'
import {
  createMaterial,
  updateMaterial,
  softDeleteMaterial,
  findMaterialPorId,
  findMaterialPorIdInterno,
  findMateriales,
  existeDuplicado,
  type CrearMaterialData,
  type ActualizarMaterialData,
} from './material.repository.js'
import type { PrismaClient } from '../../../generated/prisma/client.js'

/** Genera una ruta de almacenamiento no predecible (RN-VIR-006). */
function generarRutaAlmacenamiento(
  cursoId: string,
  seccionId: string,
  periodoId: string,
  extension: string,
): string {
  const uuid = crypto.randomUUID()
  return `uploads/virtual/${cursoId}/${seccionId}/${periodoId}/${uuid}.${extension}`
}

/** Extrae la extensión del nombre original. */
function extraerExtension(nombreOriginal: string): string {
  const partes = nombreOriginal.split('.')
  return partes.length > 1 ? partes.pop()?.toLowerCase() || 'bin' : 'bin'
}

/** Valida tipo MIME y tamaño (RN-VIR-005). */
function validarArchivo(mime: string, tamanoBytes: number): void {
  if (!esTipoMimePermitidoVir(mime)) {
    throw new AppError(
      'VALIDATION_ERROR',
      `Tipo de archivo no permitido: ${mime}. Tipos permitidos: PDF, DOCX, XLSX, PPTX, JPEG, PNG, WEBP`,
    )
  }

  if (tamanoBytes > TAMANO_MAXIMO_BYTES_VIR) {
    throw new AppError(
      'VALIDATION_ERROR',
      `Archivo demasiado grande. Máximo ${TAMANO_MAXIMO_BYTES_VIR / 1024 / 1024} MB`,
    )
  }
}

/** Prepara los datos validados para creación. */
async function prepararDatosCreacion(
  input: CrearMaterialInput,
  actor: ActorVirtual,
  docenteId: string,
  anioId: string,
): Promise<CrearMaterialData> {
  const extension = extraerExtension(input.archivoNombre)
  const archivoRuta = generarRutaAlmacenamiento(
    input.cursoId,
    input.seccionId,
    input.periodoId,
    extension,
  )

  return {
    cursoId: input.cursoId,
    seccionId: input.seccionId,
    periodoId: input.periodoId,
    anioId,
    docenteId,
    titulo: input.titulo,
    descripcion: input.descripcion ?? null,
    archivoNombre: input.archivoNombre,
    archivoMime: input.archivoMime,
    tamanoBytes: input.tamanoBytes,
    archivoRuta,
    createdBy: actor.id,
  }
}

/**
 * Valida que el docente indicado exista y esté vigente.
 *
 * @throws AppError `VALIDATION_ERROR` si no existe.
 */
async function resolverDocenteSolicitado(
  docenteId: string,
  prisma: PrismaClient,
): Promise<string> {
  const docente = await prisma.docente.findFirst({
    where: { id: docenteId, deletedAt: null },
    select: { id: true },
  })

  if (!docente) {
    throw new AppError('VALIDATION_ERROR', 'El docente indicado no existe.')
  }

  return docente.id
}

/** Prepara los datos validados para actualización. */
function prepararDatosActualizacion(
  input: ActualizarMaterialInput,
  actor: ActorVirtual,
  materialActual: Awaited<ReturnType<typeof findMaterialPorIdInterno>>,
  anioDestino?: string,
): ActualizarMaterialData {
  const data: ActualizarMaterialData = {
    id: materialActual!.id,
    updatedBy: actor.id,
  }

  if (input.cursoId !== undefined) {
    data.cursoId = input.cursoId
  }
  if (input.seccionId !== undefined) {
    data.seccionId = input.seccionId
  }
  if (input.periodoId !== undefined) {
    data.periodoId = input.periodoId
    data.anioId = anioDestino
  }
  if (input.docenteId !== undefined) {
    data.docenteId = input.docenteId
  }
  if (input.titulo !== undefined) {
    data.titulo = input.titulo
  }
  if (input.descripcion !== undefined) {
    data.descripcion = input.descripcion ?? null
  }
  if (input.archivoNombre !== undefined) {
    data.archivoNombre = input.archivoNombre
    // Si cambia el archivo, regenerar ruta
    const extension = extraerExtension(input.archivoNombre)
    data.archivoRuta = generarRutaAlmacenamiento(
      input.cursoId ?? materialActual!.cursoId,
      input.seccionId ?? materialActual!.seccionId,
      input.periodoId ?? materialActual!.periodoId,
      extension,
    )
  }
  if (input.archivoMime !== undefined) {
    data.archivoMime = input.archivoMime
  }
  if (input.tamanoBytes !== undefined) {
    data.tamanoBytes = input.tamanoBytes
  }

  return data
}

/**
 * Crea un material virtual (RF-VIR-001).
 *
 * Reglas:
 * - Solo docente con asignación vigente en curso/sección/año.
 * - Valida MIME y tamaño.
 * - Verifica duplicado (docente + curso + sección + período + título).
 * - Audita la creación.
 */
export async function crearMaterial(
  actor: ActorVirtual,
  input: CrearMaterialInput,
  contextoAuditoria: { ip?: string; userAgent?: string },
  prisma: PrismaClient = getPrisma(),
): Promise<MaterialResponsePayload> {
  // Validar permiso de gestión
  assertPermiso(actor, 'virtual.gestionar')

  // Validar archivo
  validarArchivo(input.archivoMime, input.tamanoBytes)

  // El período define el año académico de la asignación docente
  const periodo = await prisma.periodoAcademico.findUnique({
    where: { id: input.periodoId },
    select: { anioId: true },
  })

  if (!periodo) {
    throw new AppError('NOT_FOUND', 'El período no existe.')
  }

  const esAdmin = esAdministrativo(actor)
  const docentePropio = await resolverDocenteDelActor(actor, prisma)

  let docenteId: string

  if (esAdmin) {
    // Director/SuperAdmin pueden publicar a nombre de un docente.
    if (input.docenteId) {
      docenteId = await resolverDocenteSolicitado(input.docenteId, prisma)
    } else if (docentePropio) {
      docenteId = docentePropio
    } else {
      throw new AppError('VALIDATION_ERROR', 'Se requiere docenteId.')
    }
  } else {
    if (!docentePropio) {
      throw new AppError('FORBIDDEN', 'El usuario no tiene ficha de docente vigente.')
    }

    if (input.docenteId && input.docenteId !== docentePropio) {
      throw new AppError('FORBIDDEN', 'No puede crear material para otro docente.')
    }

    docenteId = docentePropio

    // Verificar asignación vigente (RN-VIR-001)
    await assertDocenteDeCursoSeccion(
      actor,
      input.cursoId,
      input.seccionId,
      periodo.anioId,
      prisma,
    )
  }

  // Verificar duplicado (RN-VIR-002)
  const duplicado = await existeDuplicado(
    prisma,
    docenteId,
    input.cursoId,
    input.seccionId,
    input.periodoId,
    input.titulo,
  )
  if (duplicado) {
    throw new AppError('CONFLICT', 'Ya existe un material con el mismo título en este curso, sección y período.')
  }

  // Preparar datos
  const datos = await prepararDatosCreacion(
    input,
    actor,
    docenteId,
    periodo.anioId,
  )

  // Crear en transacción con auditoría
  return prisma.$transaction(async (tx) => {
    const material = await createMaterial(tx, datos)

    await registrarAuditoria(tx, {
      usuarioId: actor.id,
      accion: 'CREAR',
      entidad: 'MaterialVirtual',
      entidadId: material.id,
      datos: {
        cursoId: input.cursoId,
        seccionId: input.seccionId,
        periodoId: input.periodoId,
        docenteId,
        titulo: input.titulo,
        descripcion: input.descripcion,
        archivoNombre: input.archivoNombre,
        archivoMime: input.archivoMime,
        tamanoBytes: input.tamanoBytes,
      },
      ip: contextoAuditoria.ip,
      userAgent: contextoAuditoria.userAgent,
    })

    return material
  })
}

/**
 * Actualiza un material virtual (RF-VIR-002).
 *
 * Reglas:
 * - Solo docente dueño o Director.
 * - Valida MIME y tamaño si se envía archivo.
 * - Verifica duplicado si cambia título/curso/sección/período/docente.
 * - Audita con valores anterior/nuevo.
 */
export async function actualizarMaterial(
  actor: ActorVirtual,
  id: string,
  input: ActualizarMaterialInput,
  contextoAuditoria: { ip?: string; userAgent?: string },
  prisma: PrismaClient = getPrisma(),
): Promise<MaterialResponsePayload> {
  // Validar permiso de gestión
  assertPermiso(actor, 'virtual.gestionar')

  // Buscar material actual
  const materialActual = await findMaterialPorIdInterno(prisma, id)
  if (!materialActual) {
    throw new AppError('NOT_FOUND', 'El material no existe.')
  }

  // Verificar autoría (docente dueño o Director/SuperAdmin)
  const esAdmin = esAdministrativo(actor)
  const docentePropio = await resolverDocenteDelActor(actor, prisma)
  const esOwner =
    docentePropio !== null && materialActual.docenteId === docentePropio

  if (!esOwner && !esAdmin) {
    throw new AppError('FORBIDDEN', 'Solo el docente dueño o un Director pueden editar este material.')
  }

  // Validar archivo si se envía
  if (input.archivoMime !== undefined && input.tamanoBytes !== undefined) {
    validarArchivo(input.archivoMime, input.tamanoBytes)
  }

  // Verificar duplicado si cambian campos de identidad
  const nuevoDocenteId = input.docenteId ?? materialActual.docenteId
  const nuevoCursoId = input.cursoId ?? materialActual.cursoId
  const nuevoSeccionId = input.seccionId ?? materialActual.seccionId
  const nuevoPeriodoId = input.periodoId ?? materialActual.periodoId
  const nuevoTitulo = input.titulo ?? materialActual.titulo

  let anioDestino: string | undefined

  if (
    nuevoDocenteId !== materialActual.docenteId ||
    nuevoCursoId !== materialActual.cursoId ||
    nuevoSeccionId !== materialActual.seccionId ||
    nuevoPeriodoId !== materialActual.periodoId ||
    nuevoTitulo !== materialActual.titulo
  ) {
    if (input.docenteId && input.docenteId !== materialActual.docenteId) {
      if (!esAdmin) {
        throw new AppError('FORBIDDEN', 'No puede reasignar el material a otro docente.')
      }

      await resolverDocenteSolicitado(input.docenteId, prisma)
    }

    if (input.periodoId && input.periodoId !== materialActual.periodoId) {
      const periodoDestino = await prisma.periodoAcademico.findUnique({
        where: { id: nuevoPeriodoId },
        select: { anioId: true },
      })

      if (!periodoDestino) {
        throw new AppError('NOT_FOUND', 'El período no existe.')
      }

      anioDestino = periodoDestino.anioId
    }

    // Si es docente, solo puede mover a sus asignaciones
    if (esOwner && !esAdmin) {
      const anioAsignacion =
        anioDestino ??
        (
          await prisma.periodoAcademico.findUnique({
            where: { id: materialActual.periodoId },
            select: { anioId: true },
          })
        )?.anioId

      if (!anioAsignacion) {
        throw new AppError('NOT_FOUND', 'El período del material no existe.')
      }

      await assertDocenteDeCursoSeccion(
        actor,
        nuevoCursoId,
        nuevoSeccionId,
        anioAsignacion,
        prisma,
      )
    }

    const duplicado = await existeDuplicado(
      prisma,
      nuevoDocenteId,
      nuevoCursoId,
      nuevoSeccionId,
      nuevoPeriodoId,
      nuevoTitulo,
      id,
    )
    if (duplicado) {
      throw new AppError('CONFLICT', 'Ya existe un material con el mismo título en este curso, sección y período.')
    }
  }

  // Preparar datos de actualización
  const datos = prepararDatosActualizacion(
    input,
    actor,
    materialActual,
    anioDestino,
  )

  // Actualizar en transacción con auditoría
  return prisma.$transaction(async (tx) => {
    const material = await updateMaterial(tx, datos)

    // Construir diff para auditoría
    const anterior = {
      titulo: materialActual.titulo,
      descripcion: materialActual.descripcion,
      archivoNombre: materialActual.archivoNombre,
      archivoMime: materialActual.archivoMime,
      tamanoBytes: materialActual.tamanoBytes,
    }
    const nuevo = { ...anterior }
    if (input.titulo !== undefined) nuevo.titulo = input.titulo
    if (input.descripcion !== undefined) nuevo.descripcion = input.descripcion ?? null
    if (input.archivoNombre !== undefined) nuevo.archivoNombre = input.archivoNombre
    if (input.archivoMime !== undefined) nuevo.archivoMime = input.archivoMime
    if (input.tamanoBytes !== undefined) nuevo.tamanoBytes = input.tamanoBytes

    await registrarAuditoria(tx, {
      usuarioId: actor.id,
      accion: 'ACTUALIZAR',
      entidad: 'MaterialVirtual',
      entidadId: id,
      datos: { anterior, nuevo },
      ip: contextoAuditoria.ip,
      userAgent: contextoAuditoria.userAgent,
    })

    return material
  })
}

/**
 * Elimina lógicamente un material (RF-VIR-003).
 *
 * Reglas:
 * - Solo docente dueño o Director/SuperAdmin.
 * - Setea deletedAt, conserva archivo físico.
 * - Audita la eliminación.
 */
export async function eliminarMaterial(
  actor: ActorVirtual,
  id: string,
  contextoAuditoria: { ip?: string; userAgent?: string },
  prisma: PrismaClient = getPrisma(),
): Promise<void> {
  // Validar permiso de eliminación (virtual.eliminar para DI/SA, virtual.gestionar para DO dueño)
  const tieneEliminar = hasPermission(actor.roles, 'virtual.eliminar')
  const tieneGestionar = hasPermission(actor.roles, 'virtual.gestionar')

  if (!tieneEliminar && !tieneGestionar) {
    throw new AppError('FORBIDDEN')
  }

  // Buscar material
  const materialActual = await findMaterialPorIdInterno(prisma, id)
  if (!materialActual) {
    throw new AppError('NOT_FOUND', 'El material no existe.')
  }

  // Verificar autoría
  const esAdmin = esAdministrativo(actor)
  const docentePropio = await resolverDocenteDelActor(actor, prisma)
  const esOwner =
    docentePropio !== null && materialActual.docenteId === docentePropio

  if (!esOwner && !esAdmin) {
    throw new AppError('FORBIDDEN', 'Solo el docente dueño o un Director pueden eliminar este material.')
  }

  // Si es docente dueño, debe tener permiso virtual.eliminar (se verifica arriba con tieneGestionar)
  // Director/SuperAdmin tienen virtual.eliminar

  // Eliminar en transacción con auditoría
  await prisma.$transaction(async (tx) => {
    await softDeleteMaterial(tx, id, actor.id)

    await registrarAuditoria(tx, {
      usuarioId: actor.id,
      accion: 'ELIMINAR',
      entidad: 'MaterialVirtual',
      entidadId: id,
      datos: {
        cursoId: materialActual.cursoId,
        seccionId: materialActual.seccionId,
        periodoId: materialActual.periodoId,
        docenteId: materialActual.docenteId,
        titulo: materialActual.titulo,
      },
      ip: contextoAuditoria.ip,
      userAgent: contextoAuditoria.userAgent,
    })
  })
}

/**
 * Lista materiales con alcance por vínculo (RF-VIR-004).
 *
 * Reglas:
 * - Director/SuperAdmin: todos los materiales del año/período.
 * - Docente: solo sus materiales (cursos/secciones asignados).
 * - Apoderado: materiales de secciones donde tiene alumnos vinculados.
 * - Alumno: materiales de su propia sección.
 * - Paginado, ordenado por fecha descendente.
 */
export async function listarMateriales(
  actor: ActorVirtual,
  anioId: string,
  query: ListarMaterialesQuery,
  prisma: PrismaClient = getPrisma(),
): Promise<PaginatedMaterialesPayload> {
  // Validar permiso de lectura
  assertPermiso(actor, 'virtual.leer')

  // Construir filtros
  const filtros: FiltrosMateriales = {
    cursoId: query.cursoId,
    seccionId: query.seccionId,
    periodoId: query.periodoId,
    docenteId: query.docenteId,
  }

  // Construir alcance
  const { where, auditarAcceso } = await construirAlcanceMateriales(
    actor,
    anioId,
    filtros,
    prisma,
  )

  // Si se debe auditar el acceso (SuperAdmin), registrar
  if (auditarAcceso) {
    await registrarAuditoria(prisma, {
      usuarioId: actor.id,
      accion: 'ACCEDER',
      entidad: 'MaterialVirtual',
      datos: {
        cursoId: filtros.cursoId ?? null,
        seccionId: filtros.seccionId ?? null,
        periodoId: filtros.periodoId ?? null,
        docenteId: filtros.docenteId ?? null,
        anioId,
      },
      ip: undefined,
      userAgent: undefined,
    })
  }

  // Paginación
  const paginacion = {
    page: query.page ?? 1,
    pageSize: query.pageSize ?? 20,
  }

  return findMateriales(prisma, where, paginacion)
}

/**
 * Obtiene el detalle de un material por ID (RF-VIR-003).
 *
 * Reglas:
 * - Requiere virtual.leer + vínculo con el material.
 * - Devuelve material con adjuntos.
 */
export async function obtenerMaterial(
  actor: ActorVirtual,
  id: string,
  anioId: string,
  prisma: PrismaClient = getPrisma(),
): Promise<MaterialResponsePayload> {
  // Validar permiso de lectura
  assertPermiso(actor, 'virtual.leer')

  // Verificar vínculo
  await assertVinculoMaterial(actor, id, anioId, prisma)

  const material = await findMaterialPorId(prisma, id, actor.institucionId)
  if (!material) {
    throw new AppError('NOT_FOUND', 'El material no existe.')
  }

  // Cargar adjuntos
  const adjuntos = await prisma.adjuntoVirtual.findMany({
    where: { materialId: id },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      materialId: true,
      nombreOriginal: true,
      nombreAlmacenado: true,
      tipoMime: true,
      tamanoBytes: true,
      createdAt: true,
    },
  })

  return {
    ...materialResponseSchema.parse({
      id: material.id,
      cursoId: material.cursoId,
      seccionId: material.seccionId,
      periodoId: material.periodoId,
      docenteId: material.docenteId,
      titulo: material.titulo,
      descripcion: material.descripcion,
      archivoNombre: material.archivoNombre,
      archivoMime: material.archivoMime,
      tamanoBytes: material.tamanoBytes,
      createdAt: material.createdAt.toISOString(),
      updatedAt: material.updatedAt.toISOString(),
      adjuntos: adjuntos.map((a) => ({
        id: a.id,
        materialId: a.materialId,
        nombreOriginal: a.nombreOriginal,
        url: `/api/v1/virtual/materiales/${id}/adjuntos/${a.id}/download`,
        tipoMime: a.tipoMime,
        tamanoBytes: a.tamanoBytes,
        createdAt: a.createdAt.toISOString(),
      })),
    }),
  }
}

/**
 * Prepara la descarga de un material (RF-VIR-005).
 *
 * Reglas:
 * - Requiere virtual.leer + vínculo.
 * - Audita el acceso.
 * - Devuelve ruta y metadatos para streaming.
 */
export async function prepararDescargaMaterial(
  actor: ActorVirtual,
  id: string,
  anioId: string,
  contextoAuditoria: { ip?: string; userAgent?: string },
  prisma: PrismaClient = getPrisma(),
): Promise<{ archivoRuta: string; archivoNombre: string; archivoMime: string; tamanoBytes: number }> {
  // Validar permiso de lectura
  assertPermiso(actor, 'virtual.leer')

  // Verificar vínculo
  await assertVinculoMaterial(actor, id, anioId, prisma)

  const material = await findMaterialPorId(prisma, id, actor.institucionId)
  if (!material) {
    throw new AppError('NOT_FOUND', 'El material no existe.')
  }

  // Auditar acceso
  await registrarAuditoria(prisma, {
    usuarioId: actor.id,
    accion: 'ACCEDER',
    entidad: 'MaterialVirtual',
    entidadId: id,
    datos: { tipo: 'descarga' },
    ip: contextoAuditoria.ip,
    userAgent: contextoAuditoria.userAgent,
  })

  return {
    archivoRuta: material.archivoRuta,
    archivoNombre: material.archivoNombre,
    archivoMime: material.archivoMime,
    tamanoBytes: material.tamanoBytes,
  }
}