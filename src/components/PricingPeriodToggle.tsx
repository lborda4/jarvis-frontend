import type { PricingPeriod } from '../marketing/pricingPeriod'
import './PricingPeriodToggle.css'

export default function PricingPeriodToggle({ period, onChange }: { period: PricingPeriod; onChange: (period: PricingPeriod) => void }) {
  return <div className="pricing-period" role="group" aria-label="Periodo de los precios">
    <span>Ver precios por</span>
    <div className="pricing-period__options">
      <button type="button" aria-pressed={period === 'month'} onClick={() => onChange('month')}>Mes</button>
      <button type="button" aria-pressed={period === 'year'} onClick={() => onChange('year')}>Año</button>
    </div>
  </div>
}
