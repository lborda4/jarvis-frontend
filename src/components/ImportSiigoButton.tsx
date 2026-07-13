interface ImportSiigoButtonProps {
  disabled?: boolean
  isLoading?: boolean
  selectedCount: number
  onClick: () => void
}

function ImportSiigoButton({
  disabled = false,
  isLoading = false,
  selectedCount,
  onClick,
}: ImportSiigoButtonProps) {
  const label = isLoading
    ? 'Importando...'
    : `Importar a SIIGO${selectedCount > 0 ? ` (${selectedCount})` : ''}`

  return (
    <button
      type="button"
      className="import-siigo-button"
      onClick={onClick}
      disabled={disabled || isLoading}
    >
      {label}
    </button>
  )
}

export default ImportSiigoButton
