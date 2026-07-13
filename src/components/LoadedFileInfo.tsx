import type { LoadedDocumentInfo } from '../types/documentSource'
import { formatFileSize } from '../utils/formatFileSize'

interface LoadedFileInfoProps {
  document?: LoadedDocumentInfo
  fileName?: string
  fileSizeBytes?: number
  sourceLabel?: string
  onChangeFile?: () => void
  changeFileDisabled?: boolean
}

function LoadedFileInfo({
  document,
  fileName,
  fileSizeBytes,
  sourceLabel,
  onChangeFile,
  changeFileDisabled = false,
}: LoadedFileInfoProps) {
  const resolvedFileName = document?.fileName ?? fileName ?? ''
  const resolvedSourceLabel = document?.sourceLabel ?? sourceLabel
  const resolvedFileSize = fileSizeBytes

  return (
    <div className="loaded-file-info" role="status">
      <div className="loaded-file-info__details">
        <span className="loaded-file-info__label">Archivo seleccionado</span>
        <span className="loaded-file-info__name">{resolvedFileName}</span>
        {resolvedFileSize !== undefined && (
          <span className="loaded-file-info__size">
            {formatFileSize(resolvedFileSize)}
          </span>
        )}
      </div>

      <div className="loaded-file-info__actions">
        {resolvedSourceLabel && (
          <span className="loaded-file-info__type">{resolvedSourceLabel}</span>
        )}
        {onChangeFile && (
          <button
            type="button"
            className="loaded-file-info__change-button"
            onClick={onChangeFile}
            disabled={changeFileDisabled}
          >
            Cambiar archivo
          </button>
        )}
      </div>
    </div>
  )
}

export default LoadedFileInfo
