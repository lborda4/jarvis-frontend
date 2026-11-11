import { useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import Button from './Button'
import Modal from './Modal'
import { ExcelFileIcon } from './icons/ImportIcons'
import './ExcelImportLayout.css'

interface ExcelImportLayoutProps {
  title: string
  description: string
  templateDescription: ReactNode
  reviewDescription: ReactNode
  className: string
  fileName: string
  hasPreview: boolean
  busy: boolean
  downloading?: boolean
  status?: string
  notice?: ReactNode
  importLabel: string
  importDisabled: boolean
  finished: boolean
  onDownload: () => void
  onFile: (file: File) => void
  onImport: () => void
  onClose: () => void
  children: ReactNode
}

function SpreadsheetIllustration() {
  return <svg className="excel-import__illustration" viewBox="0 0 180 145" fill="none" aria-hidden="true">
    <path d="M32 33c31-40 103-27 126 9 36 56-7 99-73 94C18 131-7 86 32 33Z" fill="var(--jarvis-primary-soft)" />
    <rect x="44" y="30" width="105" height="94" rx="9" fill="var(--jarvis-white)" stroke="var(--jarvis-primary-hover)" strokeWidth="2.5" transform="rotate(3 44 30)" />
    <path d="m58 46 76 4-1 12-76-4Z" fill="var(--jarvis-primary)" />
    <path d="m57 69 75 4m-76 10 75 4m-76 10 75 4m-61-41-3 53m26-52-3 53m26-52-3 53" stroke="var(--jarvis-primary-border)" strokeWidth="1.5" />
    <rect x="20" y="72" width="45" height="45" rx="7" fill="var(--jarvis-primary-hover)" />
    <path d="m35 84 15 21m0-21-15 21" stroke="var(--jarvis-white)" strokeWidth="4" strokeLinecap="round" />
    <path d="m148 15 2-9m9 17 8-5" stroke="var(--jarvis-primary-hover)" strokeWidth="3" strokeLinecap="round" />
  </svg>
}

export default function ExcelImportLayout(props: ExcelImportLayoutProps) {
  const { busy, onClose } = props
  const titleId = useId()
  const fileId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [reviewing, setReviewing] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [fileError, setFileError] = useState('')

  const selectFiles = (files: FileList | null) => {
    if (busy || !files?.length) return
    setDragging(false)
    if (files.length > 1) { setFileError('Selecciona un solo archivo Excel a la vez.'); return }
    setFileError('')
    setReviewing(false)
    props.onFile(files[0])
  }

  return createPortal(<Modal isOpen busy={busy} onClose={onClose} labelledBy={titleId} size="lg" className={`${props.className} excel-import-modal`}>
    <header className="excel-import__header">
      <span className="excel-import__file-icon"><ExcelFileIcon /></span>
      <div><h2 id={titleId}>{props.title}</h2><p>{props.description}</p></div>
    </header>

    {!reviewing ? <ol className="excel-import__steps" aria-label="Pasos para importar el Excel">
      <li className="excel-import__step excel-import__step--template">
        <span className="excel-import__number" aria-hidden="true">1</span>
        <div className="excel-import__step-content">
          <h3>1. Descarga la plantilla</h3>
          <p>{props.templateDescription}</p>
          <Button variant="outline" disabled={busy} onClick={props.onDownload}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M12 3v12m-4-4 4 4 4-4M4 17v4h16v-4" strokeLinecap="round" strokeLinejoin="round" /></svg>
            {props.downloading ? 'Descargando…' : 'Descargar plantilla Excel'}
          </Button>
        </div>
        <SpreadsheetIllustration />
      </li>
      <li className="excel-import__step">
        <span className="excel-import__number" aria-hidden="true">2</span>
        <div className="excel-import__step-content">
          <h3>2. Carga tu archivo</h3>
          <div className={`excel-import__dropzone${dragging ? ' excel-import__dropzone--active' : ''}${busy ? ' excel-import__dropzone--busy' : ''}`}
            onDragOver={event => { event.preventDefault(); if (!busy) setDragging(true) }}
            onDragLeave={event => { if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setDragging(false) }}
            onDrop={event => { event.preventDefault(); setDragging(false); selectFiles(event.dataTransfer.files) }}>
            <input ref={inputRef} id={fileId} type="file" hidden accept=".xlsx,.xls" disabled={busy} onChange={event => { selectFiles(event.target.files); event.target.value = '' }} />
            <svg className="excel-import__cloud" width="55" height="48" viewBox="0 0 56 48" fill="none" stroke="currentColor" strokeWidth="2.8" aria-hidden="true"><path d="M15 36H12a10 10 0 0 1-1-20 16 16 0 0 1 30-3 11 11 0 0 1 2 23h-3M28 43V22m-8 8 8-8 8 8" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <strong>Arrastra tu archivo aquí</strong>
            <span>o <button type="button" className="excel-import__select" disabled={busy} onClick={() => inputRef.current?.click()}>selecciona un archivo</button> desde tu equipo</span>
            <small className="excel-import__format">Formato .xlsx o .xls · Máximo 5 MB</small>
          </div>
          {props.fileName && <p className="excel-import__selected-file"><ExcelFileIcon /><span>{props.fileName}</span>{props.hasPreview && <strong>Listo para revisar</strong>}</p>}
          {fileError && <p role="alert">{fileError}</p>}
        </div>
      </li>
      <li className="excel-import__step">
        <span className="excel-import__number" aria-hidden="true">3</span>
        <div className="excel-import__step-content">
          <h3>3. Verifica e importa</h3>
          <div className="excel-import__review-hint">
            <svg width="70" height="58" viewBox="0 0 70 58" fill="none" aria-hidden="true"><rect width="70" height="58" rx="12" fill="var(--jarvis-primary-soft)"/><g stroke="var(--jarvis-primary-hover)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="14" y="12" width="13" height="13" rx="2"/><path d="m17 18 3 3 4-5M37 18h19"/><rect x="14" y="34" width="13" height="13" rx="2"/><path d="m17 40 3 3 4-5M37 40h19"/></g></svg>
            <p>{props.reviewDescription}</p>
          </div>
        </div>
      </li>
    </ol> : <section className="excel-import__review" aria-label="Verificación del Excel">
      <h3>Verifica los datos antes de importar</h3>
      {props.children}
    </section>}

    {props.status && <p role="status" className="excel-import__status">{props.status}</p>}
    {props.notice}

    <footer className="excel-import__footer">
      {reviewing && <Button variant="ghost" disabled={busy} onClick={() => setReviewing(false)}>Volver</Button>}
      <div>
        <Button variant="secondary" disabled={busy} onClick={onClose}>{reviewing && props.finished ? 'Cerrar' : 'Cancelar'}</Button>
        {!reviewing ? <Button disabled={busy || !props.hasPreview} onClick={() => setReviewing(true)}>Continuar <span aria-hidden="true">›</span></Button>
          : !props.finished && <Button disabled={busy || props.importDisabled} onClick={props.onImport}>{props.importLabel}</Button>}
      </div>
    </footer>
  </Modal>, document.body)
}
