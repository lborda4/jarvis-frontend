import './CatalogRowActions.css'

export default function CatalogRowActions({ name, onEdit, onDelete, disabled = false }: {
  name: string
  onEdit: () => void
  onDelete: () => void
  disabled?: boolean
}) {
  return <div className="catalog-row-actions">
    <button type="button" onClick={onEdit} disabled={disabled} title="Editar" aria-label={`Editar ${name}`}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4 12.5-12.5z" />
      </svg>
    </button>
    <button type="button" className="catalog-row-actions__delete" onClick={onDelete} disabled={disabled} title="Eliminar" aria-label={`Eliminar ${name}`}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0-1 14a2 2 0 01-2 2H7a2 2 0 01-2-2L4 6h16z" />
      </svg>
    </button>
  </div>
}
