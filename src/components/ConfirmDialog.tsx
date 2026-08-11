import type { ReactNode } from 'react'
import Button from './Button'
import Modal from './Modal'

export interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  message: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'primary' | 'danger'
  isBusy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/** Reemplaza window.confirm() por un diálogo con el mismo look & feel del resto de la app. */
function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'primary',
  isBusy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      busy={isBusy}
      labelledBy="confirm-dialog-title"
      size="sm"
    >
      <h2 id="confirm-dialog-title" className="modal-dialog__title">
        {title}
      </h2>
      <div className="modal-dialog__content">
        <p>{message}</p>
      </div>
      <div className="modal-dialog__actions">
        <Button variant="secondary" onClick={onCancel} disabled={isBusy}>
          {cancelLabel}
        </Button>
        <Button
          variant={variant === 'danger' ? 'danger' : 'primary'}
          onClick={onConfirm}
          disabled={isBusy}
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}

export default ConfirmDialog
