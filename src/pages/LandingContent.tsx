import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { CloseIcon, MenuIcon } from '../components/icons/SidebarIcons'
import { applyMarketingSeo } from '../marketing/seo'
import { BILLING_TOP_UPS, SIIGO_PLANS as PLANS, type Product, type MarketingProduct } from '../marketing/catalog'
import { BILLING_SOLUTIONS, MARKETING_FAQS, MARKETING_STEPS } from '../marketing/content'
import { buildWhatsappHref, WHATSAPP_DEMO_HREF } from '../constants/contact'
import PrivacyPolicyLink from '../components/PrivacyPolicyLink'
import './LandingPage.css'
import SolutionLanding from './SolutionLanding'
import PayrollLandingPage from './PayrollLandingPage'

const DEMO_HREF = WHATSAPP_DEMO_HREF

const NAV_LINKS = [
  { href: '/', label: 'Inicio' },
  { href: '/siigo', label: 'Para Siigo' },
  { href: '/facturacion-electronica', label: 'Facturación electrónica' },
  { href: '/nomina-electronica', label: 'Nómina electrónica' },
  { href: '#contacto', label: 'Contacto' },
] as const

const PRODUCTS = {
  siigo: {
    path: '/siigo',
    name: 'JARVIS para Siigo',
    eyebrow: 'Automatización + inteligencia artificial',
    audience: 'Ya tengo Siigo',
    description: 'Conecta tu Siigo con JARVIS y agiliza el cargue de documentos, la gestión de terceros y la revisión contable con ayuda de IA.',
    action: 'Quiero automatizar Siigo',
    demo: buildWhatsappHref('Hola, quiero una demo de JARVIS para automatizar mi operación en Siigo con IA'),
    icon: 'scale' as const,
    features: ['Cargue masivo a Siigo', 'Asistencia contable con IA', 'Gestión de terceros'],
  },
  billing: {
    path: '/facturacion-electronica',
    name: 'Facturación JARVIS',
    eyebrow: 'Emisión directa con la DIAN',
    audience: 'Quiero facturar electrónicamente',
    description: 'Factura de venta, documento soporte, notas débito, notas crédito y eventos RADIAN: gestiona tus documentos electrónicos desde JARVIS, directamente con la DIAN y sin necesidad de tener Siigo.',
    action: 'Quiero facturar con JARVIS',
    demo: buildWhatsappHref('Hola, quiero información sobre la facturación electrónica de JARVIS directa con la DIAN'),
    icon: 'invoice' as const,
    features: ['Factura de venta y documento soporte', 'Notas débito, notas crédito y RADIAN', 'Plan anual o facturación ilimitada mensual'],
  },
} satisfies Record<Product, object>

const SIIGO_SOLUTIONS = [
  {
    title: 'Cargue masivo de Documentos Soporte',
    description:
      'Sube cientos de documentos soporte desde Excel a SIIGO en minutos, con validaciones automáticas.',
    icon: 'docs' as const,
  },
  {
    title: 'Facturas de compra en Siigo',
    description:
      'Prepara, revisa y envía tus facturas de compra a Siigo desde un mismo flujo de trabajo.',
    icon: 'invoice' as const,
  },
  {
    title: 'Consulta de Terceros',
    description:
      'Consulta y gestiona información de terceros de forma rápida para agilizar tu operación contable.',
    icon: 'users' as const,
  },
  {
    title: 'Asistencia contable con IA',
    description:
      'Recibe sugerencias de clasificación contable para tus compras y revisa los datos antes de enviarlos a Siigo.',
    icon: 'scale' as const,
  },
]

const BENEFITS = [
  {
    title: 'Ahorra tiempo',
    description: 'Automatiza procesos repetitivos y libera horas de trabajo manual cada mes.',
    icon: 'clock' as const,
  },
  {
    title: 'Reduce errores',
    description: 'Validaciones automáticas antes del envío para minimizar fallos de digitación.',
    icon: 'shield' as const,
  },
  {
    title: 'Todo más organizado',
    description: 'Ten tus documentos y la información de tu operación a mano cuando los necesites.',
    icon: 'check' as const,
  },
  {
    title: 'Escalable',
    description: 'Crece el volumen de documentos sin aumentar el tamaño de tu equipo.',
    icon: 'scale' as const,
  },
]

const PLAN_FEATURES = [
  'Cargue masivo a SIIGO',
  'Sin límite de empresas',
  'Soporte incluido',
  'Sin costo de configuración',
]

type IconName =
  | 'docs'
  | 'invoice'
  | 'users'
  | 'payroll'
  | 'dian'
  | 'clock'
  | 'shield'
  | 'check'
  | 'scale'
  | 'arrow'

function Icon({ name }: { name: IconName }) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true as const,
    className: 'landing-icon',
  }

  switch (name) {
    case 'docs':
      return (
        <svg {...common}>
          <path d="M8 7h8M8 11h8M8 15h5" />
          <path d="M6 3h9l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
          <path d="M15 3v5h5" />
        </svg>
      )
    case 'invoice':
      return (
        <svg {...common}>
          <path d="M7 3h10a1 1 0 0 1 1 1v16l-3-2-3 2-3-2-3 2V4a1 1 0 0 1 1-1z" />
          <path d="M9 8h6M9 12h6M9 16h3" />
        </svg>
      )
    case 'users':
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3" />
          <path d="M3 19a6 6 0 0 1 12 0" />
          <circle cx="17" cy="9" r="2.5" />
          <path d="M15.5 19a4.5 4.5 0 0 1 5.5-4.2" />
        </svg>
      )
    case 'payroll':
      return (
        <svg {...common}>
          <rect x="4" y="5" width="16" height="14" rx="2" />
          <path d="M8 9h8M8 13h5" />
          <circle cx="16.5" cy="13.5" r="1.5" />
        </svg>
      )
    case 'dian':
      return (
        <svg {...common}>
          <path d="M12 3l8 4v5c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V7l8-4z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      )
    case 'clock':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      )
    case 'shield':
      return (
        <svg {...common}>
          <path d="M12 3l8 4v5c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V7l8-4z" />
        </svg>
      )
    case 'check':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M8.5 12.5l2.5 2.5 4.5-5" />
        </svg>
      )
    case 'scale':
      return (
        <svg {...common}>
          <path d="M4 19h16M7 19V9m5 10V5m5 14v-7" />
        </svg>
      )
    case 'arrow':
      return (
        <svg {...common}>
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      )
  }
}

function BrandMark() {
  return <img src="/logo5.png" alt="JARVIS" width="38" height="38" className="landing-brand__mark" />
}

function HeroVisual({ product }: { product?: Product }) {
  const floats = product === 'siigo'
    ? [
        { label: 'Cargue masivo a Siigo', icon: 'docs' as const, pos: 'tl' },
        { label: 'Asistencia con IA', icon: 'scale' as const, pos: 'tr' },
        { label: 'Gestión de terceros', icon: 'users' as const, pos: 'bl' },
        { label: 'Facturas de compra', icon: 'invoice' as const, pos: 'br' },
      ]
    : [
        { label: product ? 'Emisión directa DIAN' : 'Automatización con Siigo', icon: 'dian' as const, pos: 'tl' },
        { label: 'Facturación electrónica', icon: 'invoice' as const, pos: 'tr' },
        { label: product ? 'Documento soporte' : 'Inteligencia artificial', icon: 'docs' as const, pos: 'bl' },
        { label: product ? 'Notas débito, crédito y RADIAN' : 'Directo con la DIAN', icon: 'check' as const, pos: 'br' },
      ]
  return (
    <div className="landing-hero-visual" aria-hidden="true">
      <div className="landing-hero-visual__glow" />
      <div className="landing-laptop">
        <div className="landing-laptop__screen">
          <div className="landing-laptop__bezel">
            <span className="landing-laptop__logo">JV</span>
            <span className="landing-laptop__word">JARVIS</span>
          </div>
        </div>
        <div className="landing-laptop__base" />
        <div className="landing-laptop__stand" />
      </div>
      {floats.map((item) => (
        <div key={item.label} className={`landing-float landing-float--${item.pos}`}>
          <Icon name={item.icon} />
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  )
}

function ProductChoices({ pricing = false }: { pricing?: boolean }) {
  return (
    <div className="landing-product-grid">
      {(Object.entries(PRODUCTS) as [Product, typeof PRODUCTS[Product]][]).map(([key, item]) => (
        <article key={key} className={`landing-product landing-product--${key}`}>
          <div className="landing-product__top">
            <div className="landing-card__icon"><Icon name={item.icon} /></div>
            <span className="landing-product__audience">{item.audience}</span>
          </div>
          <p className="landing-eyebrow">{item.eyebrow}</p>
          <h3>{item.name}</h3>
          {pricing ? (
            <>
              <p className="landing-product__price">
                <span>Desde</span> {key === 'siigo' ? '$35.000' : '$60.000'}<small>/mes</small>
              </p>
              <p>{key === 'siigo'
                ? 'Planes de cargue masivo a Siigo según tu volumen de documentos.'
                : 'Facturas ilimitadas al mes. También puedes elegir el plan anual de $130.000 con 50 documentos, sin mensualidad.'}</p>
            </>
          ) : (
            <>
              <p>{item.description}</p>
              <ul className="landing-product__features">
                {item.features.map(feature => <li key={feature}><Icon name="check" />{feature}</li>)}
              </ul>
            </>
          )}
          <Link to={pricing ? `${item.path}#precios` : item.path} className={`landing-btn ${key === 'billing' ? 'landing-btn--primary' : 'landing-btn--ghost'}`}>
            {pricing ? `Ver planes ${key === 'siigo' ? 'para Siigo' : 'de facturación'}` : item.action}
            <Icon name="arrow" />
          </Link>
        </article>
      ))}
    </div>
  )
}

function SiigoPricing() {
  return (
    <div className="landing-pricing">
      {PLANS.map((plan) => (
        <article key={plan.name} className={`landing-plan landing-plan--${plan.tone}`}>
          <header>
            <h3>{plan.name}</h3>
            <p className="landing-plan__price">{plan.price}{plan.period ? <span>{plan.period}</span> : null}</p>
            <p className="landing-plan__limit">{plan.limit}</p>
          </header>
          <ul>{PLAN_FEATURES.map((feature) => <li key={feature}>{feature}</li>)}</ul>
          <a href={buildWhatsappHref(`Hola, me interesa el plan ${plan.name} de automatización con Siigo en JARVIS`)}
            className="landing-btn landing-btn--ghost landing-plan__cta" target="_blank" rel="noopener noreferrer">
            Consultar plan
          </a>
        </article>
      ))}
    </div>
  )
}

function BillingPricing() {
  return (
    <>
      <div className="landing-billing-plans">
        <article className="landing-billing-plan">
          <span className="landing-product__audience">Plan anual</span>
          <h3>Factura a tu ritmo</h3>
          <p>Elige el plan anual y compra más documentos cuando los necesites.</p>
          <p className="landing-billing-plan__price">$130.000 <span>/ año</span></p>
          <ul className="landing-product__features">
            <li><Icon name="check" /><strong>Incluye 50 documentos electrónicos</strong></li>
            <li><Icon name="check" />Sin pago mensual</li>
            <li><Icon name="check" />Recargas según tu necesidad</li>
          </ul>
          <a href={buildWhatsappHref('Hola, me interesa el plan anual de facturación electrónica JARVIS de $130.000 con 50 documentos')}
            className="landing-btn landing-btn--ghost" target="_blank" rel="noopener noreferrer">
            Quiero mi plan anual <Icon name="arrow" />
          </a>
        </article>
        <article className="landing-billing-plan landing-billing-plan--unlimited">
          <span className="landing-product__audience">Facturas ilimitadas</span>
          <h3>Factura sin contar</h3>
          <p>Una mensualidad fija para emitir todas las facturas que tu negocio necesite.</p>
          <p className="landing-billing-plan__price">$60.000 <span>/ mes</span></p>
          <ul className="landing-product__features">
            <li><Icon name="check" /><strong>Facturación electrónica ilimitada</strong></li>
            <li><Icon name="check" />Pago mensual de $60.000</li>
            <li><Icon name="check" />Emisión directa con la DIAN</li>
          </ul>
          <a href={buildWhatsappHref('Hola, me interesa el plan de facturación electrónica ilimitada de JARVIS por $60.000 mensuales')}
            className="landing-btn landing-btn--primary" target="_blank" rel="noopener noreferrer">
            Quiero facturación ilimitada <Icon name="arrow" />
          </a>
        </article>
      </div>
      <div className="landing-topups" aria-labelledby="recargas-title">
        <div className="landing-topups__heading">
          <div>
            <p className="landing-eyebrow">Para tu plan anual</p>
            <h3 id="recargas-title">¿Necesitas más documentos?</h3>
            <p>Elige tu recarga y sigue facturando a tu ritmo.</p>
          </div>
          <span className="landing-currency">Precios en pesos colombianos (COP)</span>
        </div>
        <div className="landing-topups__grid">
          {BILLING_TOP_UPS.map(pack => (
            <a key={pack.documents} className="landing-topup"
              href={buildWhatsappHref(`Hola, quiero una recarga de ${pack.documents} documentos electrónicos para Facturación JARVIS por ${pack.price}`)}
              target="_blank" rel="noopener noreferrer"
              aria-label={`Consultar recarga de ${pack.documents} documentos por ${pack.price}`}>
              <strong>{pack.documents}</strong>
              <span>documentos</span>
              <b>{pack.price}</b>
              <span className="landing-topup__action">Consultar <Icon name="arrow" /></span>
            </a>
          ))}
        </div>
      </div>
    </>
  )
}

function LandingContent({ product }: { product?: Product }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const headerRef = useRef<HTMLElement>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const selectedProduct = product ? PRODUCTS[product] : undefined
  const demoHref = selectedProduct?.demo ?? DEMO_HREF
  const solutions = product === 'siigo' ? SIIGO_SOLUTIONS : BILLING_SOLUTIONS
  const faqs = MARKETING_FAQS[product ?? 'home']

  useEffect(() => {
    document.documentElement.lang = 'es'
  }, [])

  useEffect(() => {
    return applyMarketingSeo(product)
  }, [product])

  useEffect(() => {
    const target = document.getElementById(window.location.hash.slice(1))
    if (target) target.scrollIntoView()
    else window.scrollTo(0, 0)
  }, [product])

  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false)
        menuButtonRef.current?.focus()
      }
    }
    const onOutsideClick = (e: PointerEvent) => {
      if (e.target instanceof Node && !headerRef.current?.contains(e.target)) {
        setMenuOpen(false)
      }
    }
    const desktop = window.matchMedia('(min-width: 1200px)')
    const onBreakpointChange = () => setMenuOpen(false)
    window.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onOutsideClick)
    desktop.addEventListener('change', onBreakpointChange)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onOutsideClick)
      desktop.removeEventListener('change', onBreakpointChange)
    }
  }, [menuOpen])

  const closeMenu = () => setMenuOpen(false)

  if (!product) return <SolutionLanding />

  return (
    <div className="landing-page">
      <a href="#contenido" className="landing-skip">
        Saltar al contenido
      </a>

      <header ref={headerRef} className="landing-header">
        <div className="landing-container landing-header__inner">
          <Link to="/" className="landing-brand" onClick={closeMenu}>
            <BrandMark />
            <span className="landing-brand__text">
              <span className="landing-brand__name">JARVIS</span>
              <span className="landing-brand__tag">Automatiza · Conecta · Simplifica</span>
            </span>
          </Link>

          <nav
            id="landing-nav"
            className={`landing-nav${menuOpen ? ' is-open' : ''}`}
            aria-label="Navegación principal"
          >
            {NAV_LINKS.map((link) => (
              link.href.startsWith('/') ? (
                <Link key={link.href} to={link.href} onClick={closeMenu}
                  aria-current={(selectedProduct?.path ?? '/') === link.href ? 'page' : undefined}>
                  {link.label}
                </Link>
              ) : <a key={link.href} href={link.href} onClick={closeMenu}>{link.label}</a>
            ))}
            <Link
              to="/login"
              className="landing-btn landing-header__login landing-header__login--nav"
              onClick={closeMenu}
            >
              Iniciar sesión
            </Link>
          </nav>

          <div className="landing-header__actions">
            <Link
              to="/login"
              className="landing-btn landing-header__login landing-header__login--bar"
            >
              Iniciar sesión
            </Link>
            <button
              ref={menuButtonRef}
              type="button"
              className="landing-menu-btn"
              aria-expanded={menuOpen}
              aria-controls="landing-nav"
              onClick={() => setMenuOpen((v) => !v)}
            >
              <span className="sr-only">{menuOpen ? 'Cerrar menú' : 'Abrir menú'}</span>
              {menuOpen ? <CloseIcon /> : <MenuIcon />}
            </button>
          </div>
        </div>
      </header>

      <main id="contenido">
        <section id="inicio" className="landing-hero" aria-labelledby="hero-title">
          <div className="landing-container landing-hero__grid">
            <div className="landing-hero__copy">
              <p className="landing-eyebrow">{selectedProduct?.eyebrow ?? 'Automatiza · Conecta · Simplifica'}</p>
              {product && <nav className="landing-breadcrumb" aria-label="Ruta de navegación"><Link to="/">Inicio</Link><span aria-hidden="true">/</span><span aria-current="page">{selectedProduct?.name}</span></nav>}
              <h1 id="hero-title">
                {product === 'siigo' ? <>Automatización contable con Siigo e <span className="landing-accent">inteligencia artificial.</span></>
                  : product === 'billing' ? <>Facturación electrónica en Colombia. <span className="landing-accent">Directa con la DIAN.</span></>
                  : <>Automatización contable y <span className="landing-accent">facturación electrónica en Colombia.</span></>}
              </h1>
              <p className="landing-hero__lead">
                {selectedProduct?.description ?? 'Automatiza tu operación en Siigo con ayuda de IA o factura electrónicamente directo con la DIAN. Dos soluciones JARVIS, una para cada necesidad.'}
              </p>
              <div className="landing-hero__actions">
                <a
                  href={product ? demoHref : '#soluciones'}
                  className="landing-btn landing-btn--primary"
                  target={product ? '_blank' : undefined}
                  rel={product ? 'noopener noreferrer' : undefined}
                >
                  {selectedProduct?.action ?? 'Encuentra tu solución'}
                  <Icon name="arrow" />
                </a>
                <a href="#precios" className="landing-btn landing-btn--ghost">
                  Ver planes y precios
                </a>
              </div>
              {product === 'billing' && <p className="landing-hero__note">Plan anual con 50 documentos por $130.000/año o facturas ilimitadas por $60.000/mes.</p>}
              {product === 'siigo' && <p className="landing-hero__note">Para empresas y equipos contables que ya trabajan con Siigo.</p>}
            </div>
            <HeroVisual product={product} />
          </div>
        </section>

        <section id="soluciones" className="landing-section" aria-labelledby="soluciones-title">
          <div className="landing-container">
            <h2 id="soluciones-title" className="landing-section__title">
              {product === 'siigo' ? 'Tu operación en Siigo, más ágil'
                : product === 'billing' ? 'Tus documentos electrónicos, en un solo lugar'
                : '¿Qué quieres hacer con JARVIS?'}
            </h2>
            <p className="landing-section__lead">
              {product === 'siigo' ? 'Conserva tu sistema contable y suma herramientas para reducir el trabajo manual.'
                : product === 'billing' ? 'Emite facturas de venta, documentos soporte y notas débito y crédito. Gestiona también tus eventos RADIAN desde JARVIS, sin depender de Siigo.'
                : 'Elige tu punto de partida. Cada solución tiene sus propias funciones y planes.'}
            </p>
            {!product ? <ProductChoices /> : <div className={`landing-solutions${product === 'billing' ? ' landing-solutions--billing' : ''}`}>
              {solutions.map((item) => (
                <article key={item.title} className="landing-card">
                  <div className="landing-card__icon">
                    <Icon name={item.icon} />
                  </div>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </article>
              ))}
            </div>}
          </div>
        </section>

        {product && <section className="landing-section landing-section--workflow" aria-labelledby="workflow-title">
          <div className="landing-container">
            <p className="landing-eyebrow landing-eyebrow--center">Así funciona</p>
            <h2 id="workflow-title" className="landing-section__title">{product === 'siigo' ? 'Del archivo a Siigo, con revisión en cada paso' : 'De tus datos a tu factura electrónica'}</h2>
            <ol className="landing-workflow">
              {MARKETING_STEPS[product].map((step, index) => <li key={step.title}>
                <span className="landing-workflow__number" aria-hidden="true">0{index + 1}</span>
                <h3>{step.title}</h3><p>{step.description}</p>
              </li>)}
            </ol>
          </div>
        </section>}

        <section className="landing-section landing-section--split" aria-label="Integraciones y beneficios">
          <div className="landing-container landing-split">
            <div id="integraciones" className="landing-integrations">
              <h2>{product === 'siigo' ? 'JARVIS + Siigo' : product === 'billing' ? 'De tu negocio a la DIAN' : 'Dos caminos, una misma marca'}</h2>
              <p>
                {product === 'siigo' ? 'JARVIS se conecta con la API de Siigo para agilizar tu operación. Tu información contable sigue en Siigo.'
                  : product === 'billing' ? 'Emite desde JARVIS directamente con la DIAN.'
                  : 'Con Siigo, automatizas tu operación contable. Con Facturación JARVIS, emites directamente con la DIAN. Tú eliges por dónde empezar.'}
              </p>
              <div className="landing-partners" role="list">
                {product !== 'billing' &&
                <div className="landing-partner" role="listitem">
                  <span className="landing-partner__name">Siigo</span>
                  <span className="landing-partner__hint">Automatización + IA</span>
                </div>}
                {!product && <div className="landing-partners__divider" aria-hidden="true" />}
                {product !== 'siigo' &&
                <div className="landing-partner" role="listitem">
                  <span className="landing-partner__name">DIAN</span>
                  <span className="landing-partner__hint">Facturación directa desde JARVIS</span>
                </div>}
              </div>
            </div>

            <div id="beneficios" className="landing-benefits">
              <h2>Beneficios que transforman tu negocio</h2>
              <div className="landing-benefits__grid">
                {BENEFITS.map((item) => (
                  <article key={item.title} className="landing-benefit">
                    <div className="landing-benefit__icon">
                      <Icon name={item.icon} />
                    </div>
                    <div>
                      <h3>{item.title}</h3>
                      <p>{item.description}</p>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="precios" className="landing-section" aria-labelledby="precios-title">
          <div className="landing-container">
            <h2 id="precios-title" className="landing-section__title">
              {product === 'siigo' ? 'Planes de automatización para Siigo'
                : product === 'billing' ? 'Tu facturación, a tu manera'
                : 'Un plan para lo que necesitas'}
            </h2>
            <p className="landing-section__lead">
              {product === 'siigo' ? 'Estos planes corresponden al cargue masivo de documentos soporte en Siigo. Precios en COP al mes.'
                : product === 'billing' ? 'Elige entre un plan anual con 50 documentos o facturación ilimitada con pago mensual. Precios en COP.'
                : 'Consulta por separado los planes de automatización con Siigo y los de facturación directa con la DIAN.'}
            </p>
            {product === 'siigo' ? <SiigoPricing /> : product === 'billing' ? <BillingPricing /> : <ProductChoices pricing />}
          </div>
        </section>

        <section id="preguntas-frecuentes" className="landing-section" aria-labelledby="faq-title">
          <div className="landing-container landing-faq">
            <p className="landing-eyebrow landing-eyebrow--center">Resolvemos tus dudas</p>
            <h2 id="faq-title" className="landing-section__title">{product === 'siigo' ? 'Preguntas sobre la integración con Siigo' : product === 'billing' ? 'Preguntas sobre facturación electrónica JARVIS' : '¿Cuál solución JARVIS es para ti?'}</h2>
            <div className="landing-faq__items">{faqs.map(faq => <details key={faq.question}>
              <summary>{faq.question}</summary><p>{faq.answer}</p>
            </details>)}</div>
            {product && <p className="landing-related">{product === 'siigo' ? '¿Quieres emitir facturas sin usar Siigo? ' : '¿Ya usas Siigo y quieres automatizar tu operación? '}
              <Link to={product === 'siigo' ? '/facturacion-electronica' : '/siigo'}>{product === 'siigo' ? 'Conoce la facturación electrónica directa con la DIAN' : 'Conoce la automatización contable con Siigo e IA'}</Link>
            </p>}
          </div>
        </section>

        <section className="landing-cta-band" aria-labelledby="cta-title">
          <div className="landing-container landing-cta-band__inner">
            <div>
              <h2 id="cta-title">{product === 'billing' ? 'Tu próxima factura empieza aquí' : product === 'siigo' ? 'Dale más tiempo a tu equipo contable' : 'Encuentra el JARVIS que tu negocio necesita'}</h2>
              <p>{product ? 'Conversemos y te ayudamos a dar el primer paso.' : 'Te orientamos para elegir entre automatización con Siigo y facturación electrónica directa.'}</p>
            </div>
            <a
              href={demoHref}
              className="landing-btn landing-btn--dark"
              target="_blank"
              rel="noopener noreferrer"
            >
              {product ? 'Hablar con un asesor' : 'Ayúdame a elegir'}
              <Icon name="arrow" />
            </a>
          </div>
        </section>
      </main>

      <footer id="contacto" className="landing-footer">
        <div className="landing-container landing-footer__inner">
          <div className="landing-footer__brand">
            <BrandMark />
            <div>
              <strong>JARVIS</strong>
              <p>Automatización con Siigo · Facturación directa con la DIAN</p>
            </div>
          </div>
          <div className="landing-footer__contact">
            <p>
              <a href="tel:+573195355387">319 535 5387</a>
            </p>
            <p>
              <a href="mailto:jarviscol2025@gmail.com">jarviscol2025@gmail.com</a>
            </p>
            <p>
              <a href={demoHref} target="_blank" rel="noopener noreferrer">
                WhatsApp
              </a>
              {' · '}
              <a href="https://www.jarviscol.com" target="_blank" rel="noopener noreferrer">
                jarviscol.com
              </a>
            </p>
          </div>
        </div>
        <div className="landing-footer__legal">
          <p>© {new Date().getFullYear()} JARVIS. Todos los derechos reservados.</p>
          <p>
            <a href="mailto:jarviscol2025@gmail.com?subject=T%C3%A9rminos%20y%20condiciones">
              Términos y condiciones
            </a>
            <span aria-hidden="true"> · </span>
            <PrivacyPolicyLink mode={product === 'siigo' ? 'siigo' : 'jarvis'}>
              Política de privacidad
            </PrivacyPolicyLink>
          </p>
        </div>
      </footer>
    </div>
  )
}

export default function MarketingContent({ product }: { product?: MarketingProduct }) {
  return product === 'payroll' ? <PayrollLandingPage /> : <LandingContent product={product} />
}
