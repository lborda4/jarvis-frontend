import type { AdminCityOption, AdminJarvisTopUp, AdminPlan } from './admin'
export type CommissionClass = 'BASIC' | 'PLUS' | 'PRO'
export interface AdvisorClient { id: string; name: string; nit: string; createdAt: string; clientStatus?: import('../utils/clientLifecycle').ClientStatus | null; paymentStatus?: 'PAID' | 'PENDING'; plans: { name: string; provider: string }[] }
export interface AdvisorSale {
  id: string; advisorId: string; advisorName: string; companyId: string; companyName: string; companyNit: string;
  provider: string; kind: 'PLAN' | 'TOP_UP'; productName: string; priceCop: number; commissionClass: CommissionClass;
  commissionRate: number; commissionStage?: 'INITIAL' | 'RENEWAL'; commissionCop: number; createdAt: string; paidAt: string | null;
}
export interface CommissionReportData {
  month: string; paid: AdvisorSale[]; pending: AdvisorSale[]; totalSalesCop: number; totalCommissionCop: number;
  summary: { advisorId: string; advisorName: string; salesCop: number; commissionCop: number; paidSales: number }[];
}
export interface AdvisorDashboard { advisor: { id: string; name: string }; clients: AdvisorClient[]; commissions: CommissionReportData }
export interface AdvisorCatalog { plans: AdminPlan[]; cities: AdminCityOption[]; topUps: AdminJarvisTopUp[]; commissionRates: Record<CommissionClass, number>; renewalCommissionRates?: Record<CommissionClass, number>; topUpCommissionBasis: 'PLAN' | 'PRODUCT' | 'PENDING' }
