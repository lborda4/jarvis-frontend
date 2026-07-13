import type { ImportBalanceTrialResponse } from '../types/siigo'

export function formatBalanceTrialSuccessMessage(
  response: ImportBalanceTrialResponse,
): string {
  return [
    'Importación completada correctamente.',
    `Filas procesadas: ${response.processedRows}.`,
    `Proveedores creados: ${response.suppliersCreated}.`,
    `Proveedores actualizados: ${response.suppliersUpdated}.`,
    `Cuentas agregadas: ${response.accountsAdded}.`,
    `Cuentas duplicadas omitidas: ${response.duplicatedAccounts}.`,
  ].join(' ')
}
