import { z } from 'zod'
import { apiRequest } from '../../../shared/api/client'
import type {
  AlumnoOpcion,
  CatalogoOpcion,
  GradoOpcion,
  SeccionOpcion,
} from './MatriculaForm'

const metaSchema = z.object({
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
})

const alumnoCatalogoSchema = z.object({
  id: z.uuid(),
  codigoAlumno: z.string(),
  persona: z.object({
    nombres: z.string(),
    apellidos: z.string(),
  }),
})

const anioCatalogoSchema = z.object({
  id: z.uuid(),
  nombre: z.string(),
})

const nivelCatalogoSchema = z.object({
  id: z.uuid(),
  nombre: z.string(),
})

const gradoCatalogoSchema = z.object({
  id: z.uuid(),
  nivelId: z.uuid(),
  nombre: z.string(),
})

const seccionCatalogoSchema = z.object({
  id: z.uuid(),
  gradoId: z.uuid(),
  nombre: z.string(),
})

const paginatedAlumnosSchema = z.object({
  data: z.array(alumnoCatalogoSchema),
  meta: metaSchema,
})

const paginatedAniosSchema = z.object({
  data: z.array(anioCatalogoSchema),
  meta: metaSchema,
})

const paginatedNivelesSchema = z.object({
  data: z.array(nivelCatalogoSchema),
  meta: metaSchema,
})

const paginatedGradosSchema = z.object({
  data: z.array(gradoCatalogoSchema),
  meta: metaSchema,
})

const paginatedSeccionesSchema = z.object({
  data: z.array(seccionCatalogoSchema),
  meta: metaSchema,
})

/** Lista alumnos para el selector de matrícula (máximo 100). */
export async function listarAlumnosCatalogo(): Promise<AlumnoOpcion[]> {
  const respuesta = await apiRequest(
    '/alumnos?page=1&pageSize=100',
    paginatedAlumnosSchema,
  )

  return respuesta.data.map((alumno) => ({
    id: alumno.id,
    codigoAlumno: alumno.codigoAlumno,
    nombres: alumno.persona.nombres,
    apellidos: alumno.persona.apellidos,
  }))
}

/** Lista años académicos para los filtros. */
export async function listarAniosCatalogo(): Promise<CatalogoOpcion[]> {
  const respuesta = await apiRequest(
    '/anios-academicos?page=1&pageSize=100',
    paginatedAniosSchema,
  )

  return respuesta.data.map((anio) => ({ id: anio.id, nombre: anio.nombre }))
}

/** Lista niveles educativos para los filtros. */
export async function listarNivelesCatalogo(): Promise<CatalogoOpcion[]> {
  const respuesta = await apiRequest(
    '/niveles?page=1&pageSize=100',
    paginatedNivelesSchema,
  )

  return respuesta.data.map((nivel) => ({ id: nivel.id, nombre: nivel.nombre }))
}

/** Lista grados con su nivel padre para los filtros. */
export async function listarGradosCatalogo(): Promise<GradoOpcion[]> {
  const respuesta = await apiRequest(
    '/grados?page=1&pageSize=100',
    paginatedGradosSchema,
  )

  return respuesta.data.map((grado) => ({
    id: grado.id,
    nombre: grado.nombre,
    nivelId: grado.nivelId,
  }))
}

/** Lista secciones con su grado padre para los filtros. */
export async function listarSeccionesCatalogo(): Promise<SeccionOpcion[]> {
  const respuesta = await apiRequest(
    '/secciones?page=1&pageSize=100',
    paginatedSeccionesSchema,
  )

  return respuesta.data.map((seccion) => ({
    id: seccion.id,
    nombre: seccion.nombre,
    gradoId: seccion.gradoId,
  }))
}
