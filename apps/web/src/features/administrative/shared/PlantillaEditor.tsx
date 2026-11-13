import { useState, useEffect, useMemo, type ChangeEvent } from 'react'
import type { TipoCertificado } from '@intranet/shared'
import { etiquetaTipoCertificado } from './formato'

interface PlantillaEditorProps {
  /** Valor inicial del contenido HTML */
  valorInicial?: string
  /** Tipo de certificado (para variables sugeridas) */
  tipo?: TipoCertificado
  /** Callback cuando cambia el contenido */
  onChange: (contenido: string) => void
  /** Si el editor está deshabilitado */
  deshabilitado?: boolean
  /** Etiqueta del campo */
  label?: string
  /** Texto de ayuda */
  ayuda?: string
  /** Mensaje de error */
  error?: string
}

/**
 * Variables sugeridas por tipo de certificado.
 */
const VARIABLES_POR_TIPO: Record<string, string[]> = {
  ESTUDIOS: [
    'alumno.nombres',
    'alumno.apellidos',
    'alumno.codigoAlumno',
    'alumno.fechaNacimiento',
    'alumno.documento',
    'anio.nombre',
    'anio.fechaInicio',
    'anio.fechaFin',
    'grado.nombre',
    'seccion.nombre',
    'fechaEmision',
  ],
  MATRICULA: [
    'alumno.nombres',
    'alumno.apellidos',
    'alumno.codigoAlumno',
    'anio.nombre',
    'grado.nombre',
    'seccion.nombre',
    'fechaMatricula',
    'fechaVencimiento',
  ],
  NO_ADEUDO: [
    'alumno.nombres',
    'alumno.apellidos',
    'alumno.codigoAlumno',
    'anio.nombre',
    'fechaEmision',
  ],
  CONDUCTA: [
    'alumno.nombres',
    'alumno.apellidos',
    'alumno.codigoAlumno',
    'anio.nombre',
    'grado.nombre',
    'seccion.nombre',
    'fechaEmision',
  ],
  OTRO: [
    'alumno.nombres',
    'alumno.apellidos',
    'alumno.codigoAlumno',
    'anio.nombre',
    'fechaEmision',
  ],
}

/**
 * Valores de prueba para previsualización.
 */
const VALORES_PRUEBA: Record<string, string> = {
  'alumno.nombres': 'Juan Carlos',
  'alumno.apellidos': 'Pérez García',
  'alumno.codigoAlumno': '2024-00123',
  'alumno.fechaNacimiento': '15/03/2010',
  'alumno.documento': '12345678',
  'anio.nombre': '2026',
  'anio.fechaInicio': '01/03/2026',
  'anio.fechaFin': '20/12/2026',
  'grado.nombre': '3° Primaria',
  'seccion.nombre': 'A',
  'fechaEmision': '15/06/2026',
  'fechaMatricula': '01/03/2026',
  'fechaVencimiento': '31/12/2026',
}

/**
 * Plantilla base sugerida por tipo.
 */
const PLANTILLAS_BASE: Record<string, string> = {
  ESTUDIOS: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; }
    .header { text-align: center; margin-bottom: 30px; }
    .logo { max-width: 120px; margin-bottom: 20px; }
    .title { font-size: 24px; font-weight: bold; margin: 10px 0; }
    .subtitle { font-size: 16px; color: #666; }
    .content { margin-top: 30px; line-height: 1.6; }
    .field { margin: 10px 0; }
    .label { font-weight: bold; display: inline-block; width: 200px; }
    .footer { margin-top: 50px; text-align: center; font-size: 12px; color: #999; }
  </style>
</head>
<body>
  <div class="header">
    <img class="logo" src="logo.png" alt="Logo" />
    <div class="title">CERTIFICADO DE ESTUDIOS</div>
    <div class="subtitle">Institución Educativa {{institucion.nombre}}</div>
  </div>
  <div class="content">
    <p>Se certifica que el estudiante <strong>{{alumno.nombres}} {{alumno.apellidos}}</strong>, con código de alumno <strong>{{alumno.codigoAlumno}}</strong> y DNI <strong>{{alumno.documento}}</strong>, ha cursado satisfactoriamente el año académico <strong>{{anio.nombre}}</strong> en el grado <strong>{{grado.nombre}}</strong>, sección <strong>{{seccion.nombre}}</strong>.</p>
    <p>Fecha de emisión: <strong>{{fechaEmision}}</strong></p>
  </div>
  <div class="footer">
    <p>Documento generado automáticamente. Código de verificación: {{codigoVerificacion}}</p>
  </div>
</body>
</html>
`,
  MATRICULA: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; }
    .header { text-align: center; margin-bottom: 30px; }
    .title { font-size: 24px; font-weight: bold; margin: 10px 0; }
    .content { margin-top: 30px; line-height: 1.6; }
    .field { margin: 10px 0; }
    .label { font-weight: bold; display: inline-block; width: 220px; }
    .footer { margin-top: 50px; text-align: center; font-size: 12px; color: #999; }
  </style>
</head>
<body>
  <div class="header">
    <div class="title">CERTIFICADO DE MATRÍCULA</div>
    <div class="subtitle">Institución Educativa {{institucion.nombre}}</div>
  </div>
  <div class="content">
    <p>Se certifica que el estudiante <strong>{{alumno.nombres}} {{alumno.apellidos}}</strong>, con código de alumno <strong>{{alumno.codigoAlumno}}</strong>, se encuentra matriculado en el año académico <strong>{{anio.nombre}}</strong> en el grado <strong>{{grado.nombre}}</strong>, sección <strong>{{seccion.nombre}}</strong>.</p>
    <p>Fecha de matrícula: <strong>{{fechaMatricula}}</strong></p>
    <p>Vigencia hasta: <strong>{{fechaVencimiento}}</strong></p>
  </div>
  <div class="footer">
    <p>Documento generado automáticamente.</p>
  </div>
</body>
</html>
`,
  NO_ADEUDO: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; }
    .header { text-align: center; margin-bottom: 30px; }
    .title { font-size: 24px; font-weight: bold; margin: 10px 0; }
    .content { margin-top: 30px; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="header">
    <div class="title">CERTIFICADO DE NO ADEUDO</div>
    <div class="subtitle">Institución Educativa {{institucion.nombre}}</div>
  </div>
  <div class="content">
    <p>Se certifica que el estudiante <strong>{{alumno.nombres}} {{alumno.apellidos}}</strong>, con código de alumno <strong>{{alumno.codigoAlumno}}</strong>, no registra deudas pendientes al <strong>{{fechaEmision}}</strong> en la Institución Educativa {{institucion.nombre}} correspondiente al año académico <strong>{{anio.nombre}}</strong>.</p>
  </div>
</body>
</html>
`,
  CONDUCTA: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; }
    .header { text-align: center; margin-bottom: 30px; }
    .title { font-size: 24px; font-weight: bold; margin: 10px 0; }
    .content { margin-top: 30px; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="header">
    <div class="title">CERTIFICADO DE CONDUCTA</div>
    <div class="subtitle">Institución Educativa {{institucion.nombre}}</div>
  </div>
  <div class="content">
    <p>Se certifica que el estudiante <strong>{{alumno.nombres}} {{alumno.apellidos}}</strong>, con código de alumno <strong>{{alumno.codigoAlumno}}</strong>, ha mantenido una conducta ejemplar durante el año académico <strong>{{anio.nombre}}</strong> en el grado <strong>{{grado.nombre}}</strong>, sección <strong>{{seccion.nombre}}</strong>.</p>
    <p>Fecha de emisión: <strong>{{fechaEmision}}</strong></p>
  </div>
</body>
</html>
`,
  OTRO: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; }
    .header { text-align: center; margin-bottom: 30px; }
    .title { font-size: 24px; font-weight: bold; margin: 10px 0; }
    .content { margin-top: 30px; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="header">
    <div class="title">CERTIFICADO</div>
    <div class="subtitle">Institución Educativa {{institucion.nombre}}</div>
  </div>
  <div class="content">
    <p>Se certifica que <strong>{{alumno.nombres}} {{alumno.apellidos}}</strong>, código <strong>{{alumno.codigoAlumno}}</strong>.</p>
  </div>
</body>
</html>
`,
}

/**
 * Extrae variables {{variable}} del contenido HTML.
 */
function extraerVariables(contenido: string): string[] {
  const regex = /\{\{(\w+(?:\.\w+)*)\}\}/g
  const variables = new Set<string>()
  let match: RegExpExecArray | null
  while ((match = regex.exec(contenido)) !== null) {
    if (match[1]) variables.add(match[1])
  }
  return Array.from(variables).sort()
}

/**
 * Renderiza el contenido sustituyendo variables {{variable}} por sus valores.
 */
function renderizarConVariables(contenido: string, valores: Record<string, string>): string {
  return contenido.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_match, key) => {
    return valores[key] ?? `{{${key}}}`
  })
}

export function PlantillaEditor({
  valorInicial = '',
  tipo,
  onChange,
  deshabilitado = false,
  label = 'Contenido de la plantilla (HTML)',
  ayuda = 'Use variables {{variable}} para contenido dinámico. Variables disponibles según el tipo de certificado.',
  error,
}: PlantillaEditorProps) {
  const [contenido, setContenido] = useState<string>(() => {
    if (valorInicial) return valorInicial
    if (tipo && PLANTILLAS_BASE[tipo]) return PLANTILLAS_BASE[tipo] as string
    return PLANTILLAS_BASE.OTRO as string
  })
  const [pestanaActiva, setPestanaActiva] = useState<'editor' | 'preview' | 'variables'>('editor')
  const [valoresPrueba, setValoresPrueba] = useState<Record<string, string>>(VALORES_PRUEBA)

  // Textos con llaves que no deben interpretarse como expresiones JSX
  const textoPreviewAyuda = 'Los valores {{variable}} se reemplazan con datos de prueba'
  const textoSinVariables = 'No se detectaron variables {{variable}} en el contenido.'

  // Notificar cambios al padre
  useEffect(() => {
    onChange(contenido)
  }, [contenido, onChange])

  // Variables detectadas en el contenido
  const variablesDetectadas = useMemo(() => extraerVariables(contenido), [contenido])

  // Variables sugeridas para el tipo actual
  const variablesSugeridas = useMemo(
    () => VARIABLES_POR_TIPO[tipo ?? 'OTRO'] ?? [],
    [tipo]
  )

  // Variables con valores de prueba (para preview)
  const valoresParaPreview = useMemo(
    () => ({ ...VALORES_PRUEBA, ...valoresPrueba }),
    [valoresPrueba]
  )

  // Contenido renderizado para preview
  const contenidoRenderizado = useMemo(
    () => renderizarConVariables(contenido, valoresParaPreview),
    [contenido, valoresParaPreview]
  )

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setContenido(e.target.value)
  }

  const manejarCargarPlantilla = () => {
    if (tipo && PLANTILLAS_BASE[tipo]) {
      setContenido(PLANTILLAS_BASE[tipo])
    }
  }

  const manejarValorPrueba = (variable: string, valor: string) => {
    setValoresPrueba((prev) => ({ ...prev, [variable]: valor }))
  }

  return (
    <div className="space-y-4">
      <label className="block text-sm font-medium text-slate-700">{label}</label>
      {ayuda && <p className="text-sm text-slate-500">{ayuda}</p>}

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-4" aria-label="Vistas del editor">
          <button
            type="button"
            onClick={() => setPestanaActiva('editor')}
            className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
              pestanaActiva === 'editor'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Editor
          </button>
          <button
            type="button"
            onClick={() => setPestanaActiva('preview')}
            className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
              pestanaActiva === 'preview'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Previsualización
          </button>
          <button
            type="button"
            onClick={() => setPestanaActiva('variables')}
            className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
              pestanaActiva === 'variables'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Variables ({variablesDetectadas.length})
          </button>
        </nav>
      </div>

      {/* Panel activo */}
      <div className="border border-slate-200 rounded-lg bg-white">
        {pestanaActiva === 'editor' && (
          <div className="p-4">
            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={manejarCargarPlantilla}
                disabled={deshabilitado || !tipo}
                className="px-3 py-1.5 text-sm border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50"
              >
                Cargar plantilla base
              </button>
              <span className="text-sm text-slate-500 self-center">
                Tipo: {tipo ? etiquetaTipoCertificado(tipo) : 'No seleccionado'}
              </span>
            </div>
            <textarea
              value={contenido}
              onChange={handleChange}
              disabled={deshabilitado}
              className={`
                w-full min-h-[300px] p-3 border rounded-lg font-mono text-sm
                focus:outline-none focus:ring-2 focus:ring-blue-500
                ${deshabilitado ? 'bg-slate-50 cursor-not-allowed' : 'border-slate-300'}
                ${error ? 'border-red-500' : 'border-slate-300'}
              `}
              placeholder="Escriba el contenido HTML de la plantilla. Use {{variable}} para variables dinámicas."
              spellCheck={false}
            />
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          </div>
        )}

        {pestanaActiva === 'preview' && (
          <div className="p-4 min-h-[300px] border-t border-slate-200 bg-slate-50">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-medium text-slate-700">Previsualización con valores de prueba</h3>
              <span className="text-xs text-slate-500">{textoPreviewAyuda}</span>
            </div>
            <div
              className="border border-slate-200 rounded p-4 bg-white min-h-[300px] overflow-auto"
              dangerouslySetInnerHTML={{ __html: contenidoRenderizado }}
            />
          </div>
        )}

        {pestanaActiva === 'variables' && (
          <div className="p-4 border-t border-slate-200">
            <h3 className="mb-3 font-medium text-slate-700">
              Variables detectadas en el contenido ({variablesDetectadas.length})
            </h3>

            {variablesDetectadas.length === 0 && (
              <p className="text-slate-500 text-center py-8">
                {textoSinVariables}
              </p>
            )}

            {variablesDetectadas.length > 0 && (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {variablesDetectadas.map((variable) => (
                  <div
                    key={variable}
                    className="flex items-center gap-3 p-2 bg-slate-50 rounded"
                  >
                    <code className="flex-1 text-sm bg-white px-2 py-1 rounded border">
                      {'{{' + variable + '}}'}
                    </code>
                    <input
                      type="text"
                      value={valoresParaPreview[variable] ?? ''}
                      onChange={(e) => manejarValorPrueba(variable, e.target.value)}
                      placeholder={`Valor de prueba para ${variable}`}
                      className="flex-1 px-2 py-1.5 text-sm border border-slate-300 rounded"
                    />
                    {valoresParaPreview[variable] === undefined && (
                      <span className="text-xs text-amber-600">Sin valor de prueba</span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {variablesSugeridas.length > 0 && (
              <div className="mt-6 pt-4 border-t border-slate-200">
                <h4 className="mb-2 font-medium text-slate-700">
                  Variables sugeridas para {tipo ? etiquetaTipoCertificado(tipo) : 'este tipo'}
                </h4>
                <div className="flex flex-wrap gap-2">
                  {variablesSugeridas.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => {
                        if (!contenido.includes(`{{${v}}}`)) {
                          setContenido(contenido + `\n{{${v}}}`)
                        }
                      }}
                      className="px-2 py-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded hover:bg-blue-100"
                    >
                      {'{{' + v + '}}'}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}

export default PlantillaEditor