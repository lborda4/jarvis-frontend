import { type ReactNode, useEffect, useRef } from 'react'
import { CloseIcon } from './icons/SidebarIcons'
import './Modal.css'

export interface ModalProps {
  isOpen: boolean
  onClose: () => void
  labelledBy: string
  children: ReactNode
  /** Habilita la X de cierre. El fondo y Escape nunca cierran el modal. */
  dismissible?: boolean
  /** Mientras el modal está ocupado (guardando, etc.) la X se muestra pero deshabilitada. */
  busy?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

function Modal({
  isOpen,
  onClose,
  labelledBy,
  children,
  dismissible = true,
  busy = false,
  size = 'md',
  className,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const canClose = dismissible && !busy

  useEffect(() => {
    if (isOpen) {
      dialogRef.current?.focus()
    }
  }, [isOpen])

  if (!isOpen) {
    return null
  }

  const dialogClassName = [
    'modal-dialog',
    size !== 'md' ? `modal-dialog--${size}` : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="modal-overlay" role="presentation" onClick={event => event.stopPropagation()}>
      <div
        ref={dialogRef}
        className={dialogClassName}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="modal-dialog__close"
          onClick={onClose}
          disabled={!canClose}
          aria-label="Cerrar"
        >
          <CloseIcon />
        </button>
        {children}
      </div>
    </div>
  )
}

export default Modal
