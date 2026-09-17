import type { ImportSiigoAccountsResponse } from '../types/siigo'

export const ACCOUNTS_IMPORT_ERROR_MESSAGE =
  'No se pudo importar el archivo de cuentas contables.'

/** Reemplaza a formatBalanceTrialSuccessMessage: sin "años consultados",
 * porque las cuentas ya no se deducen del Balance de Prueba sino que vienen
 * en el Excel que sube el contador. */
export function formatAccountsImportSuccessMessage(
  response: ImportSiigoAccountsResponse,
): string {
  return [
    'Importación completada correctamente.',
    `Cuentas procesadas: ${response.processedRows}.`,
    `Cuentas creadas: ${response.accountsCreated}.`,
    `Cuentas actualizadas: ${response.accountsUpdated}.`,
    `Filas omitidas: ${response.skippedRows}.`,
  ].join(' ')
}
