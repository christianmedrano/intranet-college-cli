import { useEffect, useState, useCallback } from 'react'
import { PagoForm } from './PagoForm'

/** Opción de alumno para el selector. */
export interface AlumnoOpcion {
  id: string
  codigoAlumno: string
  nombres: string
  apellidos: string
}

/** Página para crear un nuevo pago (wrapper que provee catálogos a PagoForm). */
export function PagoNuevoPage() {
  const [alumnos, setAlumnos] = useState<AlumnoOpcion[]>([])
  const [cargandoAlumnos, setCargandoAlumnos] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargarAlumnos = useCallback(async () => {
    try {
      const response = await fetch('/api/v1/alumnos?pageSize=1000', {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      })
      if (response.ok) {
        const data = await response.json()
        setAlumnos(data.data)
      }
    } catch {
      setError('No se pudieron cargar los alumnos')
    } finally {
      // Loading state handled by caller
    }
  }, [])

  const cargarConEstado = useCallback(async () => {
    setCargandoAlumnos(true)
    setError(null)
    await cargarAlumnos()
    setCargandoAlumnos(false)
  }, [cargarAlumnos])

  useEffect(() => {
    const mountedRef = { current: true }
    const ejecutarCarga = async () => {
      await cargarConEstado()
    }
    if (mountedRef.current) {
      ejecutarCarga()
    }
    return () => {
      mountedRef.current = false
    }
  }, [cargarConEstado])

  const handleGuardado = (mensaje?: string) => {
    alert(mensaje ?? 'Pago registrado correctamente')
    window.history.back()
  }

  const handleCancelar = () => {
    window.history.back()
  }

  if (cargandoAlumnos) {
    return (
      <div className="p-8 text-center text-slate-500">
        Cargando alumnos...
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8 text-center text-red-600">
        {error}
      </div>
    )
  }

  return (
    <PagoForm
      alumnos={alumnos}
      onGuardado={handleGuardado}
      onCancelar={handleCancelar}
    />
  )
}