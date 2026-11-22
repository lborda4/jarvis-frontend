import type { AdvisorSale } from '../types/advisor'
import { trackingCsvCell } from './companyTracking'

export function filterCommercialSales(rows: AdvisorSale[], search: string, provider = '', kind = ''): AdvisorSale[] {
  const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim()
  const query = normalize(search)
  return rows.filter(sale => (!provider || sale.provider === provider) && (!kind || sale.kind === kind) && normalize(`${sale.companyName} ${sale.companyNit} ${sale.advisorName} ${sale.productName}`).includes(query))
}

export function commercialSalesCsv(rows: AdvisorSale[]): string {
  const date = (value: string) => new Date(value).toLocaleDateString('es-CO', { timeZone: 'America/Bogota' })
  const columns = ['Cliente', 'NIT', 'Asesor', 'Integración', 'Producto', 'Tipo', 'Venta COP', 'Comisión %', 'Comisión COP', 'Estado', 'Fecha de venta', 'Fecha de pago']
  return '\uFEFF' + [columns, ...rows.map(sale => [sale.companyName, sale.companyNit, sale.advisorName, sale.provider, sale.productName, sale.kind === 'TOP_UP' ? 'Recarga' : sale.commissionStage === 'RENEWAL' ? 'Renovación' : 'Plan', String(sale.priceCop), String(sale.commissionRate), String(sale.commissionCop), sale.paidAt ? 'Pagado' : 'Pendiente', date(sale.createdAt), sale.paidAt ? date(sale.paidAt) : ''])].map(row => row.map(trackingCsvCell).join(';')).join('\r\n')
}
