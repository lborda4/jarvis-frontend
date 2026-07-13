export interface SiigoAccountOption {
  code: string
  description: string
}

// Este catálogo será reemplazado posteriormente por una integración con el plan de cuentas de Siigo.
export const SIIGO_ACCOUNT_CATALOG: SiigoAccountOption[] = [
  { code: '513595', description: 'Servicios de software' },
  { code: '513525', description: 'Servicios tecnológicos' },
  { code: '513530', description: 'Honorarios' },
  { code: '513550', description: 'Publicidad' },
  { code: '519595', description: 'Gastos diversos' },
  { code: '52056601', description: 'Gastos operacionales de administración' },
]

export function formatAccountOptionLabel(account: SiigoAccountOption): string {
  return `${account.code} - ${account.description}`
}

export function findAccountByCode(code: string): SiigoAccountOption | undefined {
  return SIIGO_ACCOUNT_CATALOG.find((account) => account.code === code)
}
