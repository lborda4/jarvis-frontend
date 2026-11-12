import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { MarketingFooter, MarketingHeader } from '../components/MarketingShell'
import { buildWhatsappHref } from '../constants/contact'
import { applyMarketingSeo } from '../marketing/seo'
import { PAYROLL_PLAN } from '../marketing/catalog'
import { ComplianceCombos, PayrollTopUps } from '../components/PortfolioPricing'
import './PayrollLandingPage.css'
import PricingPeriodToggle from '../components/PricingPeriodToggle'
import { periodicPrice, type PricingPeriod } from '../marketing/pricingPeriod'

const planHref = buildWhatsappHref(`Hola, me interesa el plan anual de nómina electrónica JARVIS para hasta 2 empleados por ${PAYROLL_PLAN.price} COP al año`)
const advisorHref = buildWhatsappHref('Hola, quiero orientación sobre la nómina electrónica de JARVIS para mi empresa')
const navigation = [
  { href: '#precios', label: 'El plan' },
  { href: '#como-funciona', label: 'Cómo funciona' },
  { href: '#acompanamiento', label: 'Acompañamiento' },
  { href: '#preguntas-frecuentes', label: 'Preguntas frecuentes' },
]
const steps = [
  { title: 'Configura tu empresa y tus empleados', text: 'Registra la información de tu empresa y de las personas a quienes les enviarás la nómina.' },
  { title: 'Prepara y revisa el periodo', text: 'Ingresa la información de la nómina y revisa los datos antes de enviarla.' },
  { title: 'Envía y consulta tus documentos', text: 'Realiza el envío de la nómina electrónica y consulta sus documentos desde Jarvis.' },
]
const faqs = [
  { question: '¿Cuánto cuesta el plan?', answer: `El plan cuesta ${PAYROLL_PLAN.price} COP al año para hasta 2 empleados. Incluye la generación y el envío de nómina electrónica a la DIAN y permite ampliar tu equipo con recargas.` },
  { question: '¿Incluye certificado digital?', answer: 'Sí. El plan incluye certificado digital y acompañamiento personalizado para la nómina electrónica.' },
  { question: '¿Puedo contratar solo nómina electrónica?', answer: 'Sí. Puedes elegir la solución de nómina sin contratar los planes de facturación o causación automática.' },
  { question: '¿Qué hago si tengo más de 2 empleados?', answer: 'Puedes agregar empleados con recargas de 1, 2, 3, 5, 10 o 20 empleados adicionales. También puedes elegir el combo de cumplimiento ilimitado con facturación y nómina ilimitadas.' },
]

export default function PayrollLandingPage() {
  const [period, setPeriod] = useState<PricingPeriod>('month')
  const price = periodicPrice(PAYROLL_PLAN.amount, period)
  const { hash } = useLocation()

  useEffect(() => {
    document.documentElement.lang = 'es'
    return applyMarketingSeo('payroll')
  }, [])

  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView()
    else window.scrollTo(0, 0)
  }, [hash])

  return <div className="solution-landing payroll-landing">
    <MarketingHeader links={navigation} planHref="#precios" />
    <main id="contenido" className="payroll-landing__main">
      <nav className="payroll-landing__breadcrumb" aria-label="Ruta de navegación"><Link to="/">Inicio</Link><span aria-hidden="true">/</span><span aria-current="page">Nómina electrónica</span></nav>
      <section className="payroll-landing__hero" aria-labelledby="payroll-title">
        <div className="payroll-landing__intro">
          <span className="solution-eyebrow">Nómina electrónica Jarvis</span>
          <h1 id="payroll-title">La nómina de tu equipo,<br /><span>en orden cada mes.</span></h1>
          <p>Genera y envía tu nómina electrónica a la DIAN y cuenta con acompañamiento para poner todo en marcha.</p>
          <div className="payroll-landing__actions">
            <a className="solution-button" href="#precios">Conocer el plan anual</a>
            <a className="payroll-landing__text-link" href="#como-funciona">Así funciona <span aria-hidden="true">↓</span></a>
          </div>
        </div>
        <aside className="payroll-landing__plan" id="precios" aria-labelledby="payroll-plan-title">
          <PricingPeriodToggle period={period} onChange={setPeriod} />
          <span className="solution-eyebrow">{price.label}</span>
          <h2 id="payroll-plan-title">Nómina electrónica básica</h2>
          <p className="payroll-landing__price">{price.price} <span>COP {price.suffix}</span></p>
          <p className="payroll-landing__help">{price.terms}</p>
          <p className="payroll-landing__capacity">Hasta 2 empleados</p>
          <ul><li>Generación y envío a la DIAN</li><li>Certificado digital incluido</li><li>Recargas de empleados disponibles</li><li>Acompañamiento personalizado</li></ul>
          <a className="solution-button" href={planHref} target="_blank" rel="noopener noreferrer">Quiero este plan</a>
          <p className="payroll-landing__help">Hablemos de tu empresa y te orientamos para empezar.</p>
        </aside>
      </section>

      <PayrollTopUps />
      <ComplianceCombos period={period} />

      <section className="payroll-landing__workflow" id="como-funciona" aria-labelledby="payroll-workflow-title">
        <div><span className="solution-eyebrow">Del registro al envío</span><h2 id="payroll-workflow-title">Un proceso que puedes seguir.</h2><p>Trabaja la información de cada periodo desde un mismo lugar, con una revisión antes del envío.</p></div>
        <ol>{steps.map((step, index) => <li key={step.title}><span className="payroll-landing__step" aria-hidden="true">0{index + 1}</span><div><h3>{step.title}</h3><p>{step.text}</p></div></li>)}</ol>
      </section>

      <section className="payroll-landing__support" id="acompanamiento" aria-labelledby="payroll-support-title">
        <div>
          <span className="solution-eyebrow">Acompañamiento personalizado</span>
          <h2 id="payroll-support-title">Empieza con alguien a tu lado.</h2>
          <p>Te orientamos para poner en marcha la nómina electrónica de tu empresa y resolver tus dudas sobre el proceso.</p>
        </div>
        <div className="payroll-landing__support-contact">
          <p>Cuéntanos cómo es tu equipo y revisemos juntos lo que necesitas para empezar.</p>
          <a className="solution-button" href={advisorHref} target="_blank" rel="noopener noreferrer">Hablar con un asesor <span aria-hidden="true">↗</span></a>
          <span>Conversemos por WhatsApp</span>
        </div>
      </section>

      <section className="payroll-landing__questions" id="preguntas-frecuentes" aria-labelledby="payroll-faq-title">
        <div>
          <span className="solution-eyebrow">Antes de empezar</span>
          <h2 id="payroll-faq-title">Lo que incluye tu plan.</h2>
          <p>Si necesitas revisar tu caso, te ayudamos a resolver tus dudas antes de contratar.</p>
          <a className="payroll-landing__text-link" href={advisorHref} target="_blank" rel="noopener noreferrer">Consultar mi caso <span aria-hidden="true">↗</span></a>
        </div>
        <div>{faqs.map(faq => <details key={faq.question}><summary>{faq.question}</summary><p>{faq.answer}</p></details>)}</div>
      </section>
      <Link className="payroll-landing__back" to="/">← Ver todas las soluciones Jarvis</Link>
    </main>
    <MarketingFooter />
  </div>
}
