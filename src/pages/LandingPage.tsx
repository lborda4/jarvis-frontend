import { Link, Navigate } from 'react-router-dom'
import LoadingIndicator from '../components/LoadingIndicator'
import { useAuth } from '../context/AuthContext'
import './LandingPage.css'

const APP_ENTRY_PATH = '/inicio'

const HERO_BENEFITS = [
  {
    title: 'Ahorra tiempo, reduce errores y enfócate en lo que realmente importa.',
    icon: '⏱',
  },
  {
    title: 'Menos trabajo manual, más productividad para ti y tus clientes.',
    icon: '📅',
  },
]

const FEATURES = [
  { title: 'Automatización total', description: 'Cargue masivo desde Excel a SIIGO en minutos.' },
  { title: 'Seguridad y confiabilidad', description: 'Conexión directa con la API de SIIGO.' },
  { title: 'Ahorro de tiempo', description: 'Elimina procesos repetitivos y manuales.' },
  { title: 'Menos errores manuales', description: 'Validaciones automáticas antes del envío.' },
  { title: 'Mayor productividad', description: 'Atiende más clientes con el mismo equipo.' },
  { title: 'Soporte incluido', description: 'Acompañamiento en la configuración inicial.' },
]

const PLANS = [
  {
    name: 'Inicial',
    price: '$35.000',
    period: '/mes',
    limit: 'Hasta 100 documentos',
    tone: 'teal',
  },
  {
    name: 'Profesional',
    price: '$75.000',
    period: '/mes',
    limit: 'Hasta 500 documentos',
    tone: 'blue',
  },
  {
    name: 'Avanzado',
    price: '$120.000',
    period: '/mes',
    limit: 'Hasta 1.000 documentos',
    tone: 'green',
  },
  {
    name: 'Empresarial',
    price: '$250.000',
    period: '/mes',
    limit: 'Hasta 5.000 documentos',
    tone: 'purple',
  },
  {
    name: 'Corporativo',
    price: 'COTIZAR',
    period: '',
    limit: 'Más de 5.000 documentos',
    tone: 'dark',
  },
]

const PLAN_FEATURES = [
  'Cargue masivo a SIIGO',
  'Sin límite de empresas',
  'Soporte incluido',
  'Sin costo de configuración',
]

const WHY_CHOOSE = [
  'Evita cargues manuales uno por uno en SIIGO.',
  'Centraliza el procesamiento de documentos soporte.',
  'Reduce errores de digitación y omisiones.',
  'Escala tu operación contable sin contratar más personal.',
  'Ideal para firmas contables y equipos de backoffice.',
]

const HOW_IT_WORKS = [
  'Prepara tu archivo Excel con los documentos.',
  'Súbelo a JARVIS y selecciona la configuración.',
  'JARVIS valida, procesa y prepara el envío.',
  'Los documentos quedan cargados en SIIGO automáticamente.',
]

const FOOTER_BADGES = [
  '100% en la nube',
  'Seguridad garantizada',
  'Actualizaciones continuas',
  'Soporte incluido',
]

function LandingPage() {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="landing-loading">
        <LoadingIndicator message="Cargando..." />
      </div>
    )
  }

  if (isAuthenticated) {
    return <Navigate to={APP_ENTRY_PATH} replace />
  }

  return (
    <div className="landing-page">
      <header className="landing-header">
        <div className="landing-container landing-header__inner">
          <a href="#inicio" className="landing-header__brand">
            <img
              src="/jarvis-login-brand.png?v=1"
              alt="Jarvis"
              className="landing-header__logo"
            />
          </a>

          <nav className="landing-header__nav" aria-label="Navegación principal">
            <a href="#que-es">Qué es</a>
            <a href="#planes">Planes</a>
            <a href="#como-funciona">Cómo funciona</a>
            <a href="#contacto">Contacto</a>
          </nav>

          <Link to="/login" className="landing-header__login">
            Ingresar
          </Link>
        </div>
      </header>

      <main>
        <section id="inicio" className="landing-hero">
          <div className="landing-container landing-hero__inner">
            <h1>
              La herramienta que automatiza el cargue masivo de documentos soporte en{' '}
              <span className="landing-highlight">SIIGO</span>
            </h1>

            <div className="landing-flow" aria-label="Flujo de trabajo">
              <div className="landing-flow__step">
                <div className="landing-flow__icon landing-flow__icon--excel">XLS</div>
                <p>Tus documentos (Excel)</p>
              </div>
              <span className="landing-flow__arrow" aria-hidden="true">
                →
              </span>
              <div className="landing-flow__step">
                <div className="landing-flow__icon landing-flow__icon--jarvis">J</div>
                <p>JARVIS</p>
              </div>
              <span className="landing-flow__arrow" aria-hidden="true">
                →
              </span>
              <div className="landing-flow__step">
                <div className="landing-flow__icon landing-flow__icon--siigo">S</div>
                <p>Cargue automático en SIIGO</p>
              </div>
            </div>

            <div className="landing-hero__benefits">
              {HERO_BENEFITS.map((benefit) => (
                <article key={benefit.title} className="landing-benefit-card">
                  <span className="landing-benefit-card__icon" aria-hidden="true">
                    {benefit.icon}
                  </span>
                  <p>{benefit.title}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="que-es" className="landing-section landing-about">
          <div className="landing-container landing-about__grid">
            <div>
              <p className="landing-eyebrow">¿Qué es JARVIS?</p>
              <h2>Automatiza tu operación contable con SIIGO</h2>
              <p className="landing-about__text">
                JARVIS se conecta con la API de SIIGO para permitir el cargue masivo,
                rápido, seguro y eficiente de documentos soporte desde Excel. Olvídate
                de subir documento por documento y dedica ese tiempo a asesorar a tus
                clientes.
              </p>
              <Link to="/login" className="landing-button landing-button--primary">
                Comenzar ahora
              </Link>
            </div>

            <div className="landing-features-grid">
              {FEATURES.map((feature) => (
                <article key={feature.title} className="landing-feature-card">
                  <h3>{feature.title}</h3>
                  <p>{feature.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="planes" className="landing-section landing-pricing">
          <div className="landing-container">
            <p className="landing-eyebrow landing-eyebrow--center">Planes JARVIS</p>
            <h2 className="landing-section__title">Elige el plan ideal para tu volumen</h2>

            <div className="landing-pricing__grid">
              {PLANS.map((plan) => (
                <article
                  key={plan.name}
                  className={`landing-plan landing-plan--${plan.tone}`}
                >
                  <header className="landing-plan__header">
                    <h3>{plan.name}</h3>
                    <p className="landing-plan__price">
                      {plan.price}
                      {plan.period && (
                        <span className="landing-plan__period">{plan.period}</span>
                      )}
                    </p>
                    <p className="landing-plan__limit">{plan.limit}</p>
                  </header>
                  <ul className="landing-plan__features">
                    {PLAN_FEATURES.map((feature) => (
                      <li key={feature}>{feature}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="como-funciona" className="landing-section landing-split">
          <div className="landing-container landing-split__grid">
            <div>
              <p className="landing-eyebrow">¿Por qué elegir JARVIS?</p>
              <h2>Más eficiencia para tu equipo contable</h2>
              <ul className="landing-checklist">
                {WHY_CHOOSE.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>

            <div className="landing-steps-card">
              <p className="landing-eyebrow">Así funciona</p>
              <h2>En 4 pasos simples</h2>
              <ol className="landing-steps">
                {HOW_IT_WORKS.map((step, index) => (
                  <li key={step}>
                    <span className="landing-steps__number">{index + 1}</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        <section className="landing-cta">
          <div className="landing-container landing-cta__inner">
            <div>
              <p className="landing-eyebrow landing-eyebrow--light">¿Listo para ahorrar tiempo?</p>
              <h2>Automatiza hoy el cargue de documentos soporte</h2>
              <p>Automatiza · Conecta · Simplifica</p>
            </div>
            <Link to="/login" className="landing-button landing-button--light">
              Ingresar
            </Link>
          </div>
        </section>
      </main>

      <footer id="contacto" className="landing-footer">
        <div className="landing-container landing-footer__contact">
          <div>
            <img
              src="/jarvis-login-brand.png?v=1"
              alt="Jarvis"
              className="landing-footer__logo"
            />
            <p>Automatiza · Conecta · Simplifica</p>
          </div>
          <div className="landing-footer__details">
            <p>
              <strong>Teléfono:</strong>{' '}
              <a href="tel:+573195353367">319 535 3367</a>
            </p>
            <p>
              <strong>Correo:</strong>{' '}
              <a href="mailto:jarviscol2025@gmail.com">jarviscol2025@gmail.com</a>
            </p>
            <p>
              <strong>Web:</strong>{' '}
              <a href="https://www.jarviscol.com" target="_blank" rel="noreferrer">
                www.jarviscol.com
              </a>
            </p>
          </div>
        </div>

        <div className="landing-footer__badges">
          <div className="landing-container landing-footer__badges-inner">
            {FOOTER_BADGES.map((badge) => (
              <span key={badge}>{badge}</span>
            ))}
          </div>
        </div>
      </footer>
    </div>
  )
}

export default LandingPage
