interface PaymentMethod { id: number; name?: string; code?: string | null }

export function employeePaymentType(id: number, methods: PaymentMethod[] = []): 'cash' | 'transfer' | undefined {
  const method = methods.find(method => method.id === id)
  if (!method) return undefined
  const code = String(method.code ?? '').trim()
  if (code === '10') return 'cash'
  if (code === '30') return 'transfer'
  const name = (method.name ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z]/g, '')
  if (name === 'efectivo') return 'cash'
  if (/^(consignacionbancaria|transferenciacredito|transfereciacredito|transferenciabancaria)$/.test(name)) return 'transfer'
  return undefined
}

export function employeeBankFields(employee: { bankName?: string; accountType?: string; accountNumber?: string }, type?: 'cash' | 'transfer') {
  return type === 'transfer' ? {
    bankName: employee.bankName?.trim() ?? '',
    accountType: employee.accountType?.trim().toUpperCase() ?? '',
    accountNumber: employee.accountNumber?.trim() ?? '',
  } : { bankName: '', accountType: '', accountNumber: '' }
}
