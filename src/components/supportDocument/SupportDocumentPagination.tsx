import {
  ELECTRONIC_DOCUMENT_PAGE_SIZE_OPTIONS,
  type ElectronicDocumentPageSize,
} from '../../constants/electronicDocuments'

interface SupportDocumentPaginationProps {
  page: number
  limit: number
  total: number
  disabled?: boolean
  onPageChange: (page: number) => void
  onLimitChange: (limit: ElectronicDocumentPageSize) => void
}

function SupportDocumentPagination({
  page,
  limit,
  total,
  disabled = false,
  onPageChange,
  onLimitChange,
}: SupportDocumentPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / limit))
  const start = total === 0 ? 0 : (page - 1) * limit + 1
  const end = Math.min(page * limit, total)

  return (
    <nav className="support-pagination" aria-label="Paginación de documentos">
      <label className="support-pagination__size">
        <span>Filas por página:</span>
        <select
          value={limit}
          disabled={disabled}
          aria-label="Filas por página"
          onChange={(event) =>
            onLimitChange(Number(event.target.value) as ElectronicDocumentPageSize)
          }
        >
          {ELECTRONIC_DOCUMENT_PAGE_SIZE_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>

      <p className="support-pagination__summary">
        {total === 0
          ? 'Sin documentos para mostrar'
          : `${start} a ${end} de ${total}`}
      </p>

      <div className="support-pagination__controls">
        <button
          type="button"
          className="support-pagination__nav"
          disabled={disabled || page <= 1}
          aria-label="Primera página"
          onClick={() => onPageChange(1)}
        >
          «
        </button>

        <button
          type="button"
          className="support-pagination__nav"
          disabled={disabled || page <= 1}
          aria-label="Página anterior"
          onClick={() => onPageChange(page - 1)}
        >
          ‹
        </button>

        <span className="support-pagination__page-info">
          Página {page} de {totalPages}
        </span>

        <button
          type="button"
          className="support-pagination__nav"
          disabled={disabled || page >= totalPages}
          aria-label="Página siguiente"
          onClick={() => onPageChange(page + 1)}
        >
          ›
        </button>

        <button
          type="button"
          className="support-pagination__nav"
          disabled={disabled || page >= totalPages}
          aria-label="Última página"
          onClick={() => onPageChange(totalPages)}
        >
          »
        </button>
      </div>
    </nav>
  )
}

export default SupportDocumentPagination
