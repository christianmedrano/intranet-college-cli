import { z } from 'zod'

/**
 * Actualización parcial de la institución (RF-CORE-001).
 *
 * Todos los campos son opcionales: `PATCH` solo cambia lo enviado. Los campos
 * opcionales del modelo admiten `null` para vaciarlos. `nombre` no puede ser
 * nulo ni vacío porque es el dato identificatorio de la institución.
 *
 * La regla "al menos un campo" evita peticiones que no cambian nada y que
 * devolverían un `200` engañoso.
 */
export const actualizarInstitucionSchema = z
  .object({
    nombre: z
      .string()
      .trim()
      .min(1, 'El nombre es obligatorio')
      .max(150, 'El nombre es demasiado largo')
      .optional(),
    direccion: z
      .string()
      .trim()
      .min(1, 'La dirección no puede estar vacía')
      .max(200, 'La dirección es demasiado larga')
      .nullable()
      .optional(),
    telefono: z
      .string()
      .trim()
      .min(1, 'El teléfono no puede estar vacío')
      .max(30, 'El teléfono es demasiado largo')
      .nullable()
      .optional(),
    email: z
      .email('El correo no es válido')
      .max(150, 'El correo es demasiado largo')
      .nullable()
      .optional(),
    logoUrl: z
      .url('El logo debe ser una URL válida')
      .max(500, 'La URL del logo es demasiado larga')
      .nullable()
      .optional(),
  })
  .refine((datos) => Object.keys(datos).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar',
  })

export type ActualizarInstitucionInput = z.infer<
  typeof actualizarInstitucionSchema
>
