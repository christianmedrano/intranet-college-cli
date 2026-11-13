import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { crearMensajeSchema, type CrearMensajeInput } from '@intranet/shared'
import { mensajeError } from '../shared/formato'
import { AdjuntosUpload } from '../shared/AdjuntosUpload'

interface MensajeFormProps {
  seccionId: string
  onEnviado: (mensaje?: string) => void
  onCancelar?: () => void
}

export function MensajeForm({ seccionId, onEnviado, onCancelar }: MensajeFormProps) {
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CrearMensajeInput>({
    resolver: zodResolver(crearMensajeSchema),
    mode: 'onChange',
  })

  const handleSubmitForm = async (data: CrearMensajeInput) => {
    setCargando(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('cuerpo', data.cuerpo)

      const respuesta = await fetch(`/api/v1/secciones/${seccionId}/mensajes`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })

      if (!respuesta.ok) {
        const error = await respuesta.json().catch(() => ({}))
        throw new Error(error.error?.message ?? 'Error al enviar mensaje')
      }

      onEnviado('Mensaje enviado')
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setCargando(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(handleSubmitForm)} className="space-y-4" noValidate>
      {/* Cuerpo del mensaje */}
      <div>
        <label htmlFor="cuerpo" className="block text-sm font-medium text-slate-700 mb-1">
          Mensaje <span className="text-red-500" aria-hidden="true">*</span>
        </label>
        <textarea
          id="cuerpo"
          {...register('cuerpo')}
          rows={4}
          className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.cuerpo ? 'border-red-500' : 'border-slate-300'
          }`}
          aria-invalid={errors.cuerpo ? 'true' : 'false'}
          aria-describedby={errors.cuerpo ? 'cuerpo-error' : undefined}
          placeholder="Escribe tu mensaje aquí..."
        />
        {errors.cuerpo && (
          <p id="cuerpo-error" className="mt-1 text-sm text-red-600" role="alert">
            {errors.cuerpo.message}
          </p>
        )}
        <p className="mt-1 text-xs text-slate-500">Máx. 5,000 caracteres.</p>
      </div>

      {/* Adjuntos */}
      <AdjuntosUpload
        adjuntosExistentes={[]}
        onAgregar={() => {}}
        onEliminar={() => {}}
        maxArchivos={3}
        deshabilitado={cargando}
        textoDrop="Arrastra adjuntos o haz clic para seleccionar"
      />

      {/* Acciones */}
      <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
        {onCancelar && (
          <button
            type="button"
            onClick={onCancelar}
            disabled={cargando}
            className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700 disabled:opacity-50"
          >
            Cancelar
          </button>
        )}
        <button
          type="submit"
          disabled={cargando}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {cargando ? 'Enviando...' : 'Enviar mensaje'}
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm" role="alert">
          {error}
        </div>
      )}
    </form>
  )
}

export default MensajeForm