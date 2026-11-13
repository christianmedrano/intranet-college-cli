import { AppError } from '../../../core/errors.js'
import { registrarAuditoria, type AccionAuditoria } from '../../../core/audit.js'
import { getPrisma } from '../../../core/db.js'
import {
  findCertificados,
  findCertificadoPorId,
  findCertificadoPorNumero,
  createCertificado,
  updateCertificado,
  generarNumeroCertificado,
} from './certificado.repository.js'
import {
  findPlantillas,
  findPlantillaPorId,
  findPlantillaActivaPorTipo,
  createPlantilla,
  updatePlantilla,
  softDeletePlantilla,
} from './plantilla.repository.js'
import { plantillaCertificadoResponseSchema } from '@intranet/shared'
import {
  construirAlcanceCertificados,
  type ActorCertificados,
  type FiltrosCertificados,
  assertVinculoCertificado,
} from './certificado.scope.js'
import { hasPermission } from '../../../core/rbac.js'

const prisma = getPrisma()

/** Valida variables de plantilla contra el contenido. */
function validarVariables(contenido: string | null | undefined, variables: Record<string, string>): string[] {
  if (!contenido) return ['Contenido de plantilla vacío']
  const regex = /\{\{(\w+)\}\}/g
  const requeridas = new Set<string>()
  let match: RegExpExecArray | null
  const contenidoStr: string = contenido
  while ((match = regex.exec(contenidoStr)) !== null) {
    requeridas.add(match[1]!)
  }

  const faltantes: string[] = []
  for (const req of requeridas) {
    if (!(req in variables)) {
      faltantes.push(req)
    }
  }
  return faltantes
}

/** Genera HTML sustituyendo variables {{variable}} por sus valores. */
function renderizarPlantilla(contenido: string, variables: Record<string, string>): string {
  return contenido.replace(/\{\{(\w+)\}\}/g, (_match, key) => variables[key] ?? `{{${key}}}`)
}

/* ==================== PLANTILLAS ==================== */

/** Lista plantillas con filtros y paginación. */
export async function listarPlantillas(
  actor: ActorCertificados,
  filtros: { tipo?: string; activa?: boolean },
  paginacion: { page: number; pageSize: number },
) {
  if (!hasPermission(actor.roles, 'administrative.certificados.emitir')) {
    throw new AppError('FORBIDDEN')
  }

  const where: Record<string, unknown> = { deletedAt: null }
  if (filtros.tipo) where.tipo = filtros.tipo
  if (filtros.activa !== undefined) where.activa = filtros.activa

  const resultado = await findPlantillas(prisma, where, paginacion)

  await registrarAuditoria(prisma, {
    usuarioId: actor.id,
    accion: 'LEER_PLANTILLAS' as AccionAuditoria,
    entidad: 'PlantillaCertificado',
    datos: { filtros },
  })

  return resultado
}

/** Obtiene una plantilla por ID. */
export async function obtenerPlantilla(
  actor: ActorCertificados,
  id: string,
) {
  if (!hasPermission(actor.roles, 'administrative.certificados.emitir')) {
    throw new AppError('FORBIDDEN')
  }

  const plantilla = await findPlantillaPorId(prisma, id)
  if (!plantilla) {
    throw new AppError('NOT_FOUND', 'La plantilla no existe.')
  }

  await registrarAuditoria(prisma, {
    usuarioId: actor.id,
    accion: 'LEER_PLANTILLA' as AccionAuditoria,
    entidad: 'PlantillaCertificado',
    entidadId: id,
  })

  return plantilla
}

/** Crea una plantilla con versionado. */
export async function crearPlantilla(
  actor: ActorCertificados,
  datos: {
    tipo: string
    nombre: string
    contenido: string
    activa: boolean
  },
) {
  if (!hasPermission(actor.roles, 'administrative.certificados.emitir')) {
    throw new AppError('FORBIDDEN')
  }

  // Validar que el contenido tenga variables válidas
  const regex = /\{\{(\w+)\}\}/g
  const variables = new Set<string>()
  let match: RegExpExecArray | null
  // datos.contenido is guaranteed to be string per function signature
  const contenidoStr = datos.contenido
  while ((match = regex.exec(contenidoStr)) !== null) {
    variables.add(match[1]!)
  }
  if (variables.size === 0) {
    throw new AppError('VALIDATION_ERROR', 'La plantilla debe contener al menos una variable {{variable}}')
  }

  const plantilla = await prisma.$transaction(async (tx) => {
    const plantilla = await createPlantilla(tx, {
      tipo: datos.tipo,
      nombre: datos.nombre,
      contenido: datos.contenido,
      activa: datos.activa,
      createdBy: actor.id,
    })

    await registrarAuditoria(tx, {
      usuarioId: actor.id,
      accion: 'CREAR_PLANTILLA' as AccionAuditoria,
      entidad: 'PlantillaCertificado',
      entidadId: plantilla.id,
      datos: { tipo: datos.tipo, nombre: datos.nombre, version: plantilla.version },
    })

    return plantilla
  })

  return plantilla
}

/** Actualiza una plantilla (sin cambiar versión). */
export async function actualizarPlantilla(
  actor: ActorCertificados,
  id: string,
  datos: {
    nombre?: string
    contenido?: string
    activa?: boolean
  },
) {
  if (!hasPermission(actor.roles, 'administrative.certificados.emitir')) {
    throw new AppError('FORBIDDEN')
  }

  const plantillaExistente = await findPlantillaPorId(prisma, id)
  if (!plantillaExistente) {
    throw new AppError('NOT_FOUND', 'La plantilla no existe.')
  }

  if (datos.contenido) {
    const regex = /\{\{(\w+)\}\}/g
    const variables = new Set<string>()
    let match: RegExpExecArray | null
    // datos.contenido is guaranteed to be string inside this block
    const contenidoStr = datos.contenido as string
    while ((match = regex.exec(contenidoStr)) !== null) {
      variables.add(match[1]!)
    }
    if (variables.size === 0) {
      throw new AppError('VALIDATION_ERROR', 'La plantilla debe contener al menos una variable {{variable}}')
    }
  }

  const resultado = await prisma.$transaction(async (tx) => {
    const actualizada = await updatePlantilla(tx, {
      id,
      nombre: datos.nombre,
      contenido: datos.contenido,
      activa: datos.activa,
      updatedBy: actor.id,
    })

    await registrarAuditoria(tx, {
      usuarioId: actor.id,
      accion: 'ACTUALIZAR_PLANTILLA' as AccionAuditoria,
      entidad: 'PlantillaCertificado',
      entidadId: id,
      datos,
    })

    return actualizada
  })

  return resultado
}

/** Elimina una plantilla (solo si no tiene certificados). */
export async function eliminarPlantilla(
  actor: ActorCertificados,
  id: string,
) {
  if (!hasPermission(actor.roles, 'administrative.certificados.emitir')) {
    throw new AppError('FORBIDDEN')
  }

  await softDeletePlantilla(prisma, id, actor.id)

  await registrarAuditoria(prisma, {
    usuarioId: actor.id,
    accion: 'ELIMINAR_PLANTILLA' as AccionAuditoria,
    entidad: 'PlantillaCertificado',
    entidadId: id,
  })
}

/** Genera preview de plantilla con variables de prueba. */
export async function previewPlantilla(
  actor: ActorCertificados,
  id: string,
  variablesPrueba: Record<string, string>,
) {
  if (!hasPermission(actor.roles, 'administrative.certificados.emitir')) {
    throw new AppError('FORBIDDEN')
  }

  const plantilla = await findPlantillaPorId(prisma, id)
  if (!plantilla) {
    throw new AppError('NOT_FOUND', 'La plantilla no existe.')
  }

  const html = renderizarPlantilla(plantilla.contenido, variablesPrueba)
  const faltantes = validarVariables(plantilla.contenido, variablesPrueba)

  return {
    plantilla: plantillaCertificadoResponseSchema.parse({
      ...plantilla,
      contenido: html,
    }),
    variablesFaltantes: faltantes,
  }
}

/* ==================== CERTIFICADOS ==================== */

/** Lista certificados con alcance según el actor. */
export async function listarCertificados(
  actor: ActorCertificados,
  filtros: FiltrosCertificados,
  paginacion: { page: number; pageSize: number },
) {
  if (!hasPermission(actor.roles, 'administrative.certificados.emitir') &&
      !hasPermission(actor.roles, 'administrative.certificados.solicitar') &&
      !hasPermission(actor.roles, 'administrative.certificados.descargar')) {
    throw new AppError('FORBIDDEN')
  }

  const { where, auditarAcceso } = await construirAlcanceCertificados(actor, filtros, prisma)

  if (auditarAcceso) {
    await registrarAuditoria(prisma, {
      usuarioId: actor.id,
      accion: 'LEER_CERTIFICADOS' as AccionAuditoria,
      entidad: 'Certificado',
      datos: JSON.parse(JSON.stringify(filtros)),
    })
  }

  return findCertificados(prisma, where, paginacion)
}

/** Obtiene un certificado por ID con validación de vínculo. */
export async function obtenerCertificado(
  actor: ActorCertificados,
  id: string,
) {
  if (!hasPermission(actor.roles, 'administrative.certificados.emitir') &&
      !hasPermission(actor.roles, 'administrative.certificados.solicitar') &&
      !hasPermission(actor.roles, 'administrative.certificados.descargar')) {
    throw new AppError('FORBIDDEN')
  }

  await assertVinculoCertificado(actor, id, prisma)

  const fila = await findCertificadoPorId(prisma, id)
  if (!fila) {
    throw new AppError('NOT_FOUND', 'El certificado no existe.')
  }

  await registrarAuditoria(prisma, {
    usuarioId: actor.id,
    accion: 'LEER_CERTIFICADO' as AccionAuditoria,
    entidad: 'Certificado',
    entidadId: id,
  })

  return fila
}

/** Obtiene un certificado por número. */
export async function obtenerCertificadoPorNumero(
  actor: ActorCertificados,
  numero: string,
) {
  if (!hasPermission(actor.roles, 'administrative.certificados.emitir') &&
      !hasPermission(actor.roles, 'administrative.certificados.solicitar') &&
      !hasPermission(actor.roles, 'administrative.certificados.descargar')) {
    throw new AppError('FORBIDDEN')
  }

  const fila = await findCertificadoPorNumero(prisma, numero)
  if (!fila) {
    throw new AppError('NOT_FOUND', 'El certificado no existe.')
  }

  // Validar vínculo
  await assertVinculoCertificado(actor, fila.id, prisma)

  return fila
}

/** Emite un certificado directamente (director/administrador) - RF-ADM-011. */
export async function emitirCertificado(
  actor: ActorCertificados,
  datos: {
    tipo: string
    alumnoId: string
    anioId: string
    plantillaId?: string | null
    variables?: Record<string, string> | null
  },
) {
  if (!hasPermission(actor.roles, 'administrative.certificados.emitir')) {
    throw new AppError('FORBIDDEN')
  }

  // Validar alumno
  const alumno = await prisma.alumno.findUnique({
    where: { id: datos.alumnoId, deletedAt: null },
    select: { id: true },
  })
  if (!alumno) {
    throw new AppError('NOT_FOUND', 'El alumno no existe.')
  }

  // Validar año
  const anio = await prisma.anioAcademico.findUnique({
    where: { id: datos.anioId, deletedAt: null },
    select: { id: true, estado: true },
  })
  if (!anio) {
    throw new AppError('NOT_FOUND', 'El año académico no existe.')
  }

  // Resolver plantilla
  let plantillaId = datos.plantillaId
  if (!plantillaId) {
    const plantilla = await findPlantillaActivaPorTipo(prisma, datos.tipo)
    if (!plantilla) {
      throw new AppError('VALIDATION_ERROR', `No hay plantilla activa para tipo ${datos.tipo}`)
    }
    plantillaId = plantilla.id
  }

  const plantilla = await findPlantillaPorId(prisma, plantillaId)
  if (!plantilla) {
    throw new AppError('NOT_FOUND', 'La plantilla no existe.')
  }

  // Validar variables si se proporcionan
  if (datos.variables) {
    const faltantes = validarVariables(plantilla.contenido, datos.variables)
    if (faltantes.length > 0) {
      throw new AppError('VALIDATION_ERROR', `Faltan variables requeridas: ${faltantes.join(', ')}`)
    }
  }

  // Generar número correlativo (valida secuencia)
  await generarNumeroCertificado(prisma, datos.tipo, datos.anioId)

  const certificado = await prisma.$transaction(async (tx) => {
    const certificado = await createCertificado(tx, {
      tipo: datos.tipo,
      alumnoId: datos.alumnoId,
      anioId: datos.anioId,
      plantillaId,
      variables: datos.variables ?? {},
      estado: 'EMITIDO',
      solicitadoPorId: actor.id,
      solicitadoAt: new Date(),
      createdBy: actor.id,
    })

    await registrarAuditoria(tx, {
      usuarioId: actor.id,
      accion: 'EMITIR_CERTIFICADO' as AccionAuditoria,
      entidad: 'Certificado',
      entidadId: certificado.id,
      datos: { tipo: datos.tipo, alumnoId: datos.alumnoId, plantillaId, numero: certificado.numero },
    })

    return certificado
  })

  return certificado
}

/** Solicita un certificado (apoderado/alumno) - RF-ADM-012. */
export async function solicitarCertificado(
  actor: ActorCertificados,
  datos: {
    tipo: string
    alumnoId: string
    anioId: string
    plantillaId?: string | null
  },
) {
  if (!hasPermission(actor.roles, 'administrative.certificados.solicitar')) {
    throw new AppError('FORBIDDEN')
  }

  // Validar vínculo con el alumno
  if (actor.roles.includes('APODERADO')) {
    const vinculado = await prisma.apoderadoAlumno.findFirst({
      where: {
        alumnoId: datos.alumnoId,
        apoderado: {
          deletedAt: null,
          persona: {
            usuario: { id: actor.id, activo: true, deletedAt: null },
          },
        },
      },
      select: { apoderadoId: true, alumnoId: true },
    })
    if (!vinculado) {
      throw new AppError('FORBIDDEN', 'El apoderado no tiene vínculo con ese alumno.')
    }
  } else if (actor.roles.includes('ALUMNO')) {
    const alumno = await prisma.alumno.findFirst({
      where: {
        id: datos.alumnoId,
        deletedAt: null,
        persona: {
          usuario: { id: actor.id, activo: true, deletedAt: null },
        },
      },
      select: { id: true },
    })
    if (!alumno) {
      throw new AppError('FORBIDDEN', 'El alumno no coincide con el usuario autenticado.')
    }
  }

  // Validar alumno existe
  const alumno = await prisma.alumno.findUnique({
    where: { id: datos.alumnoId, deletedAt: null },
    select: { id: true },
  })
  if (!alumno) {
    throw new AppError('NOT_FOUND', 'El alumno no existe.')
  }

  // Validar año
  const anio = await prisma.anioAcademico.findUnique({
    where: { id: datos.anioId, deletedAt: null },
    select: { id: true, estado: true },
  })
  if (!anio) {
    throw new AppError('NOT_FOUND', 'El año académico no existe.')
  }

  // Resolver plantilla
  let plantillaId = datos.plantillaId
  if (!plantillaId) {
    const plantilla = await findPlantillaActivaPorTipo(prisma, datos.tipo)
    if (!plantilla) {
      throw new AppError('VALIDATION_ERROR', `No hay plantilla activa para tipo ${datos.tipo}`)
    }
    plantillaId = plantilla.id
  }

  const certificado = await prisma.$transaction(async (tx) => {
    const certificado = await createCertificado(tx, {
      tipo: datos.tipo,
      alumnoId: datos.alumnoId,
      anioId: datos.anioId,
      plantillaId,
      variables: {},
      estado: 'SOLICITADO',
      solicitadoPorId: actor.id,
      solicitadoAt: new Date(),
      createdBy: actor.id,
    })

    await registrarAuditoria(tx, {
      usuarioId: actor.id,
      accion: 'SOLICITAR_CERTIFICADO' as AccionAuditoria,
      entidad: 'Certificado',
      entidadId: certificado.id,
      datos: { tipo: datos.tipo, alumnoId: datos.alumnoId, plantillaId },
    })

    return certificado
  })

  return certificado
}

/** Aprobar certificado (director) - RF-ADM-013. */
export async function aprobarCertificado(
  actor: ActorCertificados,
  id: string,
  datos: {
    plantillaId?: string | null
    variables?: Record<string, string> | null
  },
) {
  if (!hasPermission(actor.roles, 'administrative.certificados.emitir')) {
    throw new AppError('FORBIDDEN')
  }

  await assertVinculoCertificado(actor, id, prisma)

  const certificado = await findCertificadoPorId(prisma, id)
  if (!certificado) {
    throw new AppError('NOT_FOUND', 'El certificado no existe.')
  }

  if (certificado.estado !== 'SOLICITADO' && certificado.estado !== 'BORRADOR') {
    throw new AppError('CONFLICT', 'Solo se pueden aprobar certificados en estado SOLICITADO o BORRADOR.')
  }

  // Resolver plantilla
  let plantillaId = certificado.plantillaId
  if (datos.plantillaId !== undefined) {
    plantillaId = datos.plantillaId
  }
  if (!plantillaId) {
    const plantilla = await findPlantillaActivaPorTipo(prisma, certificado.tipo)
    if (!plantilla) {
      throw new AppError('VALIDATION_ERROR', `No hay plantilla activa para tipo ${certificado.tipo}`)
    }
    plantillaId = plantilla.id
  }

  const plantilla = await findPlantillaPorId(prisma, plantillaId)
  if (!plantilla) {
    throw new AppError('NOT_FOUND', 'La plantilla no existe.')
  }

  // Combinar variables
  const variables = { ...(certificado.variables ?? {}), ...(datos.variables ?? {}) }
  const faltantes = validarVariables(plantilla.contenido, variables)
  if (faltantes.length > 0) {
    throw new AppError('VALIDATION_ERROR', `Faltan variables requeridas: ${faltantes.join(', ')}`)
  }

  // Generar número correlativo
  // Generar número correlativo
  const numero = await generarNumeroCertificado(prisma, certificado.tipo, certificado.anioId)

  // Renderizar HTML (para futuro uso en generación de PDF)
  renderizarPlantilla(plantilla.contenido, variables)

  const certificadoActualizado = await prisma.$transaction(async (tx) => {
    const actualizado = await updateCertificado(tx, {
      id,
      plantillaId,
      variables,
      estado: 'APROBADO',
      aprobadoPorId: actor.id,
      aprobadoAt: new Date(),
      pdfRuta: undefined,
      updatedBy: actor.id,
    })

    await registrarAuditoria(tx, {
      usuarioId: actor.id,
      accion: 'APROBAR_CERTIFICADO' as AccionAuditoria,
      entidad: 'Certificado',
      entidadId: id,
      datos: { estadoAnterior: certificado.estado, estado: 'APROBADO', plantillaId, numero },
    })

    return actualizado
  })

  return certificadoActualizado
}

/** Rechazar certificado - RF-ADM-013. */
export async function rechazarCertificado(
  actor: ActorCertificados,
  id: string,
  motivo: string,
) {
  if (!hasPermission(actor.roles, 'administrative.certificados.emitir')) {
    throw new AppError('FORBIDDEN')
  }

  await assertVinculoCertificado(actor, id, prisma)

  const certificado = await findCertificadoPorId(prisma, id)
  if (!certificado) {
    throw new AppError('NOT_FOUND', 'El certificado no existe.')
  }

  if (certificado.estado !== 'SOLICITADO' && certificado.estado !== 'BORRADOR') {
    throw new AppError('CONFLICT', 'Solo se pueden rechazar certificados en estado SOLICITADO o BORRADOR.')
  }

  if (motivo.trim().length === 0) {
    throw new AppError('VALIDATION_ERROR', 'El motivo de rechazo es obligatorio.')
  }
  if (motivo.length > 500) {
    throw new AppError('VALIDATION_ERROR', 'El motivo es demasiado largo (máx. 500 caracteres).')
  }

  const resultado = await prisma.$transaction(async (tx) => {
    const actualizado = await updateCertificado(tx, {
      id,
      estado: 'RECHAZADO',
      rechazadoMotivo: motivo,
      updatedBy: actor.id,
    })

    await registrarAuditoria(tx, {
      usuarioId: actor.id,
      accion: 'RECHAZAR_CERTIFICADO' as AccionAuditoria,
      entidad: 'Certificado',
      entidadId: id,
      datos: { estadoAnterior: certificado.estado, estado: 'RECHAZADO', motivo },
    })

    return actualizado
  })

  return resultado
}

/** Anular certificado. */
export async function anularCertificado(
  actor: ActorCertificados,
  id: string,
  motivo: string,
) {
  if (!hasPermission(actor.roles, 'administrative.certificados.emitir')) {
    throw new AppError('FORBIDDEN')
  }

  await assertVinculoCertificado(actor, id, prisma)

  const certificado = await findCertificadoPorId(prisma, id)
  if (!certificado) {
    throw new AppError('NOT_FOUND', 'El certificado no existe.')
  }

  if (certificado.estado === 'ANULADO') {
    throw new AppError('CONFLICT', 'El certificado ya está anulado.')
  }

  if (motivo.trim().length === 0) {
    throw new AppError('VALIDATION_ERROR', 'El motivo de anulación es obligatorio.')
  }
  if (motivo.length > 500) {
    throw new AppError('VALIDATION_ERROR', 'El motivo es demasiado largo (máx. 500 caracteres).')
  }

  const resultado = await prisma.$transaction(async (tx) => {
    const actualizado = await updateCertificado(tx, {
      id,
      estado: 'ANULADO',
      rechazadoMotivo: motivo,
      updatedBy: actor.id,
    })

    await registrarAuditoria(tx, {
      usuarioId: actor.id,
      accion: 'ANULAR_CERTIFICADO' as AccionAuditoria,
      entidad: 'Certificado',
      entidadId: id,
      datos: { estadoAnterior: certificado.estado, estado: 'ANULADO', motivo },
    })

    return actualizado
  })

  return resultado
}

/** Descargar certificado (genera/retorna PDF) - RF-ADM-013. */
export async function descargarCertificado(
  actor: ActorCertificados,
  id: string,
) {
  if (!hasPermission(actor.roles, 'administrative.certificados.descargar')) {
    throw new AppError('FORBIDDEN')
  }

  await assertVinculoCertificado(actor, id, prisma)

  const certificado = await findCertificadoPorId(prisma, id)
  if (!certificado) {
    throw new AppError('NOT_FOUND', 'El certificado no existe.')
  }

  if (certificado.estado !== 'EMITIDO' && certificado.estado !== 'APROBADO') {
    throw new AppError('CONFLICT', 'Solo se pueden descargar certificados emitidos o aprobados.')
  }

  await registrarAuditoria(prisma, {
    usuarioId: actor.id,
    accion: 'DESCARGAR_CERTIFICADO' as AccionAuditoria,
    entidad: 'Certificado',
    entidadId: id,
  })

  // Aquí se generaría el PDF real y se retornaría la ruta
  // Por ahora retornamos la info del certificado para que el controller maneje la respuesta
  return certificado
}