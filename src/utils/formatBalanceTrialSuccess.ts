import type { ImportBalanceTrialResponse } from '../types/siigo'

export const BALANCE_TRIAL_IMPORT_ERROR_MESSAGE =
  'Error al importar balance de prueba general'

export function formatBalanceTrialSuccessMessage(
  response: ImportBalanceTrialResponse,
): string {
  return [
    'Importación completada correctamente.',
    `Años consultados: ${response.yearsProcessed}.`,
    `Cuentas procesadas: ${response.processedRows}.`,
    `Cuentas creadas: ${response.accountsCreated}.`,
    `Cuentas actualizadas: ${response.accountsUpdated}.`,
    `Filas duplicadas omitidas: ${response.skippedRows}.`,
  ].join(' ')
}
