import type { AuthCompany } from '../types/auth'
import type { PurchaseInvoiceDownload } from '../types/electronicDocument'
import type { JarvisCredentialsStatusResponse } from '../types/jarvis'
import type { InvoiceAppearance } from './invoiceAppearance'

export function invoiceAppearanceSample(company: AuthCompany, settings: Partial<JarvisCredentialsStatusResponse>, appearance: InvoiceAppearance, logoDataUrl: string | null): PurchaseInvoiceDownload {
  return {
    id: 'invoice-appearance-sample', documentKind: 'ELECTRONIC_INVOICE', isDraft: true, isPreviewSample: true,
    invoiceAppearance: appearance, logoDataUrl, invoiceNumber: 'DEMO-001', prefix: 'DEMO',
    cufe: '', dianQrText: '', dianQrUrl: '', issueDate: '2026-01-15', dueDate: null, isCreditPayment: false,
    paymentMethodName: 'Transferencia bancaria', currency: 'COP', observations: 'Datos de ejemplo para revisar el diseño de tu factura.',
    issuer: {
      name: settings.business_name || company.name, tradeName: settings.trade_name, documentType: 'NIT', documentNumber: company.nit,
      checkDigit: null, address: settings.address || 'Calle 10 # 20-30', phone: settings.phone || '300 000 0000',
      email: settings.email || 'empresa@example.com', cityName: settings.city || 'Bogotá',
    },
    buyer: { name: 'Cliente de ejemplo S.A.S.', documentType: 'NIT', documentNumber: '900000000', checkDigit: null,
      address: 'Carrera 15 # 40-20', phone: '300 111 1111', email: 'cliente@example.com', cityName: 'Bogotá' },
    items: [
      { name: 'Servicio profesional', description: 'Asesoría y acompañamiento', code: 'SRV-01', quantity: 1, unitValue: 200000, discount: 0, ivaPercentage: 19, ivaAmount: 38000, total: 200000, taxes: [{ type: 'IVA', amount: 38000 }] },
      { name: 'Producto de ejemplo', description: 'Producto de referencia', code: 'PRD-01', quantity: 2, unitValue: 50000, discount: 0, ivaPercentage: 19, ivaAmount: 19000, total: 100000, taxes: [{ type: 'IVA', amount: 19000 }] },
    ],
    subtotal: 300000, taxExclusiveAmount: 300000, taxInclusiveAmount: 357000, iva: 57000, total: 357000, discount: 0,
    taxes: [{ type: 'IVA', amount: 57000 }], withholdings: [],
  }
}
