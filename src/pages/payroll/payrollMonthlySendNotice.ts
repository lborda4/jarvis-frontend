export function payrollMonthlySendNotice(statuses: readonly string[], total: number) {
  const accepted = statuses.filter(status => status === 'ACCEPTED').length
  const rejected = statuses.filter(status => status === 'REJECTED').length
  const pending = statuses.length - accepted - rejected
  const remaining = total - statuses.length
  const success = accepted === total && total > 0
  return {
    variant: success ? 'success' as const : 'error' as const,
    title: success ? 'Nómina enviada correctamente' : 'Error en el envío de nómina',
    message: [
      `${accepted} de ${total} ${total === 1 ? 'documento aceptado' : 'documentos aceptados'} por la DIAN.`,
      rejected > 0 ? `${rejected} con error.` : '',
      pending > 0 ? `${pending} pendientes de confirmación; revisa su resultado antes de reenviar.` : '',
      remaining > 0 ? `${remaining} sin procesar.` : '',
    ].filter(Boolean).join(' '),
  }
}
