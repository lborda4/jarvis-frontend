import { Link } from 'react-router-dom'
import { MarketingHeader, MarketingFooter } from '../components/MarketingShell'
import { WHATSAPP_DEMO_HREF } from '../constants/contact'
import { MARKETING_FAQS } from '../marketing/content'
import { BILLING_PLANS, PAYROLL_PLAN } from '../marketing/catalog'
import { ComplianceCombos } from '../components/PortfolioPricing'
import './SolutionLanding.css'

type IconName = 'invoice' | 'people' | 'gear' | 'shield' | 'support' | 'bolt' | 'growth'
function SolutionIcon({ name }: { name: IconName }) {
  return <svg className={`solution-icon solution-icon--${name}`} viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {name === 'invoice' && <><path d="M29 5H11a3 3 0 0 0-3 3v32a3 3 0 0 0 3 3h16M29 5l9 9H29V5Zm9 9v12M16 17h13M16 24h13M16 31h8" /><circle cx="35" cy="36" r="9" className="solution-icon__fill" /><path d="m31 36 3 3 5-6" className="solution-icon__check" /></>}
    {name === 'people' && <><circle cx="17" cy="13" r="7" /><circle cx="36" cy="17" r="5" /><path d="M4 42V35c0-12 26-12 26 0v7H4Zm30-15c8 0 11 4 11 9v6H35" /></>}
    {name === 'gear' && <><path d="m19 5-1 5-5 2-5-2-5 8 4 4v5l-4 4 5 8 5-2 5 2 1 5h10l1-5 5-2 5 2 5-8-4-4v-5l4-4-5-8-5 2-5-2-1-5H19Z" /><circle cx="24" cy="25" r="9" className="solution-icon__accent" /></>}
    {name === 'shield' && <><path d="m24 4 17 7v12c0 10-7 17-17 22C14 40 7 33 7 23V11l17-7Z" /><path d="m16 24 6 6 11-13" /></>}
    {name === 'support' && <><path d="M7 27v-6a17 17 0 0 1 34 0v6M41 35c0 7-9 9-15 9" /><rect x="3" y="23" width="8" height="14" rx="4" /><rect x="37" y="23" width="8" height="14" rx="4" /><rect x="20" y="40" width="9" height="6" rx="3" /></>}
    {name === 'bolt' && <path d="m27 3-19 25h14l-2 17 20-26H26l1-16Z" />}
    {name === 'growth' && <><rect x="5" y="30" width="7" height="13" rx="1" /><rect x="21" y="20" width="7" height="23" rx="1" /><rect x="37" y="7" width="7" height="36" rx="1" /></>}
  </svg>
}

const benefits: { icon: IconName; title: string; description: string }[] = [
  { icon: 'shield', title: 'Cumplimiento normativo', description: 'Siempre actualizado' },
  { icon: 'support', title: 'Acompañamiento experto', description: 'En todo el proceso' },
  { icon: 'bolt', title: 'Implementación ágil', description: 'Empieza en poco tiempo' },
  { icon: 'growth', title: 'Tu negocio más eficiente', description: 'Desde un solo lugar' },
]

export default function SolutionLanding() {
  return <div className="solution-landing">
    <MarketingHeader home />

    <main id="contenido">
      <section className="solution-plans" aria-labelledby="solution-title">
        <div className="solution-intro"><span className="solution-eyebrow">Facturación · Nómina · Contabilidad</span><h1 id="solution-title">Elige tu solución <span>JARVIS</span></h1><p>Factura ante la DIAN, envía tu nómina electrónica o agiliza la causación en Siigo. Elige lo que necesita tu negocio; te acompañamos a ponerlo en marcha.</p></div>
        <div className="solution-cards" id="precios">
          <article className="solution-card solution-card--featured" aria-labelledby="billing-title">
            <header className="solution-card__heading"><SolutionIcon name="invoice" /><h2 id="billing-title">Facturación<br />Electrónica</h2></header>
            <p className="solution-card__description">Para emitir tus facturas y documentos electrónicos ante la DIAN.</p>
            <div className="solution-card__body">
              <p className="solution-card__integration">Valor anual</p>
              <p className="solution-price">{BILLING_PLANS[0].price}<span>/año</span></p>
              <p className="solution-card__terms">Valores en pesos colombianos (COP)</p>
              <ul className="solution-features">
                <li><strong className="solution-highlight">50 documentos en tu primera inscripción</strong></li>
                <li>Emisión y envío de facturas</li><li><strong>Certificado digital incluido</strong></li><li>Acompañamiento personalizado</li>
                <li><strong>Documento soporte, RADIAN y notas de ajuste</strong></li>
              </ul>
              <Link className="solution-button solution-card__cta" to="/facturacion-electronica" aria-label="Conocer más sobre facturación electrónica">Conocer más</Link>
            </div>
          </article>
          <article className="solution-card" id="nomina" aria-labelledby="payroll-title">
            <header className="solution-card__heading"><SolutionIcon name="people" /><h2 id="payroll-title">Nómina<br />Electrónica</h2></header>
            <p className="solution-card__description">Para generar y enviar la nómina electrónica de tus empleados a la DIAN.</p>
            <div className="solution-card__body">
              <p className="solution-card__integration">Valor anual</p>
              <p className="solution-price">{PAYROLL_PLAN.price}<span>/año</span></p>
              <p className="solution-card__terms">Valores en pesos colombianos (COP)</p>
              <ul className="solution-features"><li><strong>Hasta 2 empleados</strong></li><li>Generación y envío a la DIAN</li><li><strong>Certificado digital incluido</strong></li><li>Recargas de empleados disponibles</li><li>Acompañamiento personalizado</li></ul>
              <Link className="solution-button solution-card__cta" to="/nomina-electronica" aria-label="Conocer más sobre nómina electrónica">Conocer más</Link>
            </div>
          </article>
          <article className="solution-card solution-card--automation" aria-labelledby="automation-title">
            <header className="solution-card__heading"><SolutionIcon name="gear" /><h2 id="automation-title">Causación<br />automática</h2></header>
            <p className="solution-card__description">Para llevar la información de la DIAN a tu operación contable en Siigo.</p>
            <div className="solution-card__body">
              <p className="solution-card__integration">Integración con Siigo</p>
              <p className="solution-price">$35.000<span>/mes</span></p>
              <p className="solution-card__terms">Plan inicial · Pago mensual en COP</p>
              <ul className="solution-features"><li><strong>Carga de información directa desde la DIAN</strong></li><li>Generación de PDF de la DIAN</li><li>RADIAN masivo (carga por Excel y CUFE)</li><li>Acompañamiento en la causación</li></ul>
              <Link className="solution-button solution-button--outline solution-card__cta" to="/siigo" aria-label="Conocer más sobre causación automática">Conocer más</Link>
            </div>
          </article>
        </div>
        <p className="solution-price-note">Facturación, nómina y combos con valor anual. Valores en pesos colombianos (COP). Facturación regular: 25 documentos incluidos; los 50 de obsequio aplican solo en la primera inscripción.</p>
        <ComplianceCombos />
      </section>

      <section className="solution-benefits" id="acompanamiento" aria-label="Beneficios de JARVIS">{benefits.map(benefit => <div key={benefit.title}><SolutionIcon name={benefit.icon} /><p><strong>{benefit.title}</strong><span>{benefit.description}</span></p></div>)}</section>
      <section className="solution-more" id="integraciones" aria-labelledby="integration-title"><div><span className="solution-eyebrow">Conecta tu operación</span><h2 id="integration-title">Tus soluciones, en un solo lugar</h2><p>Emite tus documentos electrónicos desde JARVIS, directamente con la DIAN. Si ya trabajas con Siigo, conecta tu cuenta para agilizar tu operación contable.</p></div><div className="solution-more__links"><Link to="/facturacion-electronica#precios">Ver planes de facturación <span aria-hidden="true">↗</span></Link><Link to="/siigo">Conocer la integración con Siigo <span aria-hidden="true">↗</span></Link><a href={WHATSAPP_DEMO_HREF} target="_blank" rel="noopener noreferrer">Hablar con un asesor <span aria-hidden="true">↗</span></a></div></section>
      <section className="solution-faq" aria-labelledby="solution-faq-title"><h2 id="solution-faq-title">Te ayudamos a elegir</h2>{MARKETING_FAQS.home.map(faq => <details key={faq.question}><summary>{faq.question}</summary><p>{faq.answer}</p></details>)}</section>
    </main>
    <MarketingFooter />
  </div>
}
