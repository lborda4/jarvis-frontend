import { useRef, useState } from 'react'
import {
  ACCEPTED_FILE_EXTENSIONS,
  ACCEPTED_FILE_INPUT,
  detectDocumentSourceType,
  EXCEL_FILE_EXTENSIONS,
  EXCEL_FILE_INPUT,
  isExcelFile,
} from '../utils/fileType'

type FileUploadAcceptMode = 'documents' | 'excel'

interface FileUploadAreaProps {
  disabled: boolean
  onFileSelect: (file: File) => void
  onInvalidFile: (message: string) => void
  accept?: FileUploadAcceptMode
  title?: string
  hint?: string
  ariaLabel?: string
}

const ACCEPT_CONFIG = {
  documents: {
    extensions: ACCEPTED_FILE_EXTENSIONS,
    input: ACCEPTED_FILE_INPUT,
    invalidMessage:
      'Solo se permiten archivos Excel (.xlsx, .xls) o XML (.xml).',
    isValid: detectDocumentSourceType,
    defaultTitle: 'Haz clic para seleccionar un archivo',
    defaultHint: `Formatos permitidos: ${ACCEPTED_FILE_EXTENSIONS.join(', ')}`,
    defaultAriaLabel: 'Seleccionar archivo Excel o XML',
  },
  excel: {
    extensions: EXCEL_FILE_EXTENSIONS,
    input: EXCEL_FILE_INPUT,
    invalidMessage: 'Solo se permiten archivos Excel (.xlsx, .xls).',
    isValid: isExcelFile,
    defaultTitle: 'Arrastra un archivo Excel o haz clic para seleccionarlo',
    defaultHint: `Formatos permitidos: ${EXCEL_FILE_EXTENSIONS.join(', ')}`,
    defaultAriaLabel: 'Seleccionar archivo Excel',
  },
} as const

function FileUploadArea({
  disabled,
  onFileSelect,
  onInvalidFile,
  accept = 'documents',
  title,
  hint,
  ariaLabel,
}: FileUploadAreaProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const config = ACCEPT_CONFIG[accept]

  const openFilePicker = () => {
    if (!disabled) {
      inputRef.current?.click()
    }
  }

  const validateAndSelect = (file: File) => {
    if (!config.isValid(file)) {
      onInvalidFile(config.invalidMessage)
      return
    }

    onFileSelect(file)
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) return

    validateAndSelect(file)
  }

  const handleDragOver = (event: React.DragEvent<HTMLButtonElement>) => {
    event.preventDefault()

    if (!disabled) {
      setIsDragging(true)
    }
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (event: React.DragEvent<HTMLButtonElement>) => {
    event.preventDefault()
    setIsDragging(false)

    if (disabled) return

    const file = event.dataTransfer.files[0]

    if (!file) return

    validateAndSelect(file)
  }

  return (
    <div className="file-upload">
      <button
        type="button"
        className={`file-upload__area${
          disabled ? ' file-upload__area--disabled' : ''
        }${isDragging ? ' file-upload__area--dragging' : ''}`}
        onClick={openFilePicker}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        disabled={disabled}
        aria-label={ariaLabel ?? config.defaultAriaLabel}
      >
        <span className="file-upload__icon" aria-hidden="true">
          📄
        </span>
        <span className="file-upload__title">
          {title ?? config.defaultTitle}
        </span>
        <span className="file-upload__hint">{hint ?? config.defaultHint}</span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept={config.input}
        onChange={handleFileChange}
        hidden
        disabled={disabled}
      />
    </div>
  )
}

export default FileUploadArea
