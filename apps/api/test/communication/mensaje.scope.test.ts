import type { RoleCode } from '@intranet/shared'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { AppError } from '../../src/core/errors.js'
import type { PrismaClient } from '../../src/generated/prisma/client.js'
import {
  assertVinculoSeccion,
  construirAlcanceMensajes,
} from '../../src/modules/communication/mensajeria/mensaje.scope.js'
import { createTestPrisma, limpiarBaseDePruebas } from '../helpers/test-db.js'
import {
  INSTITUCION_ID,
  crearEscenarioComunicacion,
  type EscenarioComunicacion,
} from './escenario.js'

describe.skipIf(!process.env.TEST_DATABASE_URL)('mensaje.scope', () => {
  let prisma: PrismaClient
  let escenario: EscenarioComunicacion

  beforeAll(() => {
    prisma = createTestPrisma()
  })

  beforeEach(async () => {
    await limpiarBaseDePruebas(prisma)
    escenario = await crearEscenarioComunicacion(prisma)
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  function actor(usuarioId: string, roles: readonly RoleCode[]) {
    return { id: usuarioId, roles, institucionId: INSTITUCION_ID }
  }

  it('el Director ve el hilo y el acceso se audita', async () => {
    const { where, hiloId, auditarAcceso } = await construirAlcanceMensajes(
      actor(escenario.director.usuarioId, ['DIRECTOR']),
      { seccionId: escenario.seccionAId },
      prisma,
    )

    expect(hiloId).toBe(escenario.hiloSeccionAId)
    expect(where).toEqual({ hiloId: escenario.hiloSeccionAId, deletedAt: null })
    expect(auditarAcceso).toBe(true)
  })

  it('el docente tutor accede y el docente no tutor no', async () => {
    const tutor = await construirAlcanceMensajes(
      actor(escenario.docenteTutor.usuarioId, ['DOCENTE']),
      { seccionId: escenario.seccionAId },
      prisma,
    )
    expect(tutor.where.id).toBeUndefined()

    const noTutor = await construirAlcanceMensajes(
      actor(escenario.docenteNoTutor.usuarioId, ['DOCENTE']),
      { seccionId: escenario.seccionAId },
      prisma,
    )
    expect(noTutor.where.id).toBe('NINGUNO')
  })

  it('el apoderado con matrícula aprobada accede y el apoderado sin vínculo no', async () => {
    const vinculado = await construirAlcanceMensajes(
      actor(escenario.apoderadoA.usuarioId, ['APODERADO']),
      { seccionId: escenario.seccionAId },
      prisma,
    )
    expect(vinculado.where.id).toBeUndefined()

    const sinVinculo = await construirAlcanceMensajes(
      actor(escenario.apoderadoSinVinculo.usuarioId, ['APODERADO']),
      { seccionId: escenario.seccionAId },
      prisma,
    )
    expect(sinVinculo.where.id).toBe('NINGUNO')
  })

  it('el Alumno no tiene acceso a la mensajería', async () => {
    const { where, hiloId } = await construirAlcanceMensajes(
      actor(escenario.alumnoA.usuarioId, ['ALUMNO']),
      { seccionId: escenario.seccionAId },
      prisma,
    )

    expect(hiloId).toBe('')
    expect(where.id).toBe('NINGUNO')
  })

  it('sin hilo creado el listado devuelve hiloId vacío', async () => {
    const { hiloId } = await construirAlcanceMensajes(
      actor(escenario.director.usuarioId, ['DIRECTOR']),
      { seccionId: escenario.seccionBId },
      prisma,
    )

    expect(hiloId).toBe('')
  })

  it('assertVinculoSeccion permite al tutor escribir antes de que exista el hilo', async () => {
    await expect(
      assertVinculoSeccion(
        actor(escenario.docenteTutor.usuarioId, ['DOCENTE']),
        escenario.seccionBId,
        prisma,
      ),
    ).rejects.toThrowError(AppError)

    await expect(
      assertVinculoSeccion(
        actor(escenario.docenteTutor.usuarioId, ['DOCENTE']),
        escenario.seccionAId,
        prisma,
      ),
    ).resolves.toBeUndefined()
  })

  it('assertVinculoSeccion rechaza al Director y al SuperAdmin', async () => {
    await expect(
      assertVinculoSeccion(
        actor(escenario.director.usuarioId, ['DIRECTOR']),
        escenario.seccionAId,
        prisma,
      ),
    ).rejects.toThrowError(AppError)

    await expect(
      assertVinculoSeccion(
        actor(escenario.superAdmin.usuarioId, ['SUPER_ADMIN']),
        escenario.seccionAId,
        prisma,
      ),
    ).rejects.toThrowError(AppError)
  })

  it('assertVinculoSeccion acepta al apoderado vinculado y rechaza al que no lo está', async () => {
    await expect(
      assertVinculoSeccion(
        actor(escenario.apoderadoA.usuarioId, ['APODERADO']),
        escenario.seccionAId,
        prisma,
      ),
    ).resolves.toBeUndefined()

    await expect(
      assertVinculoSeccion(
        actor(escenario.apoderadoSinVinculo.usuarioId, ['APODERADO']),
        escenario.seccionAId,
        prisma,
      ),
    ).rejects.toThrowError(AppError)
  })
})
