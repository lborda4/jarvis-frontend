interface SupportDocumentPaginationProps {
  page: number
  limit: number
  total: number
  disabled?: boolean
  onPageChange: (page: number) => void
}

function SupportDocumentPagination({
  page,
  limit,
  total,
  disabled = false,
  onPageChange,
}: SupportDocumentPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / limit))
  const start = total === 0 ? 0 : (page - 1) * limit + 1
  const end = Math.min(page * limit, total)

  return (
    <nav className="support-pagination" aria-label="Paginación de documentos">
      <p className="support-pagination__summary">
        {total === 0
          ? 'Sin documentos para mostrar'
          : `Mostrando ${start}-${end} de ${total} documento(s)`}
      </p>

      <div className="support-pagination__controls">
        <button
          type="button"
          className="support-pagination__nav"
          disabled={disabled || page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Anterior
        </button>

        <span
          className="support-pagination__page support-pagination__page--active"
          aria-current="page"
        >
          {page}
        </span>

        <button
          type="button"
          className="support-pagination__nav"
          disabled={disabled || page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Siguiente
        </button>
      </div>

      <p className="support-pagination__summary">
        Página {page} de {totalPages}
      </p>
    </nav>
  )
}

export default SupportDocumentPagination
