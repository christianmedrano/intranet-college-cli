import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  crearPagoSchema,
  conceptoPagoSchema,
  metodoPagoSchema,
  type ConceptoPago,
  type MetodoPago,
} from '@intranet/shared'
import { crearPago } from './api'
import { mensajeError } from '../shared/formato'

const crearPagoFormSchema = crearPagoSchema.extend({
  // Permitir string vacío en selects, validar en submit
  concepto: conceptoPagoSchema.or(z.literal('')),
  metodo: metodoPagoSchema.or(z.literal('')),
}).refine(
  (data) => data.concepto !== '',
  { message: 'Debe seleccionar un concepto', path: ['concepto'] }
).refine(
  (data) => data.metodo !== '',
  { message: 'Debe seleccionar un método de pago', path: ['metodo'] }
)

type CrearPagoFormInput = z.infer<typeof crearPagoFormSchema>

interface PagoFormProps {
  /** Alumnos disponibles para el selector */
  alumnos: { id: string; codigoAlumno: string; nombres: string; apellidos: string }[]
  /** Callback al guardar exitoso */
  onGuardado: (mensaje?: string) => void
  /** Callback al cancelar */
  onCancelar: () => void
}

const CONCEPTOS: { value: ConceptoPago; label: string }[] = [
  { value: 'CUOTA_MENSUAL', label: 'Cuota Mensual' },
  { value: 'MATRICULA', label: 'Matrícula' },
  { value: 'CERTIFICADO', label: 'Certificado' },
  { value: 'OTRO', label: 'Otro' },
]

const METODOS: { value: MetodoPago; label: string }[] = [
  { value: 'EFECTIVO', label: 'Efectivo' },
  { value: 'TRANSFERENCIA', label: 'Transferencia' },
  { value: 'DEPOSITO', label: 'Depósito' },
  { value: 'OTRO', label: 'Otro' },
]

export function PagoForm({
  alumnos,
  onGuardado,
  onCancelar,
}: PagoFormProps) {
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const schema = crearPagoFormSchema

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CrearPagoFormInput>({
    resolver: zodResolver(schema),
    defaultValues: {
      concepto: '',
      metodo: '',
      moneda: 'PEN',
      fechaPago: new Date().toISOString().split('T')[0],
      comprobante: '',
      observaciones: '',
    },
  })

  const handleSubmitForm = async (datos: CrearPagoFormInput) => {
    setError(null)
    setCargando(true)

    try {
      // Transformar datos al formato del backend
      const payload = {
        alumnoId: datos.alumnoId,
        concepto: datos.concepto as ConceptoPago,
        monto: datos.monto,
        moneda: datos.moneda,
        fechaPago: datos.fechaPago,
        metodo: datos.metodo as MetodoPago,
        comprobante: datos.comprobante || undefined,
        observaciones: datos.observaciones || undefined,
      }

      await crearPago(payload)
      onGuardado('Pago registrado correctamente')
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setCargando(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(handleSubmitForm)} className="space-y-6" noValidate>
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm" role="alert">
          {error}
        </div>
      )}

      {/* Alumno */}
      <div>
        <label htmlFor="alumnoId" className="block text-sm font-medium text-slate-700 mb-1">
          Alumno <span className="text-red-500">*</span>
        </label>
        <select
          id="alumnoId"
          {...register('alumnoId', { required: 'El alumno es obligatorio' })}
          className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.alumnoId ? 'border-red-500' : 'border-slate-300'
          }`}
          disabled={cargando}
        >
          <option value="">Seleccionar alumno...</option>
          {alumnos.map((a) => (
            <option key={a.id} value={a.id}>
              {a.codigoAlumno} - {a.nombres} {a.apellidos}
            </option>
          ))}
        </select>
        {errors.alumnoId && (
          <p className="mt-1 text-sm text-red-600">{errors.alumnoId.message}</p>
        )}
      </div>

      {/* Concepto */}
      <div>
        <label htmlFor="concepto" className="block text-sm font-medium text-slate-700 mb-1">
          Concepto <span className="text-red-500">*</span>
        </label>
        <select
          id="concepto"
          {...register('concepto')}
          className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.concepto ? 'border-red-500' : 'border-slate-300'
          }`}
          disabled={cargando}
        >
          <option value="">Seleccionar concepto...</option>
          {CONCEPTOS.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
        {errors.concepto && (
          <p className="mt-1 text-sm text-red-600">{errors.concepto.message}</p>
        )}
      </div>

      {/* Monto */}
      <div>
        <label htmlFor="monto" className="block text-sm font-medium text-slate-700 mb-1">
          Monto (PEN) <span className="text-red-500">*</span>
        </label>
        <input
          type="number"
          id="monto"
          step="0.01"
          min="0.01"
          max="999999.99"
          {...register('monto', {
            required: 'El monto es obligatorio',
            valueAsNumber: true,
            min: { value: 0.01, message: 'El monto debe ser mayor a 0' },
            max: { value: 999999.99, message: 'El monto supera el máximo permitido' },
            validate: (value) => value % 1 !== 0 && value % 0.1 !== 0 && value % 0.01 !== 0
              ? 'El monto debe tener máximo 2 decimales'
              : undefined,
          })}
          className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.monto ? 'border-red-500' : 'border-slate-300'
          }`}
          placeholder="0.00"
          disabled={cargando}
        />
        {errors.monto && (
          <p className="mt-1 text-sm text-red-600">{errors.monto.message}</p>
        )}
      </div>

      {/* Moneda (solo lectura PEN) */}
      <div>
        <label htmlFor="moneda" className="block text-sm font-medium text-slate-700 mb-1">
          Moneda
        </label>
        <input
          type="text"
          id="moneda"
          readOnly
          {...register('moneda')}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-slate-50 text-slate-600"
          value="PEN"
        />
      </div>

      {/* Fecha de pago */}
      <div>
        <label htmlFor="fechaPago" className="block text-sm font-medium text-slate-700 mb-1">
          Fecha de pago <span className="text-red-500">*</span>
        </label>
        <input
          type="date"
          id="fechaPago"
          {...register('fechaPago', {
            required: 'La fecha es obligatoria',
            validate: (value) => {
              const hoy = new Date()
              hoy.setHours(23, 59, 59, 999)
              const fecha = new Date(value)
              return fecha <= hoy || 'La fecha no puede ser futura'
            },
          })}
          className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.fechaPago ? 'border-red-500' : 'border-slate-300'
          }`}
          disabled={cargando}
          max={new Date().toISOString().split('T')[0]}
        />
        {errors.fechaPago && (
          <p className="mt-1 text-sm text-red-600">{errors.fechaPago.message}</p>
        )}
      </div>

      {/* Método de pago */}
      <div>
        <label htmlFor="metodo" className="block text-sm font-medium text-slate-700 mb-1">
          Método de pago <span className="text-red-500">*</span>
        </label>
        <select
          id="metodo"
          {...register('metodo')}
          className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.metodo ? 'border-red-500' : 'border-slate-300'
          }`}
          disabled={cargando}
        >
          <option value="">Seleccionar método...</option>
          {METODOS.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
        {errors.metodo && (
          <p className="mt-1 text-sm text-red-600">{errors.metodo.message}</p>
        )}
      </div>

      {/* Comprobante */}
      <div>
        <label htmlFor="comprobante" className="block text-sm font-medium text-slate-700 mb-1">
          Comprobante (opcional)
        </label>
        <input
          type="text"
          id="comprobante"
          maxLength={100}
          {...register('comprobante')}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Número de operación, voucher, etc."
          disabled={cargando}
        />
      </div>

      {/* Observaciones */}
      <div>
        <label htmlFor="observaciones" className="block text-sm font-medium text-slate-700 mb-1">
          Observaciones (opcional)
        </label>
        <textarea
          id="observaciones"
          maxLength={500}
          rows={3}
          {...register('observaciones')}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Información adicional..."
          disabled={cargando}
        />
      </div>

      {/* Acciones */}
      <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
        <button
          type="button"
          onClick={onCancelar}
          disabled={cargando}
          className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700 disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={cargando || isSubmitting}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {cargando || isSubmitting ? 'Guardando...' : 'Registrar pago'}
        </button>
      </div>
    </form>
  )
}

export default PagoForm