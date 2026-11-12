import { COMPLIANCE_COMBOS, PAYROLL_TOP_UPS } from '../marketing/catalog'
import { buildWhatsappHref } from '../constants/contact'
import './PortfolioPricing.css'

export function ComplianceCombos() {
  return <section className="portfolio-pricing" id="combos" aria-labelledby="combos-title">
    <div className="portfolio-pricing__intro"><p className="portfolio-pricing__eyebrow">Facturación + nómina</p><h2 id="combos-title">Combos de cumplimiento</h2><p>Elige las dos soluciones en un solo plan anual. Valores en pesos colombianos (COP).</p></div>
    <div className="portfolio-pricing__combos">{COMPLIANCE_COMBOS.map(combo => <article className="portfolio-pricing__card" key={combo.name}>
      <h3>{combo.name}</h3><p>{combo.description}</p>
      <p className="portfolio-pricing__price">{combo.price}<span> / año</span></p>
      <ul>{combo.features.map(feature => <li key={feature}>{feature}</li>)}</ul>
      <a className="portfolio-pricing__action" href={buildWhatsappHref(`Hola, me interesa el ${combo.name} de JARVIS por ${combo.price} COP al año: ${combo.capacity}`)} target="_blank" rel="noopener noreferrer">Consultar {combo.name.toLowerCase()}</a>
    </article>)}</div>
  </section>
}

export function PayrollTopUps() {
  return <section className="portfolio-pricing" id="recargas-nomina" aria-labelledby="payroll-topups-title">
    <div className="portfolio-pricing__intro"><p className="portfolio-pricing__eyebrow">Amplía tu equipo</p><h2 id="payroll-topups-title">Recargas de nómina electrónica</h2><p>Agrega empleados a tu nómina básica o al combo inicial. Cada precio corresponde a una recarga en COP.</p></div>
    <div className="portfolio-pricing__topups">{PAYROLL_TOP_UPS.map(pack => <a className="portfolio-pricing__topup" key={pack.employees}
      href={buildWhatsappHref(`Hola, quiero una recarga de nómina electrónica JARVIS de ${pack.employees} ${pack.employees === 1 ? 'empleado adicional' : 'empleados adicionales'} por ${pack.price} COP`)} target="_blank" rel="noopener noreferrer">
      <strong>{pack.employees} {pack.employees === 1 ? 'empleado' : 'empleados'}</strong><span>{pack.employees === 1 ? 'adicional' : 'adicionales'}</span><b>{pack.price}</b><span>Consultar recarga ↗</span>
    </a>)}</div>
  </section>
}
