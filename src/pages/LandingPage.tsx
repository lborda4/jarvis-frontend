import { useEffect, useId, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import LoadingIndicator from '../components/LoadingIndicator'
import { useAuth } from '../context/AuthContext'
import { useBackendWakeup } from '../hooks/useBackendWakeup'
import './LandingPage.css'

const APP_ENTRY_PATH = '/documento-soporte'
const WHATSAPP_HREF =
  'https://wa.me/573195355387?text=Hola%2C%20quiero%20solicitar%20una%20demo%20de%20JARVIS'
const DEMO_HREF = WHATSAPP_HREF

const NAV_LINKS = [
  { href: '#inicio', label: 'Inicio' },
  { href: '#soluciones', label: 'Soluciones' },
  { href: '#beneficios', label: 'Beneficios' },
  { href: '#precios', label: 'Precios' },
  { href: '#integraciones', label: 'Integraciones' },
  { href: '#contacto', label: 'Contacto' },
] as const

const HERO_FLOATS = [
  { label: 'Documentos Soporte', icon: 'docs' as const, pos: 'tl' },
  { label: 'Facturación Electrónica', icon: 'invoice' as const, pos: 'tr' },
  { label: 'Consulta de Terceros', icon: 'users' as const, pos: 'bl' },
  { label: 'Nómina Electrónica', icon: 'payroll' as const, pos: 'br' },
]

const SOLUTIONS = [
  {
    title: 'Cargue masivo de Documentos Soporte',
    description:
      'Sube cientos de documentos soporte desde Excel a SIIGO en minutos, con validaciones automáticas.',
    icon: 'docs' as const,
  },
  {
    title: 'Facturación Electrónica',
    description:
      'Gestiona y automatiza tu facturación electrónica alineada con los requisitos de la DIAN.',
    icon: 'invoice' as const,
  },
  {
    title: 'Consulta de Terceros',
    description:
      'Consulta y gestiona información de terceros de forma rápida para agilizar tu operación contable.',
    icon: 'users' as const,
  },
  {
    title: 'Nómina Electrónica',
    description:
      'Simplifica el proceso de nómina electrónica y reduce el trabajo manual de tu equipo.',
    icon: 'payroll' as const,
  },
  {
    title: 'Causación automática desde la DIAN',
    description:
      'Próximamente: causa automáticamente desde la DIAN para cerrar el ciclo contable sin fricción.',
    icon: 'dian' as const,
    badge: 'Próximamente',
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
    title: 'Cumple sin estrés',
    description: 'Mantén el cumplimiento con SIIGO y la DIAN de forma más simple y confiable.',
    icon: 'check' as const,
  },
  {
    title: 'Escalable',
    description: 'Crece el volumen de documentos sin aumentar el tamaño de tu equipo.',
    icon: 'scale' as const,
  },
]

const PLANS = [
  { name: 'Inicial', price: '$35.000', period: '/mes', limit: 'Hasta 100 documentos', tone: 'teal' },
  { name: 'Profesional', price: '$75.000', period: '/mes', limit: 'Hasta 500 documentos', tone: 'blue' },
  { name: 'Avanzado', price: '$120.000', period: '/mes', limit: 'Hasta 1.000 documentos', tone: 'green' },
  { name: 'Empresarial', price: '$250.000', period: '/mes', limit: 'Hasta 5.000 documentos', tone: 'purple' },
  { name: 'Corporativo', price: 'Cotizar', period: '', limit: 'Más de 5.000 documentos', tone: 'dark' },
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
  const id = useId()
  return (
    <svg
      className="landing-brand__mark"
      viewBox="0 0 40 40"
      width="40"
      height="40"
      aria-hidden="true"
    >
      <circle
        cx="20"
        cy="20"
        r="18.5"
        fill="none"
        stroke={`url(#${id}-g)`}
        strokeWidth="1.5"
      />
      <text
        x="20"
        y="25.5"
        textAnchor="middle"
        fill="#fff"
        fontSize="13"
        fontWeight="800"
        letterSpacing="0.5"
        fontFamily="Segoe UI, system-ui, sans-serif"
      >
        JV
      </text>
      <defs>
        <linearGradient id={`${id}-g`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1ad3cc" />
          <stop offset="100%" stopColor="#0ea5a0" />
        </linearGradient>
      </defs>
    </svg>
  )
}

function HeroVisual() {
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
      {HERO_FLOATS.map((item) => (
        <div key={item.label} className={`landing-float landing-float--${item.pos}`}>
          <Icon name={item.icon} />
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  )
}

function LandingPage() {
  const { isAuthenticated, isLoading } = useAuth()
  const { loadingMessage } = useBackendWakeup()
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    document.documentElement.lang = 'es'
  }, [])

  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen])

  if (isLoading) {
    return (
      <div className="landing-loading">
        <LoadingIndicator message={loadingMessage} />
      </div>
    )
  }

  if (isAuthenticated) {
    return <Navigate to={APP_ENTRY_PATH} replace />
  }

  const closeMenu = () => setMenuOpen(false)

  return (
    <div className="landing-page">
      <a href="#contenido" className="landing-skip">
        Saltar al contenido
      </a>

      <header className="landing-header">
        <div className="landing-container landing-header__inner">
          <a href="#inicio" className="landing-brand" onClick={closeMenu}>
            <BrandMark />
            <span className="landing-brand__text">
              <span className="landing-brand__name">JARVIS</span>
              <span className="landing-brand__tag">Automatiza · Conecta · Simplifica</span>
            </span>
          </a>

          <nav
            id="landing-nav"
            className={`landing-nav${menuOpen ? ' is-open' : ''}`}
            aria-label="Navegación principal"
          >
            {NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href} onClick={closeMenu}>
                {link.label}
              </a>
            ))}
            <Link
              to="/login"
              className="landing-btn landing-btn--primary landing-header__login landing-header__login--nav"
              onClick={closeMenu}
            >
              Iniciar sesión
            </Link>
          </nav>

          <div className="landing-header__actions">
            <Link
              to="/login"
              className="landing-btn landing-btn--primary landing-header__login landing-header__login--bar"
            >
              Iniciar sesión
            </Link>
            <button
              type="button"
              className="landing-menu-btn"
              aria-expanded={menuOpen}
              aria-controls="landing-nav"
              onClick={() => setMenuOpen((v) => !v)}
            >
              <span className="sr-only">{menuOpen ? 'Cerrar menú' : 'Abrir menú'}</span>
              <span aria-hidden="true">{menuOpen ? '✕' : '☰'}</span>
            </button>
          </div>
        </div>
      </header>

      <main id="contenido">
        <section id="inicio" className="landing-hero" aria-labelledby="hero-title">
          <div className="landing-container landing-hero__grid">
            <div className="landing-hero__copy">
              <h1 id="hero-title">
                Automatiza tu <span className="landing-accent">contabilidad</span>
              </h1>
              <p className="landing-hero__lead">
                JARVIS conecta tu empresa con SIIGO y la DIAN para automatizar el cargue de
                documentos soporte, facturación electrónica y nómina. Ahorra tiempo, reduce
                errores y toma mejores decisiones.
              </p>
              <div className="landing-hero__actions">
                <a
                  href={DEMO_HREF}
                  className="landing-btn landing-btn--primary"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Solicitar demo
                  <Icon name="arrow" />
                </a>
                <a href="#soluciones" className="landing-btn landing-btn--ghost">
                  Conocer soluciones
                </a>
              </div>
            </div>
            <HeroVisual />
          </div>
        </section>

        <section id="soluciones" className="landing-section" aria-labelledby="soluciones-title">
          <div className="landing-container">
            <h2 id="soluciones-title" className="landing-section__title">
              Todo lo que tu empresa necesita, en un solo lugar
            </h2>
            <p className="landing-section__lead">
              Software de automatización contable para Colombia: documentos soporte, facturación
              electrónica, terceros y nómina electrónica.
            </p>
            <div className="landing-solutions">
              {SOLUTIONS.map((item) => (
                <article key={item.title} className="landing-card">
                  {item.badge ? <span className="landing-badge">{item.badge}</span> : null}
                  <div className="landing-card__icon">
                    <Icon name={item.icon} />
                  </div>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="landing-section landing-section--split" aria-label="Integraciones y beneficios">
          <div className="landing-container landing-split">
            <div id="integraciones" className="landing-integrations">
              <h2>Conectados con los mejores</h2>
              <p>
                Integración directa con SIIGO y cumplimiento frente a la DIAN para tu
                automatización contable.
              </p>
              <div className="landing-partners" role="list">
                <div className="landing-partner" role="listitem">
                  <span className="landing-partner__name">Siigo</span>
                  <span className="landing-partner__hint">API contable</span>
                </div>
                <div className="landing-partners__divider" aria-hidden="true" />
                <div className="landing-partner" role="listitem">
                  <span className="landing-partner__name">DIAN</span>
                  <span className="landing-partner__hint">Cumplimiento fiscal</span>
                </div>
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
              Planes pensados para tu volumen
            </h2>
            <p className="landing-section__lead">
              Elige el plan ideal para automatizar el cargue masivo de documentos soporte en SIIGO.
            </p>
            <div className="landing-pricing">
              {PLANS.map((plan) => (
                <article key={plan.name} className={`landing-plan landing-plan--${plan.tone}`}>
                  <header>
                    <h3>{plan.name}</h3>
                    <p className="landing-plan__price">
                      {plan.price}
                      {plan.period ? <span>{plan.period}</span> : null}
                    </p>
                    <p className="landing-plan__limit">{plan.limit}</p>
                  </header>
                  <ul>
                    {PLAN_FEATURES.map((feature) => (
                      <li key={feature}>{feature}</li>
                    ))}
                  </ul>
                  <a
                    href={DEMO_HREF}
                    className="landing-btn landing-btn--ghost landing-plan__cta"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Solicitar demo
                  </a>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="landing-cta-band" aria-labelledby="cta-title">
          <div className="landing-container landing-cta-band__inner">
            <div>
              <h2 id="cta-title">¿Listo para llevar tu contabilidad al siguiente nivel?</h2>
              <p>Únete a las empresas que ya confían en JARVIS para automatizar su operación contable.</p>
            </div>
            <a
              href={DEMO_HREF}
              className="landing-btn landing-btn--dark"
              target="_blank"
              rel="noopener noreferrer"
            >
              Solicitar demo
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
              <p>Automatización contable con SIIGO y DIAN</p>
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
              <a href={WHATSAPP_HREF} target="_blank" rel="noopener noreferrer">
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
            <a href="mailto:jarviscol2025@gmail.com?subject=Pol%C3%ADtica%20de%20privacidad">
              Política de privacidad
            </a>
          </p>
        </div>
      </footer>
    </div>
  )
}

export default LandingPage
