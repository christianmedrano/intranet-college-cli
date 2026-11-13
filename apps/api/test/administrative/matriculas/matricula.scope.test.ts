import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { AppError } from '../../../src/core/errors.js'
import {
  assertPermiso,
  assertVinculoMatricula,
  construirAlcanceMatriculas,
  esAdministrativo,
  type ActorMatriculas,
} from '../../../src/modules/administrative/matriculas/matricula.scope.js'
import { createTestPrisma, limpiarBaseDePruebas } from '../../helpers/test-db.js'
import { INSTITUCION_ID } from '../../constants.js'
import {
  crearAlumno,
  crearAlumnoConUsuario,
  crearApoderadoConUsuario,
  crearEstructura,
  tokenDe,
} from '../helpers.js'

describe.skipIf(!process.env.TEST_DATABASE_URL)('matricula.scope', () => {
  let prisma: ReturnType<typeof createTestPrisma>

  beforeAll(() => {
    prisma = createTestPrisma()
  })

  beforeEach(async () => {
    await limpiarBaseDePruebas(prisma)
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  function actor(id: string, roles: ActorMatriculas['roles']): ActorMatriculas {
    return { id, roles, institucionId: INSTITUCION_ID }
  }

  it('assertPermiso respeta la matriz de matrículas', async () => {
    const { usuario: director } = await tokenDe(prisma, ['DIRECTOR'])
    const { usuario: apoderado } = await tokenDe(prisma, ['APODERADO'])
    const { usuario: docente } = await tokenDe(prisma, ['DOCENTE'])

    expect(() =>
      assertPermiso(
        actor(director.id, ['DIRECTOR']),
        'administrative.matriculas.gestionar',
      ),
    ).not.toThrow()
    expect(() =>
      assertPermiso(
        actor(apoderado.id, ['APODERADO']),
        'administrative.matriculas.gestionar',
      ),
    ).not.toThrow()
    expect(() =>
      assertPermiso(
        actor(docente.id, ['DOCENTE']),
        'administrative.matriculas.leer',
      ),
    ).toThrowError(AppError)
  })

  it('esAdministrativo reconoce solo a Director y SuperAdmin', async () => {
    const { usuario: director } = await tokenDe(prisma, ['DIRECTOR'])
    const { usuario: superAdmin } = await tokenDe(prisma, ['SUPER_ADMIN'])
    const { usuario: alumno } = await tokenDe(prisma, ['ALUMNO'])

    expect(esAdministrativo(actor(director.id, ['DIRECTOR']))).toBe(true)
    expect(esAdministrativo(actor(superAdmin.id, ['SUPER_ADMIN']))).toBe(true)
    expect(esAdministrativo(actor(alumno.id, ['ALUMNO']))).toBe(false)
  })

  it('el Director ve todas las matrículas vigentes', async () => {
    const { usuario } = await tokenDe(prisma, ['DIRECTOR'])
    const { where, auditarAcceso } = await construirAlcanceMatriculas(
      actor(usuario.id, ['DIRECTOR']),
      {},
      prisma,
    )

    expect(where.deletedAt).toBeNull()
    expect(where.AND).toBeUndefined()
    expect(auditarAcceso).toBe(false)
  })

  it('el SuperAdmin audita el acceso', async () => {
    const { usuario } = await tokenDe(prisma, ['SUPER_ADMIN'])
    const { auditarAcceso } = await construirAlcanceMatriculas(
      actor(usuario.id, ['SUPER_ADMIN']),
      {},
      prisma,
    )

    expect(auditarAcceso).toBe(true)
  })

  it('el Apoderado solo ve matrículas vigentes de sus alumnos', async () => {
    const alumno = await crearAlumno(prisma)
    const { usuario } = await crearApoderadoConUsuario(prisma, alumno.id)
    const ajeno = await crearAlumno(prisma)

    const propio = await construirAlcanceMatriculas(
      actor(usuario.id, ['APODERADO']),
      { alumnoId: alumno.id },
      prisma,
    )
    expect(propio.where.AND).toBeDefined()

    await expect(
      construirAlcanceMatriculas(
        actor(usuario.id, ['APODERADO']),
        { alumnoId: ajeno.id },
        prisma,
      ),
    ).rejects.toThrowError(AppError)
  })

  it('el Alumno solo ve sus propias matrículas', async () => {
    const { alumno, usuario } = await crearAlumnoConUsuario(prisma)
    const ajeno = await crearAlumno(prisma)

    await expect(
      construirAlcanceMatriculas(
        actor(usuario.id, ['ALUMNO']),
        { alumnoId: alumno.id },
        prisma,
      ),
    ).resolves.toBeDefined()

    await expect(
      construirAlcanceMatriculas(
        actor(usuario.id, ['ALUMNO']),
        { alumnoId: ajeno.id },
        prisma,
      ),
    ).rejects.toThrowError(AppError)
  })

  it('un rol sin alcance recibe FORBIDDEN', async () => {
    const { usuario } = await tokenDe(prisma, ['DOCENTE'])

    await expect(
      construirAlcanceMatriculas(actor(usuario.id, ['DOCENTE']), {}, prisma),
    ).rejects.toThrowError(AppError)
  })

  it('assertVinculoMatricula permite al administrativo sin consultar la base', async () => {
    const { usuario } = await tokenDe(prisma, ['DIRECTOR'])

    await expect(
      assertVinculoMatricula(
        actor(usuario.id, ['DIRECTOR']),
        'inexistente',
        prisma,
      ),
    ).resolves.toBeUndefined()
  })

  it('assertVinculoMatricula valida el vínculo y el 404', async () => {
    const { anio, seccion } = await crearEstructura(prisma)
    const alumno = await crearAlumno(prisma)
    const { usuario: apoderado } = await crearApoderadoConUsuario(prisma, alumno.id)
    const ajeno = await crearAlumno(prisma)

    const matricula = await prisma.matricula.create({
      data: {
        alumnoId: alumno.id,
        seccionId: seccion.id,
        anioId: anio.id,
        estado: 'SOLICITADA',
      },
    })
    const matriculaAjena = await prisma.matricula.create({
      data: {
        alumnoId: ajeno.id,
        seccionId: seccion.id,
        anioId: anio.id,
        estado: 'SOLICITADA',
      },
    })

    await expect(
      assertVinculoMatricula(
        actor(apoderado.id, ['APODERADO']),
        matricula.id,
        prisma,
      ),
    ).resolves.toBeUndefined()

    await expect(
      assertVinculoMatricula(
        actor(apoderado.id, ['APODERADO']),
        matriculaAjena.id,
        prisma,
      ),
    ).rejects.toThrowError(AppError)

    await expect(
      assertVinculoMatricula(
        actor(apoderado.id, ['APODERADO']),
        '00000000-0000-4000-8000-000000000099',
        prisma,
      ),
    ).rejects.toThrowError(AppError)
  })
})
