import { useEffect, useState, type RefObject } from 'react'
import { ChevronDownIcon } from './icons/SidebarIcons'
import './ScrollToTopButton.css'

/** Cuánto hay que bajar para que aparezca el botón: lo bastante para que no
 * estorbe apenas se mueve la rueda, pero menos de una pantalla, así ya está
 * disponible en cuanto el encabezado de la página sale de vista. */
const SHOW_AFTER_PX = 320

interface ScrollToTopButtonProps {
  /** Contenedor que hace scroll. NO es la ventana: el layout fija el alto a
   * 100dvh y deja el scroll en .app-layout__content (ver AppLayout.css), así
   * que escuchar `window` no detectaría ningún movimiento. */
  scrollContainerRef: RefObject<HTMLElement | null>
}

function ScrollToTopButton({ scrollContainerRef }: ScrollToTopButtonProps) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const container = scrollContainerRef.current

    if (!container) {
      return
    }

    const updateVisibility = () => {
      setIsVisible(container.scrollTop > SHOW_AFTER_PX)
    }

    updateVisibility()
    container.addEventListener('scroll', updateVisibility, { passive: true })

    return () => {
      container.removeEventListener('scroll', updateVisibility)
    }
  }, [scrollContainerRef])

  const scrollToTop = () => {
    scrollContainerRef.current?.scrollTo({
      top: 0,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'auto'
        : 'smooth',
    })
  }

  if (!isVisible) {
    return null
  }

  return (
    <button
      type="button"
      className="scroll-to-top"
      onClick={scrollToTop}
      aria-label="Volver al inicio de la página"
      title="Volver arriba"
    >
      <ChevronDownIcon className="scroll-to-top__icon" />
    </button>
  )
}

export default ScrollToTopButton
