import { useRef, useState } from 'react'
import type { DragEvent } from 'react'
import Button from '../components/Button'
import PageHeader from '../components/PageHeader'
import {
  AlertIcon,
  CalendarIcon,
  CheckIcon,
  ChevronRightIcon,
  CloseIcon,
  CloudUploadIcon,
  DocumentIcon,
} from '../components/icons/SidebarIcons'
import './BankStatementClosingPage.css'

const STEPS = [
  { label: 'Cargar Extracto', description: 'Sube tu archivo' },
  { label: 'Analizar con IA', description: 'Jarvis procesa la información' },
  { label: 'Resultado del Cierre', description: 'Revisa el resumen' },
  { label: 'Confirmar', description: 'Cerrar conciliación' },
]

const ACTIVE_STEP_INDEX = 2

const ACCEPTED_EXTENSIONS = '.pdf,.xlsx,.xls,.csv'

interface SelectedFile {
  name: string
  sizeLabel: string
}

const EXAMPLE_FILE: SelectedFile = {
  name: 'Extracto_Bancolombia_Mayo_2026.pdf',
  sizeLabel: '2.3 MB',
}

const CHECKLIST_ITEMS = [
  'Conciliación automática',
  'Validación de saldos',
  'Cruce de información',
]

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function BankStatementClosingPage() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(EXAMPLE_FILE)
  const [confirmMessage, setConfirmMessage] = useState<string | null>(null)

  const openFilePicker = () => inputRef.current?.click()

  const handleFile = (file: File) => {
    setSelectedFile({ name: file.name, sizeLabel: formatFileSize(file.size) })
    setConfirmMessage(null)
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (file) {
      handleFile(file)
    }
  }

  const handleDragOver = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => setIsDragging(false)

  const handleDrop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault()
    setIsDragging(false)
    const file = event.dataTransfer.files[0]

    if (file) {
      handleFile(file)
    }
  }

  return (
    <main className="bank-closing-page">
      <PageHeader
        title={
          <>
            Cierre de Extracto Bancario con IA <span aria-hidden="true">🪄</span>
          </>
        }
        description="Sube tu extracto y deja que Jarvis haga el cierre por ti."
      />

      <nav className="bank-closing-stepper" aria-label="Pasos del cierre">
        {STEPS.map((step, index) => {
          const isComplete = index < ACTIVE_STEP_INDEX
          const isActive = index === ACTIVE_STEP_INDEX

          return (
            <div
              key={step.label}
              className={[
                'bank-closing-stepper__item',
                isComplete ? 'bank-closing-stepper__item--complete' : '',
                index > 0 ? 'bank-closing-stepper__item--connected' : '',
                index > 0 && index <= ACTIVE_STEP_INDEX
                  ? 'bank-closing-stepper__item--connector-done'
                  : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <span
                className={[
                  'bank-closing-stepper__badge',
                  isComplete ? 'bank-closing-stepper__badge--complete' : '',
                  isActive ? 'bank-closing-stepper__badge--active' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {isComplete ? <CheckIcon /> : index + 1}
              </span>
              <span className="bank-closing-stepper__copy">
                <strong>{step.label}</strong>
                <small>{step.description}</small>
              </span>
            </div>
          )
        })}
      </nav>

      <div className="bank-closing-grid">
        <section className="bank-closing-card">
          <h2 className="bank-closing-card__title">Subir Extracto Bancario</h2>

          <button
            type="button"
            className={`bank-closing-dropzone${
              isDragging ? ' bank-closing-dropzone--dragging' : ''
            }`}
            onClick={openFilePicker}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <CloudUploadIcon className="bank-closing-dropzone__icon" />
            <span className="bank-closing-dropzone__title">Arrastra tu archivo aquí</span>
            <span className="bank-closing-dropzone__hint">
              o selecciona desde tu equipo
            </span>
            <span className="bank-closing-dropzone__button">Seleccionar archivo</span>
            <span className="bank-closing-dropzone__formats">Formatos: PDF, XLSX, CSV</span>
          </button>

          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_EXTENSIONS}
            onChange={handleFileChange}
            hidden
          />

          {selectedFile && (
            <div className="bank-closing-file-chip">
              <DocumentIcon className="bank-closing-file-chip__icon" />
              <div className="bank-closing-file-chip__info">
                <span className="bank-closing-file-chip__name">{selectedFile.name}</span>
                <span className="bank-closing-file-chip__meta">
                  {selectedFile.sizeLabel} · Cargado correctamente
                </span>
              </div>
              <button
                type="button"
                className="bank-closing-file-chip__remove"
                onClick={() => setSelectedFile(null)}
                aria-label="Quitar archivo"
              >
                <CloseIcon />
              </button>
            </div>
          )}
        </section>

        <section className="bank-closing-card">
          <h2 className="bank-closing-card__title">Resumen del Cierre (IA)</h2>

          <dl className="bank-closing-summary">
            <div className="bank-closing-summary__row">
              <dt>
                <CalendarIcon className="bank-closing-summary__icon" />
                Banco
              </dt>
              <dd>Bancolombia</dd>
            </div>
            <div className="bank-closing-summary__row">
              <dt>
                <DocumentIcon className="bank-closing-summary__icon" />
                Cuenta
              </dt>
              <dd>Ahorros •••• 4587</dd>
            </div>
            <div className="bank-closing-summary__row">
              <dt>
                <CalendarIcon className="bank-closing-summary__icon" />
                Periodo
              </dt>
              <dd>01 Mayo – 31 Mayo 2026</dd>
            </div>
            <div className="bank-closing-summary__row">
              <dt>
                <CalendarIcon className="bank-closing-summary__icon" />
                Fecha de Cargue
              </dt>
              <dd>18 Ago 2026 · 10:45 AM</dd>
            </div>
          </dl>

          <div className="bank-closing-totals">
            <div className="bank-closing-totals__row">
              <span>Saldo Inicial</span>
              <strong>$ 125.450.000,00</strong>
            </div>
            <div className="bank-closing-totals__row">
              <span>Total Créditos</span>
              <strong className="bank-closing-totals__value--positive">
                $ 45.850.300,00
              </strong>
            </div>
            <div className="bank-closing-totals__row">
              <span>Total Débitos</span>
              <strong className="bank-closing-totals__value--negative">
                $ 42.535.000,00
              </strong>
            </div>
          </div>

          <div className="bank-closing-final-balance">
            <span>Saldo Final (IA)</span>
            <strong>$ 128.765.300,00</strong>
          </div>
        </section>

        <section className="bank-closing-card">
          <h2 className="bank-closing-card__title">Estado del Cierre</h2>

          <div className="bank-closing-status">
            <span className="bank-closing-status__badge" aria-hidden="true">
              <CheckIcon />
            </span>
            <strong className="bank-closing-status__title">Todo cuadrado</strong>
            <span className="bank-closing-status__subtitle">
              No se detectaron diferencias
            </span>
          </div>

          <ul className="bank-closing-checklist">
            {CHECKLIST_ITEMS.map((item) => (
              <li key={item}>
                <CheckIcon className="bank-closing-checklist__icon" />
                <span>{item}</span>
                <span className="bank-closing-checklist__status">Completado</span>
              </li>
            ))}
          </ul>

          <div className="bank-closing-tip">
            <AlertIcon className="bank-closing-tip__icon" />
            <p>
              Si detectas algún movimiento que requiera ajuste, puedes editar
              manualmente antes de confirmar.
            </p>
          </div>
        </section>
      </div>

      <section className="bank-closing-confirm">
        <span className="bank-closing-confirm__badge" aria-hidden="true">
          <CheckIcon />
        </span>
        <h2>Extracto listo para cerrar</h2>
        <p>Jarvis finalizó el cierre automático. Puedes confirmarlo y guardarlo.</p>

        <div className="bank-closing-confirm__actions">
          <Button
            variant="primary"
            onClick={() => setConfirmMessage('Cierre confirmado (demostración).')}
          >
            Confirmar y Cerrar <ChevronRightIcon />
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              setConfirmMessage('El reporte en PDF estará disponible próximamente.')
            }
          >
            <DocumentIcon /> Ver Reporte PDF
          </Button>
        </div>

        {confirmMessage && (
          <p className="bank-closing-confirm__message" role="status">
            {confirmMessage}
          </p>
        )}
      </section>
    </main>
  )
}

export default BankStatementClosingPage
