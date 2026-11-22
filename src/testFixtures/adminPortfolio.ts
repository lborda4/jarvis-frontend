import type { AdminPlan } from '../types/admin'

export const portfolioPlans: AdminPlan[] = [
  { id: 'server-initial', code: 'jarvis_billing_initial_annual', name: 'Inscripción inicial de facturación', provider: 'JARVIS', documentLimit: 50, includedDocumentTypes: [], commercialTerms: { priceCop: 139900, billingMonths: 12, employeeLimit: null, modules: ['BILLING'], includesDigitalCertificate: true, includesRadian: true } },
  { id: 'server-regular', code: 'jarvis_billing_regular_annual', name: 'Inscripción regular de facturación', provider: 'JARVIS', documentLimit: 25, includedDocumentTypes: [], commercialTerms: { priceCop: 139900, billingMonths: 12, employeeLimit: null, modules: ['BILLING'], includesDigitalCertificate: true, includesRadian: true } },
  { id: 'server-payroll', code: 'jarvis_payroll_basic_annual', name: 'Nómina electrónica básica', provider: 'JARVIS', documentLimit: null, includedDocumentTypes: [], commercialTerms: { priceCop: 129900, billingMonths: 12, employeeLimit: 2, modules: ['PAYROLL'], includesDigitalCertificate: true, includesRadian: false } },
  { id: 'server-combo', code: 'jarvis_compliance_initial_annual', name: 'Combo cumplimiento inicial', provider: 'JARVIS', documentLimit: 50, includedDocumentTypes: [], commercialTerms: { priceCop: 230000, billingMonths: 12, employeeLimit: 2, modules: ['BILLING', 'PAYROLL'], includesDigitalCertificate: true, includesRadian: true } },
  { id: 'server-unlimited', code: 'jarvis_compliance_unlimited_annual', name: 'Combo cumplimiento ilimitado', provider: 'JARVIS', documentLimit: null, includedDocumentTypes: [], commercialTerms: { priceCop: 720000, billingMonths: 12, employeeLimit: null, modules: ['BILLING', 'PAYROLL'], includesDigitalCertificate: true, includesRadian: true } },
]
