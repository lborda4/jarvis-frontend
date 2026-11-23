export type ClientStatus = 'VERIFY_PAYMENT' | 'PAID' | 'ACTIVE'
export const CLIENT_STATUS_LABELS: Record<ClientStatus, string> = {
  VERIFY_PAYMENT: 'Verificar pago',
  PAID: 'Pagado',
  ACTIVE: 'Activo',
}
