import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { AppError } from '../../../src/core/errors.js'
import {
  assertPermiso,
  assertVinculoCertificado,
  construirAlcanceCertificados,
  esAdministrativo,
  type ActorCertificados,
} from '../../../src/modules/administrative/certificados/certificado.scope.js'
import { createTestPrisma, limpiarBaseDePruebas } from '../../helpers/test-db.js'
import { INSTITUCION_ID } from '../../constants.js'
import {
  crearAlumno,
  crearAlumnoConUsuario,
  crearApoderadoConUsuario,
  crearEstructura,
  tokenDe,
} from '../helpers.js'

describe.skipIf(!process.env.TEST_DATABASE_URL)('certificado.scope', () => {
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

  function actor(id: string, roles: ActorCertificados['roles']): ActorCertificados {
    return { id, roles, institucionId: INSTITUCION_ID }
  }

  it('assertPermiso respeta la matriz de certificados', async () => {
    const { usuario: director } = await tokenDe(prisma, ['DIRECTOR'])
    const { usuario: apoderado } = await tokenDe(prisma, ['APODERADO'])
    const { usuario: alumno } = await tokenDe(prisma, ['ALUMNO'])
    const { usuario: docente } = await tokenDe(prisma, ['DOCENTE'])

    expect(() =>
      assertPermiso(actor(director.id, ['DIRECTOR']), 'administrative.certificados.emitir'),
    ).not.toThrow()
    expect(() =>
      assertPermiso(actor(apoderado.id, ['APODERADO']), 'administrative.certificados.solicitar'),
    ).not.toThrow()
    expect(() =>
      assertPermiso(actor(alumno.id, ['ALUMNO']), 'administrative.certificados.descargar'),
    ).not.toThrow()
    expect(() =>
      assertPermiso(actor(docente.id, ['DOCENTE']), 'administrative.certificados.emitir'),
    ).toThrowError(AppError)
  })

  it('esAdministrativo reconoce solo a Director y SuperAdmin', async () => {
    const { usuario: director } = await tokenDe(prisma, ['DIRECTOR'])
    const { usuario: superAdmin } = await tokenDe(prisma, ['SUPER_ADMIN'])
    const { usuario: apoderado } = await tokenDe(prisma, ['APODERADO'])

    expect(esAdministrativo(actor(director.id, ['DIRECTOR']))).toBe(true)
    expect(esAdministrativo(actor(superAdmin.id, ['SUPER_ADMIN']))).toBe(true)
    expect(esAdministrativo(actor(apoderado.id, ['APODERADO']))).toBe(false)
  })

  it('el Director ve todos los certificados', async () => {
    const { usuario } = await tokenDe(prisma, ['DIRECTOR'])
    const { where, auditarAcceso } = await construirAlcanceCertificados(
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
    const { auditarAcceso } = await construirAlcanceCertificados(
      actor(usuario.id, ['SUPER_ADMIN']),
      {},
      prisma,
    )

    expect(auditarAcceso).toBe(true)
  })

  it('el Apoderado solo ve certificados de sus alumnos', async () => {
    const alumno = await crearAlumno(prisma)
    const { usuario } = await crearApoderadoConUsuario(prisma, alumno.id)
    const ajeno = await crearAlumno(prisma)

    const propio = await construirAlcanceCertificados(
      actor(usuario.id, ['APODERADO']),
      { alumnoId: alumno.id },
      prisma,
    )
    expect(propio.where.AND).toBeDefined()

    await expect(
      construirAlcanceCertificados(
        actor(usuario.id, ['APODERADO']),
        { alumnoId: ajeno.id },
        prisma,
      ),
    ).rejects.toThrowError(AppError)
  })

  it('el Alumno solo ve sus propios certificados', async () => {
    const { alumno, usuario } = await crearAlumnoConUsuario(prisma)
    const ajeno = await crearAlumno(prisma)

    await expect(
      construirAlcanceCertificados(
        actor(usuario.id, ['ALUMNO']),
        { alumnoId: alumno.id },
        prisma,
      ),
    ).resolves.toBeDefined()

    await expect(
      construirAlcanceCertificados(
        actor(usuario.id, ['ALUMNO']),
        { alumnoId: ajeno.id },
        prisma,
      ),
    ).rejects.toThrowError(AppError)
  })

  it('un rol sin alcance recibe FORBIDDEN', async () => {
    const { usuario } = await tokenDe(prisma, ['DOCENTE'])

    await expect(
      construirAlcanceCertificados(actor(usuario.id, ['DOCENTE']), {}, prisma),
    ).rejects.toThrowError(AppError)
  })

  it('assertVinculoCertificado permite al administrativo sin consultar la base', async () => {
    const { usuario } = await tokenDe(prisma, ['DIRECTOR'])

    await expect(
      assertVinculoCertificado(
        actor(usuario.id, ['DIRECTOR']),
        'inexistente',
        prisma,
      ),
    ).resolves.toBeUndefined()
  })

  it('assertVinculoCertificado valida el vínculo y el 404', async () => {
    const { anio } = await crearEstructura(prisma)
    const alumno = await crearAlumno(prisma)
    const { usuario: apoderado } = await crearApoderadoConUsuario(prisma, alumno.id)
    const ajeno = await crearAlumno(prisma)

    const certificado = await prisma.certificado.create({
      data: {
        tipo: 'ESTUDIOS',
        numero: 'CERT-TEST-0001',
        alumnoId: alumno.id,
        anioId: anio.id,
        estado: 'SOLICITADO',
      },
    })
    const certificadoAjeno = await prisma.certificado.create({
      data: {
        tipo: 'ESTUDIOS',
        numero: 'CERT-TEST-0002',
        alumnoId: ajeno.id,
        anioId: anio.id,
        estado: 'SOLICITADO',
      },
    })

    await expect(
      assertVinculoCertificado(
        actor(apoderado.id, ['APODERADO']),
        certificado.id,
        prisma,
      ),
    ).resolves.toBeUndefined()

    await expect(
      assertVinculoCertificado(
        actor(apoderado.id, ['APODERADO']),
        certificadoAjeno.id,
        prisma,
      ),
    ).rejects.toThrowError(AppError)

    await expect(
      assertVinculoCertificado(
        actor(apoderado.id, ['APODERADO']),
        '00000000-0000-4000-8000-000000000099',
        prisma,
      ),
    ).rejects.toThrowError(AppError)
  })
})