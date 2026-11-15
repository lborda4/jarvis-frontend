import type { ReactNode } from 'react'
import type { PayrollMonth } from './payrollMonths'
import { currency } from './payrollDefaults'

export default function PayrollMonthAccordion({ month, children, onReview }: { month: PayrollMonth; children: ReactNode; onReview: () => void }) {
  return <details className="payroll-period payroll-month">
    <summary className="payroll-month__heading">
      <span className="payroll-period__name"><strong>{month.label}</strong><span>{month.employees.length} empleados · Nómina mensual</span></span>
      <span className="payroll-period__net"><small>Neto del mes</small><strong>{currency(month.net)}</strong></span>
      <span className={`payroll__badge payroll__badge--${month.status}`}>{month.statusLabel}</span>
    </summary>
    <div className="payroll-month__body">
      <div className="payroll-period__toolbar"><div><h2>Períodos del mes</h2><p>Guarda las quincenas y luego revisa el acumulado mensual.</p></div><button className="payroll__button payroll__button--primary" onClick={onReview}>Revisar nómina del mes</button></div>
      <div className="payroll-month__periods">{children}</div>
    </div>
  </details>
}
