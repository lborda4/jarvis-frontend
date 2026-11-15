// Keep fractional quantities (such as overtime) while removing empty decimals.
export function payrollQuantity(value: string): string {
  return value.replace(/([.,]\d*?)0+$/, '$1').replace(/[.,]$/, '')
}
