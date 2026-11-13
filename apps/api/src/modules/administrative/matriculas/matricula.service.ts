import { AppError } from '../../../core/errors.js'
import { registrarAuditoria, type AccionAuditoria } from '../../../core/audit.js'
import { getPrisma } from '../../../core/db.js'
import {
  findMatriculasAdmin,
  findMatriculaPorIdAdmin,
  createMatriculaAdmin,
  updateEstadoMatriculaAdmin,
  assertAlumnoExiste,
  assertSeccionValida,
  assertAnioActivo,
  countMatriculasAprobadasEnSeccion,
  countApoderadosPrincipales,
} from './matricula.repository.js'
import { construirAlcanceMatriculas, type ActorMatriculas, type FiltrosMatriculasAdmin, assertVinculoMatricula } from './matricula.scope.js'
import { hasPermission } from '../../../core/rbac.js'

const prisma = getPrisma()

/** Crea una matrícula SOLICITADA (RF-ADM-005). */
export async function solicitarMatricula(
  actor: ActorMatriculas,
  datos: {
    alumnoId: string
    seccionId: string
    anioId: string
    documentos?: Array<{ tipo: string; archivoNombre: string; archivoRuta: string }>
  },
) {
  // Validar permisos
  if (!hasPermission(actor.roles, 'administrative.matriculas.gestionar')) {
    throw new AppError('FORBIDDEN')
  }

  // Validar alumno
  const alumnoExiste = await assertAlumnoExiste(prisma, datos.alumnoId)
  if (!alumnoExiste) {
    throw new AppError('NOT_FOUND', 'El alumno no existe o está eliminado.')
  }

  // Validar apoderado principal (RN-ADM-005)
  const principales = await countApoderadosPrincipales(prisma, datos.alumnoId)
  if (principales !== 1) {
    throw new AppError('VALIDATION_ERROR', 'El alumno debe tener exactamente un apoderado principal para solicitar matrícula.')
  }

  // Validar sección y año
  const seccion = await assertSeccionValida(prisma, datos.seccionId, datos.anioId)
  if (!seccion) {
    throw new AppError('NOT_FOUND', 'La sección no existe o no pertenece al año indicado.')
  }

  const anio = await assertAnioActivo(prisma, datos.anioId)
  if (!anio) {
    throw new AppError('VALIDATION_ERROR', 'El año académico no está activo.')
  }

  // Validar capacidad (RN-ADM-006)
  if (seccion.capacidad !== null && seccion.capacidad > 0) {
    const aprobadas = await countMatriculasAprobadasEnSeccion(prisma, datos.seccionId)
    if (aprobadas >= seccion.capacidad) {
      throw new AppError('CONFLICT', 'La sección ha alcanzado su capacidad máxima.')
    }
  }

  // Crear matrícula en transacción
  return prisma.$transaction(async (tx) => {
    const matricula = await createMatriculaAdmin(tx, {
      alumnoId: datos.alumnoId,
      seccionId: datos.seccionId,
      anioId: datos.anioId,
      documentos: datos.documentos,
      createdBy: actor.id,
    })

    await registrarAuditoria(tx, {
      usuarioId: actor.id,
      accion: 'CREAR_MATRICULA' as AccionAuditoria,
      entidad: 'MATRICULA',
      entidadId: matricula.id,
      datos: {
        alumnoId: datos.alumnoId,
        seccionId: datos.seccionId,
        anioId: datos.anioId,
      },
    })

    return matricula
  })
}

/** Lista matrículas con alcance según el actor. */
export async function listarMatriculasAdmin(
  actor: ActorMatriculas,
  filtros: FiltrosMatriculasAdmin,
  paginacion: { page: number; pageSize: number },
) {
  if (!hasPermission(actor.roles, 'administrative.matriculas.leer')) {
    throw new AppError('FORBIDDEN')
  }

  const { where, auditarAcceso } = await construirAlcanceMatriculas(actor, filtros, prisma)

  if (auditarAcceso) {
    await registrarAuditoria(prisma, {
      usuarioId: actor.id,
      accion: 'LEER_MATRICULAS' as AccionAuditoria,
      entidad: 'MATRICULA',
      datos: JSON.parse(JSON.stringify(filtros)),
    })
  }

  return findMatriculasAdmin(prisma, where, paginacion)
}

/** Obtiene una matrícula por ID con validación de vínculo. */
export async function obtenerMatriculaAdmin(
  actor: ActorMatriculas,
  id: string,
) {
  if (!hasPermission(actor.roles, 'administrative.matriculas.leer')) {
    throw new AppError('FORBIDDEN')
  }

  await assertVinculoMatricula(actor, id, prisma)

  const matricula = await findMatriculaPorIdAdmin(prisma, id)
  if (!matricula) {
    throw new AppError('NOT_FOUND', 'La matrícula no existe.')
  }

  return matricula
}

/** Aprueba una matrícula (RF-ADM-006). */
export async function aprobarMatriculaAdmin(
  actor: ActorMatriculas,
  id: string,
  observaciones?: string,
) {
  if (!hasPermission(actor.roles, 'administrative.matriculas.gestionar')) {
    throw new AppError('FORBIDDEN')
  }

  await assertVinculoMatricula(actor, id, prisma)

  const matricula = await findMatriculaPorIdAdmin(prisma, id)
  if (!matricula) {
    throw new AppError('NOT_FOUND', 'La matrícula no existe.')
  }

  if (matricula.estado !== 'SOLICITADA') {
    throw new AppError('CONFLICT', 'Solo se pueden aprobar matrículas en estado SOLICITADA.')
  }

  // Validar apoderado principal
  const principales = await countApoderadosPrincipales(prisma, matricula.alumnoId)
  if (principales !== 1) {
    throw new AppError('CONFLICT', 'El alumno debe tener exactamente un apoderado principal para aprobar la matrícula.')
  }

  // Validar capacidad
  if (matricula.seccion.capacidad !== null && matricula.seccion.capacidad > 0) {
    const aprobadas = await countMatriculasAprobadasEnSeccion(prisma, matricula.seccionId)
    if (aprobadas >= matricula.seccion.capacidad) {
      throw new AppError('CONFLICT', 'La sección ha alcanzado su capacidad máxima.')
    }
  }

  const estadoAnterior = matricula.estado
  const resultado = await prisma.$transaction(async (tx) => {
    const actualizada = await updateEstadoMatriculaAdmin(tx, {
      id,
      estado: 'APROBADA',
      observaciones,
      updatedBy: actor.id,
    })

    await registrarAuditoria(tx, {
      usuarioId: actor.id,
      accion: 'APROBAR_MATRICULA' as AccionAuditoria,
      entidad: 'MATRICULA',
      entidadId: id,
      datos: { estadoAnterior, estado: 'APROBADA', observaciones },
    })

    return actualizada
  })

  return resultado
}

/** Rechaza una matrícula (RF-ADM-007). */
export async function rechazarMatriculaAdmin(
  actor: ActorMatriculas,
  id: string,
  motivo: string,
) {
  if (!hasPermission(actor.roles, 'administrative.matriculas.gestionar')) {
    throw new AppError('FORBIDDEN')
  }

  await assertVinculoMatricula(actor, id, prisma)

  const matricula = await findMatriculaPorIdAdmin(prisma, id)
  if (!matricula) {
    throw new AppError('NOT_FOUND', 'La matrícula no existe.')
  }

  if (matricula.estado !== 'SOLICITADA') {
    throw new AppError('CONFLICT', 'Solo se pueden rechazar matrículas en estado SOLICITADA.')
  }

  if (motivo.trim().length === 0) {
    throw new AppError('VALIDATION_ERROR', 'El motivo de rechazo es obligatorio.')
  }
  if (motivo.length > 500) {
    throw new AppError('VALIDATION_ERROR', 'El motivo es demasiado largo (máx. 500 caracteres).')
  }

  const estadoAnterior = matricula.estado
  const resultado = await prisma.$transaction(async (tx) => {
    const actualizada = await updateEstadoMatriculaAdmin(tx, {
      id,
      estado: 'RECHAZADA',
      observaciones: motivo,
      updatedBy: actor.id,
    })

    await registrarAuditoria(tx, {
      usuarioId: actor.id,
      accion: 'RECHAZAR_MATRICULA' as AccionAuditoria,
      entidad: 'MATRICULA',
      entidadId: id,
      datos: { estadoAnterior, estado: 'RECHAZADA', motivo },
    })

    return actualizada
  })

  return resultado
}

/** Retira una matrícula aprobada (RF-ADM-008, RN-ADM-009). */
export async function retirarMatriculaAdmin(
  actor: ActorMatriculas,
  id: string,
  motivo: string,
) {
  if (!hasPermission(actor.roles, 'administrative.matriculas.gestionar')) {
    throw new AppError('FORBIDDEN')
  }

  await assertVinculoMatricula(actor, id, prisma)

  const matricula = await findMatriculaPorIdAdmin(prisma, id)
  if (!matricula) {
    throw new AppError('NOT_FOUND', 'La matrícula no existe.')
  }

  if (matricula.estado !== 'APROBADA') {
    throw new AppError('CONFLICT', 'Solo se pueden retirar matrículas en estado APROBADA.')
  }

  if (motivo.trim().length === 0) {
    throw new AppError('VALIDATION_ERROR', 'El motivo de retiro es obligatorio.')
  }
  if (motivo.length > 500) {
    throw new AppError('VALIDATION_ERROR', 'El motivo es demasiado largo (máx. 500 caracteres).')
  }

  const estadoAnterior = matricula.estado
  const resultado = await prisma.$transaction(async (tx) => {
    const actualizada = await updateEstadoMatriculaAdmin(tx, {
      id,
      estado: 'RETIRADA',
      motivoRetiro: motivo,
      updatedBy: actor.id,
    })

    await registrarAuditoria(tx, {
      usuarioId: actor.id,
      accion: 'RETIRAR_MATRICULA' as AccionAuditoria,
      entidad: 'MATRICULA',
      entidadId: id,
      datos: { estadoAnterior, estado: 'RETIRADA', motivo },
    })

    return actualizada
  })

  return resultado
}

/** Anula una matrícula (RF-ADM-009, RN-ADM-010). */
export async function anularMatriculaAdmin(
  actor: ActorMatriculas,
  id: string,
  motivo: string,
) {
  if (!hasPermission(actor.roles, 'administrative.matriculas.gestionar')) {
    throw new AppError('FORBIDDEN')
  }

  await assertVinculoMatricula(actor, id, prisma)

  const matricula = await findMatriculaPorIdAdmin(prisma, id)
  if (!matricula) {
    throw new AppError('NOT_FOUND', 'La matrícula no existe.')
  }

  if (matricula.estado === 'ANULADA') {
    throw new AppError('CONFLICT', 'La matrícula ya está anulada.')
  }

  if (motivo.trim().length === 0) {
    throw new AppError('VALIDATION_ERROR', 'El motivo de anulación es obligatorio.')
  }
  if (motivo.length > 500) {
    throw new AppError('VALIDATION_ERROR', 'El motivo es demasiado largo (máx. 500 caracteres).')
  }

  const estadoAnterior = matricula.estado
  const resultado = await prisma.$transaction(async (tx) => {
    const actualizada = await updateEstadoMatriculaAdmin(tx, {
      id,
      estado: 'ANULADA',
      observaciones: motivo,
      updatedBy: actor.id,
    })

    await registrarAuditoria(tx, {
      usuarioId: actor.id,
      accion: 'ANULAR_MATRICULA' as AccionAuditoria,
      entidad: 'MATRICULA',
      entidadId: id,
      datos: { estadoAnterior, estado: 'ANULADA', motivo },
    })

    return actualizada
  })

  return resultado
}