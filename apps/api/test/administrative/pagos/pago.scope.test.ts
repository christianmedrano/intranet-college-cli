import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { AppError } from '../../../src/core/errors.js'
import {
  assertPermiso,
  assertVinculoPago,
  construirAlcancePagos,
  esAdministrativo,
  type ActorPagos,
} from '../../../src/modules/administrative/pagos/pago.scope.js'
import { createTestPrisma, limpiarBaseDePruebas } from '../../helpers/test-db.js'
import { INSTITUCION_ID } from '../../constants.js'
import {
  crearAlumno,
  crearAlumnoConUsuario,
  crearApoderadoConUsuario,
  crearPago,
  tokenDe,
} from '../helpers.js'

describe.skipIf(!process.env.TEST_DATABASE_URL)('pago.scope', () => {
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

  function actor(
    id: string,
    roles: ActorPagos['roles'],
  ): ActorPagos {
    return { id, roles, institucionId: INSTITUCION_ID }
  }

  it('assertPermiso lanza FORBIDDEN cuando el rol no tiene el permiso', async () => {
    const { usuario } = await tokenDe(prisma, ['DOCENTE'])

    expect(() =>
      assertPermiso(actor(usuario.id, ['DOCENTE']), 'administrative.pagos.leer'),
    ).toThrowError(AppError)
  })

  it('assertPermiso permite al Director y al Apoderado según la matriz', async () => {
    const { usuario: director } = await tokenDe(prisma, ['DIRECTOR'])
    const { usuario: apoderado } = await tokenDe(prisma, ['APODERADO'])

    expect(() =>
      assertPermiso(actor(director.id, ['DIRECTOR']), 'administrative.pagos.registrar'),
    ).not.toThrow()
    expect(() =>
      assertPermiso(actor(apoderado.id, ['APODERADO']), 'administrative.pagos.leer'),
    ).not.toThrow()
    expect(() =>
      assertPermiso(actor(apoderado.id, ['APODERADO']), 'administrative.pagos.registrar'),
    ).toThrowError(AppError)
  })

  it('esAdministrativo reconoce a Director y SuperAdmin', async () => {
    const { usuario: director } = await tokenDe(prisma, ['DIRECTOR'])
    const { usuario: superAdmin } = await tokenDe(prisma, ['SUPER_ADMIN'])
    const { usuario: apoderado } = await tokenDe(prisma, ['APODERADO'])

    expect(esAdministrativo(actor(director.id, ['DIRECTOR']))).toBe(true)
    expect(esAdministrativo(actor(superAdmin.id, ['SUPER_ADMIN']))).toBe(true)
    expect(esAdministrativo(actor(apoderado.id, ['APODERADO']))).toBe(false)
  })

  it('el Director ve todos los pagos sin condición de vínculo', async () => {
    const { usuario } = await tokenDe(prisma, ['DIRECTOR'])
    const { where, auditarAcceso } = await construirAlcancePagos(
      actor(usuario.id, ['DIRECTOR']),
      {},
      prisma,
    )

    expect(auditarAcceso).toBe(false)
    expect(where.AND).toBeUndefined()
  })

  it('el SuperAdmin audita el acceso al listado', async () => {
    const { usuario } = await tokenDe(prisma, ['SUPER_ADMIN'])
    const { auditarAcceso } = await construirAlcancePagos(
      actor(usuario.id, ['SUPER_ADMIN']),
      {},
      prisma,
    )

    expect(auditarAcceso).toBe(true)
  })

  it('el Apoderado solo consulta pagos de sus alumnos vinculados', async () => {
    const alumno = await crearAlumno(prisma)
    const { usuario } = await crearApoderadoConUsuario(prisma, alumno.id)
    const ajeno = await crearAlumno(prisma)

    const propio = await construirAlcancePagos(
      actor(usuario.id, ['APODERADO']),
      { alumnoId: alumno.id },
      prisma,
    )
    expect(propio.where.AND).toBeDefined()

    await expect(
      construirAlcancePagos(
        actor(usuario.id, ['APODERADO']),
        { alumnoId: ajeno.id },
        prisma,
      ),
    ).rejects.toThrowError(AppError)
  })

  it('el Alumno solo consulta sus propios pagos', async () => {
    const { alumno, usuario } = await crearAlumnoConUsuario(prisma)
    const ajeno = await crearAlumno(prisma)

    await expect(
      construirAlcancePagos(
        actor(usuario.id, ['ALUMNO']),
        { alumnoId: alumno.id },
        prisma,
      ),
    ).resolves.toBeDefined()

    await expect(
      construirAlcancePagos(
        actor(usuario.id, ['ALUMNO']),
        { alumnoId: ajeno.id },
        prisma,
      ),
    ).rejects.toThrowError(AppError)
  })

  it('un rol sin alcance de pagos recibe FORBIDDEN', async () => {
    const { usuario } = await tokenDe(prisma, ['DOCENTE'])

    await expect(
      construirAlcancePagos(actor(usuario.id, ['DOCENTE']), {}, prisma),
    ).rejects.toThrowError(AppError)
  })

  it('assertVinculoPago permite al administrativo sin consultar la base', async () => {
    const { usuario } = await tokenDe(prisma, ['DIRECTOR'])

    await expect(
      assertVinculoPago(actor(usuario.id, ['DIRECTOR']), 'inexistente', prisma),
    ).resolves.toBeUndefined()
  })

  it('assertVinculoPago valida el vínculo del apoderado y del alumno', async () => {
    const alumno = await crearAlumno(prisma)
    const { usuario: apoderado } = await crearApoderadoConUsuario(prisma, alumno.id)
    const pago = await crearPago(prisma, { alumnoId: alumno.id })

    await expect(
      assertVinculoPago(actor(apoderado.id, ['APODERADO']), pago.id, prisma),
    ).resolves.toBeUndefined()

    const { alumno: propio, usuario: alumnoUsuario } =
      await crearAlumnoConUsuario(prisma)
    const pagoPropio = await crearPago(prisma, { alumnoId: propio.id })

    await expect(
      assertVinculoPago(actor(alumnoUsuario.id, ['ALUMNO']), pagoPropio.id, prisma),
    ).resolves.toBeUndefined()
  })

  it('assertVinculoPago rechaza un pago ajeno o inexistente', async () => {
    const alumno = await crearAlumno(prisma)
    const { usuario: apoderado } = await crearApoderadoConUsuario(prisma, alumno.id)
    const ajeno = await crearAlumno(prisma)
    const pagoAjeno = await crearPago(prisma, { alumnoId: ajeno.id })

    await expect(
      assertVinculoPago(actor(apoderado.id, ['APODERADO']), pagoAjeno.id, prisma),
    ).rejects.toThrowError(AppError)

    await expect(
      assertVinculoPago(
        actor(apoderado.id, ['APODERADO']),
        '00000000-0000-4000-8000-000000000099',
        prisma,
      ),
    ).rejects.toThrowError(AppError)
  })
})
