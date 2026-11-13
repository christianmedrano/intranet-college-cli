import type {
  TipoCertificado,
  EstadoCertificado,
} from '@intranet/shared'

/**
 * Formatea un monto en PEN a formato monetario local (S/ xxx.xx).
 * Redondea a 2 decimales.
 */
export function formatoMoneda(monto: number): string {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(monto)
}

/**
 * Formatea una fecha ISO a formato local corto (dd/mm/yyyy).
 */
export function formatoFecha(fechaISO: string): string {
  const fecha = new Date(fechaISO)
  return fecha.toLocaleDateString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

/**
 * Formatea una fecha ISO a formato local con hora (dd/mm/yyyy HH:MM).
 */
export function formatoFechaHora(fechaISO: string): string {
  const fecha = new Date(fechaISO)
  return fecha.toLocaleString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

/**
 * Formatea un número de certificado para visualización (CERT-TIPO-AÑO-SEQ).
 * Ejemplo: CERT-ESTUDIOS-2026-0042
 */
export function formatoNumeroCertificado(numero: string): string {
  // El número ya viene con formato CERT-{TIPO}-{AÑO}-{SEQ}
  return numero
}

/**
 * Traduce un tipo de certificado a texto legible en español.
 */
export function etiquetaTipoCertificado(tipo: TipoCertificado): string {
  const etiquetas: Record<TipoCertificado, string> = {
    ESTUDIOS: 'Certificado de Estudios',
    MATRICULA: 'Certificado de Matrícula',
    NO_ADEUDO: 'Certificado de No Adeudo',
    CONDUCTA: 'Certificado de Conducta',
    OTRO: 'Otro Certificado',
  }
  return etiquetas[tipo] ?? tipo
}

/**
 * Traduce un estado de certificado a texto legible en español.
 */
export function etiquetaEstadoCertificado(estado: EstadoCertificado): string {
  const etiquetas: Record<EstadoCertificado, string> = {
    BORRADOR: 'Borrador',
    SOLICITADO: 'Solicitado',
    APROBADO: 'Aprobado',
    RECHAZADO: 'Rechazado',
    EMITIDO: 'Emitido',
    ANULADO: 'Anulado',
  }
  return etiquetas[estado] ?? estado
}

/**
 * Devuelve la clase CSS de color para un estado de certificado.
 * Útil para badges/chips de estado.
 */
export function colorEstadoCertificado(estado: EstadoCertificado): string {
  const colores: Record<EstadoCertificado, string> = {
    BORRADOR: 'bg-slate-100 text-slate-700 border-slate-200',
    SOLICITADO: 'bg-blue-100 text-blue-700 border-blue-200',
    APROBADO: 'bg-green-100 text-green-700 border-green-200',
    RECHAZADO: 'bg-red-100 text-red-700 border-red-200',
    EMITIDO: 'bg-purple-100 text-purple-700 border-purple-200',
    ANULADO: 'bg-slate-100 text-slate-500 border-slate-200',
  }
  return colores[estado] ?? 'bg-slate-100 text-slate-700 border-slate-200'
}

/**
 * Traduce un concepto de pago a texto legible en español.
 */
export function etiquetaConceptoPago(concepto: string): string {
  const etiquetas: Record<string, string> = {
    CUOTA_MENSUAL: 'Cuota Mensual',
    MATRICULA: 'Matrícula',
    CERTIFICADO: 'Certificado',
    OTRO: 'Otro',
  }
  return etiquetas[concepto] ?? concepto
}

/**
 * Traduce un método de pago a texto legible en español.
 */
export function etiquetaMetodoPago(metodo: string): string {
  const etiquetas: Record<string, string> = {
    EFECTIVO: 'Efectivo',
    TRANSFERENCIA: 'Transferencia',
    DEPOSITO: 'Depósito',
    OTRO: 'Otro',
  }
  return etiquetas[metodo] ?? metodo
}

/**
 * Traduce un estado de pago a texto legible en español.
 */
export function etiquetaEstadoPago(estado: string): string {
  const etiquetas: Record<string, string> = {
    REGISTRADO: 'Registrado',
    ANULADO: 'Anulado',
  }
  return etiquetas[estado] ?? estado
}

/**
 * Devuelve la clase CSS de color para un estado de pago.
 */
export function colorEstadoPago(estado: string): string {
  const colores: Record<string, string> = {
    REGISTRADO: 'bg-green-100 text-green-700 border-green-200',
    ANULADO: 'bg-slate-100 text-slate-500 border-slate-200',
  }
  return colores[estado] ?? 'bg-slate-100 text-slate-700 border-slate-200'
}

/**
 * Traduce un estado de matrícula a texto legible en español.
 */
export function etiquetaEstadoMatricula(estado: string): string {
  const etiquetas: Record<string, string> = {
    SOLICITADA: 'Solicitada',
    APROBADA: 'Aprobada',
    RECHAZADA: 'Rechazada',
    RETIRADA: 'Retirada',
    ANULADA: 'Anulada',
  }
  return etiquetas[estado] ?? estado
}

/**
 * Devuelve la clase CSS de color para un estado de matrícula.
 */
export function colorEstadoMatricula(estado: string): string {
  const colores: Record<string, string> = {
    SOLICITADA: 'bg-blue-100 text-blue-700 border-blue-200',
    APROBADA: 'bg-green-100 text-green-700 border-green-200',
    RECHAZADA: 'bg-red-100 text-red-700 border-red-200',
    RETIRADA: 'bg-amber-100 text-amber-700 border-amber-200',
    ANULADA: 'bg-slate-100 text-slate-500 border-slate-200',
  }
  return colores[estado] ?? 'bg-slate-100 text-slate-700 border-slate-200'
}

/**
 * Trunca un texto a una longitud máxima añadiendo puntos suspensivos.
 */
export function truncarTexto(texto: string, max: number): string {
  if (texto.length <= max) return texto
  return `${texto.slice(0, max - 3)}...`
}

/**
 * Genera un mensaje de error amigable a partir de un error de la API.
 */
export function mensajeError(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return 'Ocurrió un error inesperado.'
}