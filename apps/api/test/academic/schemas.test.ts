import {
  actualizarCalificacionSchema,
  actualizarHorarioSchema,
  actualizarNotaFinalSchema,
  corregirAsistenciaSchema,
  crearCalificacionSchema,
  crearHorarioSchema,
  crearJustificacionSchema,
  crearNotaFinalSchema,
  listarAsistenciasQuerySchema,
  listarHorariosQuerySchema,
  rechazarJustificacionSchema,
  registrarAsistenciaLoteSchema,
  resolverJustificacionSchema,
  umbralAsistenciaSchema,
  valorLiteralSchema,
} from '@intranet/shared'
import { describe, expect, it } from 'vitest'

const ALUMNO_ID = '00000000-0000-4000-8000-000000000001'
const CURSO_ID = '00000000-0000-4000-8000-000000000002'
const PERIODO_ID = '00000000-0000-4000-8000-000000000003'
const SECCION_ID = '00000000-0000-4000-8000-000000000004'
const ANIO_ID = '00000000-0000-4000-8000-000000000005'
const DOCENTE_ID = '00000000-0000-4000-8000-000000000006'

function valido(schema: { safeParse: (valor: unknown) => { success: boolean } }, valor: unknown): boolean {
  return schema.safeParse(valor).success
}

describe('escala literal y estados de dominio', () => {
  it('solo admite AD, A, B y C', () => {
    for (const valor of ['AD', 'A', 'B', 'C']) {
      expect(valido(valorLiteralSchema, valor)).toBe(true)
    }

    for (const valor of ['D', 'AD.', 'ad', '0', '20', 20]) {
      expect(valido(valorLiteralSchema, valor)).toBe(false)
    }
  })
})

describe('calificaciones y notas finales', () => {
  const calificacion = {
    alumnoId: ALUMNO_ID,
    cursoId: CURSO_ID,
    periodoId: PERIODO_ID,
    valor: 'A',
  }

  it('acepta una calificación literal válida', () => {
    expect(valido(crearCalificacionSchema, calificacion)).toBe(true)
    expect(
      valido(crearCalificacionSchema, { ...calificacion, observacion: '  ' }),
    ).toBe(true)
  })

  it('rechaza valores numéricos, literales ajenos e ids inválidos', () => {
    expect(
      valido(crearCalificacionSchema, { ...calificacion, valor: 18 }),
    ).toBe(false)
    expect(
      valido(crearCalificacionSchema, { ...calificacion, valor: 'ADM' }),
    ).toBe(false)
    expect(
      valido(crearCalificacionSchema, { ...calificacion, alumnoId: 'alumno' }),
    ).toBe(false)
    expect(valido(crearCalificacionSchema, { ...calificacion, valor: undefined })).toBe(
      false,
    )
  })

  it('exige al menos un campo al actualizar y no admite valores numéricos', () => {
    expect(valido(actualizarCalificacionSchema, { valor: 'AD' })).toBe(true)
    expect(
      valido(actualizarCalificacionSchema, { observacion: 'Mejora' }),
    ).toBe(true)
    expect(valido(actualizarCalificacionSchema, { motivo: 'Corrección' })).toBe(
      false,
    )
    expect(valido(actualizarCalificacionSchema, {})).toBe(false)
    expect(valido(actualizarCalificacionSchema, { valor: 15 })).toBe(false)
  })

  it('la nota final usa el mismo contrato manual, sin cálculo', () => {
    expect(valido(crearNotaFinalSchema, calificacion)).toBe(true)
    expect(
      valido(crearNotaFinalSchema, { ...calificacion, valor: 'C' }),
    ).toBe(true)
    expect(
      valido(crearNotaFinalSchema, { ...calificacion, valor: 20 }),
    ).toBe(false)
    expect(
      valido(actualizarNotaFinalSchema, { valor: 'B', motivo: 'Ajuste' }),
    ).toBe(true)
    expect(valido(actualizarNotaFinalSchema, {})).toBe(false)
  })
})

describe('asistencias', () => {
  it('valida el lote, sus estados y el límite de 200 registros', () => {
    const lote = {
      seccionId: SECCION_ID,
      fecha: '2026-05-12',
      registros: [
        { alumnoId: ALUMNO_ID, estado: 'PRESENTE' },
        {
          alumnoId: '00000000-0000-4000-8000-000000000011',
          estado: 'FALTA_INJUSTIFICADA',
          observacion: 'Sin aviso',
        },
      ],
    }

    expect(valido(registrarAsistenciaLoteSchema, lote)).toBe(true)
    expect(
      valido(registrarAsistenciaLoteSchema, { ...lote, registros: [] }),
    ).toBe(false)
    expect(
      valido(registrarAsistenciaLoteSchema, {
        ...lote,
        registros: [{ alumnoId: ALUMNO_ID, estado: 'AUSENTE' }],
      }),
    ).toBe(false)
    expect(
      valido(registrarAsistenciaLoteSchema, {
        ...lote,
        registros: [
          { alumnoId: ALUMNO_ID, estado: 'PRESENTE' },
          { alumnoId: ALUMNO_ID, estado: 'TARDE' },
        ],
      }),
    ).toBe(false)
    expect(
      valido(registrarAsistenciaLoteSchema, {
        ...lote,
        registros: Array.from({ length: 201 }, (_, indice) => ({
          alumnoId: `00000000-0000-4000-8000-${String(indice + 1).padStart(12, '0')}`,
          estado: 'PRESENTE',
        })),
      }),
    ).toBe(false)
  })

  it('exige motivo y un cambio al corregir', () => {
    expect(valido(corregirAsistenciaSchema, { estado: 'TARDE', motivo: 'Error' })).toBe(
      true,
    )
    expect(valido(corregirAsistenciaSchema, { estado: 'TARDE' })).toBe(false)
    expect(valido(corregirAsistenciaSchema, { motivo: 'Error' })).toBe(false)
    expect(
      valido(corregirAsistenciaSchema, { estado: 'TARDE', motivo: '   ' }),
    ).toBe(false)
  })

  it('valida el rango de fechas del listado', () => {
    expect(
      valido(listarAsistenciasQuerySchema, {
        desde: '2026-03-01',
        hasta: '2026-03-31',
      }),
    ).toBe(true)
    expect(
      valido(listarAsistenciasQuerySchema, {
        desde: '2026-04-01',
        hasta: '2026-03-31',
      }),
    ).toBe(false)
    expect(
      valido(listarAsistenciasQuerySchema, { hasta: '31/03/2026' }),
    ).toBe(false)
  })
})

describe('justificaciones', () => {
  it('exige motivo en la solicitud y en el rechazo', () => {
    expect(valido(crearJustificacionSchema, { motivo: 'Cita médica' })).toBe(true)
    expect(valido(crearJustificacionSchema, { motivo: ' ' })).toBe(false)
    expect(valido(rechazarJustificacionSchema, { motivo: 'Sin sustento' })).toBe(
      true,
    )
    expect(valido(rechazarJustificacionSchema, {})).toBe(false)
  })

  it('acepta la aprobación con o sin comentario', () => {
    expect(valido(resolverJustificacionSchema, {})).toBe(true)
    expect(
      valido(resolverJustificacionSchema, { comentario: 'Conforme' }),
    ).toBe(true)
  })
})

describe('umbral de inasistencias', () => {
  it('exige un entero positivo y no aplica valores por defecto', () => {
    expect(valido(umbralAsistenciaSchema, { faltasParaAlerta: 3 })).toBe(true)

    for (const valor of [0, -1, 2.5, '3', null]) {
      expect(valido(umbralAsistenciaSchema, { faltasParaAlerta: valor })).toBe(
        false,
      )
    }

    expect(valido(umbralAsistenciaSchema, {})).toBe(false)
  })
})

describe('horarios', () => {
  const horario = {
    anioId: ANIO_ID,
    seccionId: SECCION_ID,
    cursoId: CURSO_ID,
    docenteId: DOCENTE_ID,
    diaSemana: 1,
    horaInicio: '08:00',
    horaFin: '09:30',
  }

  it('acepta un bloque válido sin docente', () => {
    expect(valido(crearHorarioSchema, horario)).toBe(true)
    expect(
      valido(crearHorarioSchema, { ...horario, docenteId: undefined }),
    ).toBe(true)
  })

  it('valida día, formato de hora y orden de las horas', () => {
    expect(valido(crearHorarioSchema, { ...horario, diaSemana: 0 })).toBe(false)
    expect(valido(crearHorarioSchema, { ...horario, diaSemana: 8 })).toBe(false)
    expect(valido(crearHorarioSchema, { ...horario, diaSemana: 1.5 })).toBe(
      false,
    )
    expect(valido(crearHorarioSchema, { ...horario, horaInicio: '8:00' })).toBe(
      false,
    )
    expect(valido(crearHorarioSchema, { ...horario, horaFin: '24:00' })).toBe(
      false,
    )
    expect(
      valido(crearHorarioSchema, {
        ...horario,
        horaInicio: '10:00',
        horaFin: '09:00',
      }),
    ).toBe(false)
    expect(
      valido(crearHorarioSchema, {
        ...horario,
        horaInicio: '10:00',
        horaFin: '10:00',
      }),
    ).toBe(false)
  })

  it('permite actualizar un solo campo y valida el par de horas', () => {
    expect(valido(actualizarHorarioSchema, { horaFin: '10:00' })).toBe(true)
    expect(valido(actualizarHorarioSchema, { diaSemana: 5 })).toBe(true)
    expect(valido(actualizarHorarioSchema, {})).toBe(false)
    expect(
      valido(actualizarHorarioSchema, {
        horaInicio: '11:00',
        horaFin: '10:00',
      }),
    ).toBe(false)
  })

  it('exige el año en el listado de horarios', () => {
    expect(valido(listarHorariosQuerySchema, { anioId: ANIO_ID })).toBe(true)
    expect(valido(listarHorariosQuerySchema, {})).toBe(false)
  })
})
