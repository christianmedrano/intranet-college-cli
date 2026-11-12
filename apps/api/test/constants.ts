/**
 * Constantes compartidas para pruebas de integración.
 *
 * La institución fija `00000000-0000-4000-8000-000000000001` es sembrada por
 * `limpiarBaseDePruebas` en `test/helpers/test-db.ts`. Todos los tests deben
 * colgar sus datos de ella en lugar de crear su propia institución.
 */
export const INSTITUCION_ID = '00000000-0000-4000-8000-000000000001'