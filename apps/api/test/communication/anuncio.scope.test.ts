import type { RoleCode } from '@intranet/shared'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { PrismaClient } from '../../src/generated/prisma/client.js'
import { construirAlcanceAnuncios } from '../../src/modules/communication/anuncios/anuncio.scope.js'
import { createTestPrisma, limpiarBaseDePruebas } from '../helpers/test-db.js'
import {
  INSTITUCION_ID,
  crearEscenarioComunicacion,
  type EscenarioComunicacion,
} from './escenario.js'

describe.skipIf(!process.env.TEST_DATABASE_URL)('anuncio.scope', () => {
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

  async function idsVisibles(
    usuarioId: string,
    roles: readonly RoleCode[],
    filtros: Parameters<typeof construirAlcanceAnuncios>[1] = {},
  ): Promise<string[]> {
    const { where } = await construirAlcanceAnuncios(actor(usuarioId, roles), filtros, prisma)
    const filas = await prisma.anuncio.findMany({ where, select: { id: true } })

    return filas.map((fila) => fila.id)
  }

  it('el Director ve todos los anuncios y no deja registro de acceso', async () => {
    const { where, auditarAcceso } = await construirAlcanceAnuncios(
      actor(escenario.director.usuarioId, ['DIRECTOR']),
      {},
      prisma,
    )

    expect(where.OR).toBeUndefined()
    expect(auditarAcceso).toBe(false)

    const ids = await idsVisibles(escenario.director.usuarioId, ['DIRECTOR'])
    expect(ids).toHaveLength(5)
  })

  it('el SuperAdmin ve todos y audita el acceso', async () => {
    const { auditarAcceso } = await construirAlcanceAnuncios(
      actor(escenario.superAdmin.usuarioId, ['SUPER_ADMIN']),
      {},
      prisma,
    )

    expect(auditarAcceso).toBe(true)
  })

  it('los filtros de audiencia JSON funcionan con array_contains (regresión 500)', async () => {
    const porRol = await idsVisibles(escenario.director.usuarioId, ['DIRECTOR'], {
      rol: 'APODERADO',
    })
    expect(porRol).toEqual(
      expect.arrayContaining([escenario.anuncioInstitucionalId, escenario.anuncioBorradorId]),
    )
    expect(porRol).not.toContain(escenario.anuncioPorNivelId)

    const porNivel = await idsVisibles(escenario.director.usuarioId, ['DIRECTOR'], {
      nivelId: escenario.nivelId,
    })
    expect(porNivel).toEqual([escenario.anuncioPorNivelId])

    const porSeccion = await idsVisibles(escenario.director.usuarioId, ['DIRECTOR'], {
      seccionId: escenario.seccionAId,
    })
    expect(porSeccion).toEqual([escenario.anuncioSeccionAId])
  })

  it('el Apoderado ve los publicados dirigidos a su rol y no los borradores', async () => {
    const ids = await idsVisibles(escenario.apoderadoA.usuarioId, ['APODERADO'])

    expect(ids).toContain(escenario.anuncioInstitucionalId)
    expect(ids).toContain(escenario.anuncioPorNivelId)
    expect(ids).toContain(escenario.anuncioSeccionAId)
    expect(ids).not.toContain(escenario.anuncioBorradorId)
    expect(ids).not.toContain(escenario.anuncioSeccionBId)
  })

  it('el filtro de estado no permite a un Apoderado ver borradores', async () => {
    const { where } = await construirAlcanceAnuncios(
      actor(escenario.apoderadoA.usuarioId, ['APODERADO']),
      { estado: 'BORRADOR' },
      prisma,
    )

    expect(where.estado).toBe('PUBLICADO')
  })

  it('un Apoderado sin vínculos solo ve anuncios dirigidos a su rol', async () => {
    const ids = await idsVisibles(escenario.apoderadoSinVinculo.usuarioId, ['APODERADO'])

    expect(ids).toEqual([escenario.anuncioInstitucionalId])
  })

  it('el Docente ve los institucionales y los de su sección', async () => {
    const ids = await idsVisibles(escenario.docenteTutor.usuarioId, ['DOCENTE'])

    expect(ids).toContain(escenario.anuncioInstitucionalId)
    expect(ids).toContain(escenario.anuncioPorNivelId)
    expect(ids).toContain(escenario.anuncioSeccionAId)
    expect(ids).not.toContain(escenario.anuncioSeccionBId)
  })

  it('el Alumno ve los anuncios de su sección, nivel y rol', async () => {
    const ids = await idsVisibles(escenario.alumnoA.usuarioId, ['ALUMNO'])

    expect(ids).toContain(escenario.anuncioInstitucionalId)
    expect(ids).toContain(escenario.anuncioPorNivelId)
    expect(ids).toContain(escenario.anuncioSeccionAId)
    expect(ids).not.toContain(escenario.anuncioBorradorId)
    expect(ids).not.toContain(escenario.anuncioSeccionBId)
  })
})
