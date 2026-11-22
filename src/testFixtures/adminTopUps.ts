import type { AdminJarvisTopUp } from '../types/admin'

export const topUpCatalog: AdminJarvisTopUp[] = [
  { code: 'documents_10', name: 'Recarga 10 documentos', kind: 'DOCUMENTS', units: 10, priceCop: 25000 },
  { code: 'documents_100', name: 'Recarga 100 documentos', kind: 'DOCUMENTS', units: 100, priceCop: 149000 },
  { code: 'payroll_1', name: 'Recarga 1 empleado', kind: 'PAYROLL_EMPLOYEES', units: 1, priceCop: 20000 },
  { code: 'payroll_5', name: 'Recarga 5 empleados', kind: 'PAYROLL_EMPLOYEES', units: 5, priceCop: 88000 },
]
