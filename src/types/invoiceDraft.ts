import type { InvoiceAttachment } from '../services/invoiceAttachmentService'
import type { JarvisSeller } from '../services/jarvisSellerService'
import type { PaymentEntry } from '../utils/paymentBalance'
import type { SalesInvoicePriceOption } from '../utils/salesInvoicePrices'
import type { JarvisTercero } from './jarvis'

export interface InvoiceDraftLine {
  notes?: string
  id: string
  productSearch: string
  code?: string
  description: string
  quantity: string
  unitValue: string
  priceOptions: SalesInvoicePriceOption[]
  selectedPriceId: string
  discount: string
  taxChargeId: string
  taxRetentionId: string
  taxPercent: string
}
export type InvoiceDraftCustomer = Pick<JarvisTercero, 'id' | 'document_type' | 'document_number' | 'name'> & { check_digit?: string | null }

export interface InvoiceDraftState {
  sourceInvoiceId?: string | null
  attachment?: InvoiceAttachment
  documentTotal?: number
  selectedSellers?: JarvisSeller[]
  selectedCustomer: InvoiceDraftCustomer | null
  customerQuery: string
  issueDate: string
  dueDate: string
  currency: string
  notes: string
  headNote: string
  footNote: string
  discountIsPercent: boolean
  generalDiscount: string
  lines: InvoiceDraftLine[]
  paymentFormId: string
  paymentEntries: PaymentEntry[]
  reteIcaId: string
  reteIvaId: string
  billingNumber: string
  billingUuid: string
  billingDate: string
  reasonCode: string
  reasonDescription: string
  seze: string
}
