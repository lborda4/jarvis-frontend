import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import type { ProductCategory } from '../constants/createProduct'
import './CategorySelect.css'

const PANEL_MAX_HEIGHT = 340
const PANEL_GAP = 6

type EditorState =
  | { mode: 'closed' }
  | { mode: 'create' }
  | { mode: 'edit'; categoryId: string; originalName: string }

export interface CategorySelectProps {
  id?: string
  /** Id de la categoría seleccionada, o '' si no hay ninguna. */
  value: string
  onChange: (id: string) => void
  categories: ProductCategory[]
  /**
   * Crea una categoría en el backend. Debe devolver la categoría creada (con
   * su id) o lanzar un Error con el mensaje a mostrar en el editor.
   */
  onCreate: (name: string) => Promise<ProductCategory>
  /**
   * Actualiza una categoría existente en el backend. Debe devolver la
   * categoría actualizada o lanzar un Error con el mensaje a mostrar.
   */
  onEdit: (id: string, name: string) => Promise<ProductCategory>
  placeholder?: string
  invalid?: boolean
  disabled?: boolean
}

/**
 * Selector dinámico de categoría de producto. Muestra un combobox que despliega
 * un panel flotante con buscador por nombre, permite seleccionar una categoría
 * existente, editarla (ícono de lápiz) o crear una nueva desde el pie del panel.
 * Crear y editar persisten contra el backend a través de onCreate/onEdit.
 */
function CategorySelect({
  id,
  value,
  onChange,
  categories,
  onCreate,
  onEdit,
  placeholder = 'Selecciona una categoría...',
  invalid = false,
  disabled = false,
}: CategorySelectProps) {
  const panelId = useId()
  const containerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({})
  const [editor, setEditor] = useState<EditorState>({ mode: 'closed' })
  const [draftName, setDraftName] = useState('')
  const [draftError, setDraftError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === value) ?? null,
    [categories, value],
  )

  const filteredCategories = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return categories
    return categories.filter((category) =>
      category.name.toLowerCase().includes(normalized),
    )
  }, [categories, query])

  const closePanel = useCallback(() => {
    setIsOpen(false)
    setQuery('')
    setEditor({ mode: 'closed' })
    setDraftName('')
    setDraftError(null)
    setIsSaving(false)
  }, [])

  const updatePanelPosition = useCallback(() => {
    const container = containerRef.current
    if (!container) return

    const rect = container.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom - PANEL_GAP
    const spaceAbove = rect.top - PANEL_GAP
    const openAbove = spaceBelow < 240 && spaceAbove > spaceBelow

    const base: CSSProperties = {
      position: 'fixed',
      left: rect.left,
      width: rect.width,
      zIndex: 1000,
    }

    if (openAbove) {
      setPanelStyle({
        ...base,
        bottom: window.innerHeight - rect.top + PANEL_GAP,
        maxHeight: Math.min(PANEL_MAX_HEIGHT, Math.max(spaceAbove, 200)),
      })
      return
    }

    setPanelStyle({
      ...base,
      top: rect.bottom + PANEL_GAP,
      maxHeight: Math.min(PANEL_MAX_HEIGHT, Math.max(spaceBelow, 200)),
    })
  }, [])

  useLayoutEffect(() => {
    if (!isOpen) return

    updatePanelPosition()
    const handleReposition = () => updatePanelPosition()
    window.addEventListener('resize', handleReposition)
    window.addEventListener('scroll', handleReposition, true)
    return () => {
      window.removeEventListener('resize', handleReposition)
      window.removeEventListener('scroll', handleReposition, true)
    }
  }, [isOpen, filteredCategories.length, editor.mode, updatePanelPosition])

  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        closePanel()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, closePanel])

  useEffect(() => {
    if (isOpen && editor.mode === 'closed') {
      searchInputRef.current?.focus()
    }
  }, [isOpen, editor.mode])

  const togglePanel = () => {
    if (disabled) return
    if (isOpen) {
      closePanel()
      return
    }
    setIsOpen(true)
  }

  const selectCategory = (category: ProductCategory) => {
    onChange(category.id)
    closePanel()
  }

  const startCreate = () => {
    setDraftName('')
    setDraftError(null)
    setEditor({ mode: 'create' })
  }

  const startEdit = (category: ProductCategory) => {
    setDraftName(category.name)
    setDraftError(null)
    setEditor({
      mode: 'edit',
      categoryId: category.id,
      originalName: category.name,
    })
  }

  const cancelEditor = () => {
    setEditor({ mode: 'closed' })
    setDraftName('')
    setDraftError(null)
    setIsSaving(false)
  }

  const saveDraft = async () => {
    if (isSaving || editor.mode === 'closed') return

    const name = draftName.trim()
    if (!name) {
      setDraftError('El nombre es obligatorio.')
      return
    }

    const duplicated = categories.some(
      (category) =>
        category.name.toLowerCase() === name.toLowerCase() &&
        !(editor.mode === 'edit' && category.id === editor.categoryId),
    )
    if (duplicated) {
      setDraftError('Ya existe una categoría con ese nombre.')
      return
    }

    setIsSaving(true)
    setDraftError(null)

    try {
      if (editor.mode === 'create') {
        const created = await onCreate(name)
        onChange(created.id)
      } else {
        const updated = await onEdit(editor.categoryId, name)
        if (value === editor.categoryId) {
          onChange(updated.id)
        }
      }
      closePanel()
    } catch (error) {
      setDraftError(
        error instanceof Error
          ? error.message
          : 'No se pudo guardar la categoría.',
      )
      setIsSaving(false)
    }
  }

  const valueLabel = selectedCategory ? selectedCategory.name : ''

  return (
    <div className="category-select" ref={containerRef}>
      <button
        id={id}
        type="button"
        className={`category-select__control${
          invalid ? ' category-select__control--invalid' : ''
        }`}
        onClick={togglePanel}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span
          className={`category-select__value${
            valueLabel ? '' : ' category-select__value--placeholder'
          }`}
        >
          {valueLabel || placeholder}
        </span>
        <ChevronIcon open={isOpen} />
      </button>

      {isOpen && (
        <div className="category-select__panel" style={panelStyle} role="dialog">
          {editor.mode === 'closed' ? (
            <>
              <div className="category-select__search">
                <SearchIcon />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar por nombre..."
                  aria-label="Buscar categoría"
                />
              </div>

              <ul className="category-select__list" id={panelId} role="listbox">
                {filteredCategories.length === 0 ? (
                  <li className="category-select__empty">
                    No hay categorías que coincidan.
                  </li>
                ) : (
                  filteredCategories.map((category) => {
                    const selected = category.id === value
                    return (
                      <li key={category.id} className="category-select__row">
                        <button
                          type="button"
                          role="option"
                          aria-selected={selected}
                          className={`category-select__option${
                            selected ? ' category-select__option--selected' : ''
                          }`}
                          onClick={() => selectCategory(category)}
                        >
                          <span className="category-select__name">
                            {category.name}
                          </span>
                        </button>
                        <button
                          type="button"
                          className="category-select__edit"
                          onClick={() => startEdit(category)}
                          aria-label={`Editar categoría ${category.name}`}
                        >
                          <PencilIcon />
                        </button>
                      </li>
                    )
                  })
                )}
              </ul>

              <button
                type="button"
                className="category-select__create"
                onClick={startCreate}
              >
                <PlusIcon />
                Crear nueva categoría
              </button>
            </>
          ) : (
            <div className="category-select__editor">
              <h3 className="category-select__editor-title">
                {editor.mode === 'create'
                  ? 'Nueva categoría'
                  : 'Editar categoría'}
              </h3>

              <label className="category-select__editor-field">
                <span>Nombre</span>
                <input
                  type="text"
                  value={draftName}
                  onChange={(event) => {
                    setDraftName(event.target.value)
                    setDraftError(null)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      void saveDraft()
                    }
                  }}
                  placeholder="Ropa"
                  disabled={isSaving}
                  autoFocus
                />
              </label>

              {draftError && (
                <p className="category-select__editor-error">{draftError}</p>
              )}

              <div className="category-select__editor-actions">
                <button
                  type="button"
                  className="category-select__editor-btn category-select__editor-btn--ghost"
                  onClick={cancelEditor}
                  disabled={isSaving}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="category-select__editor-btn category-select__editor-btn--primary"
                  onClick={() => void saveDraft()}
                  disabled={isSaving}
                >
                  {isSaving
                    ? 'Guardando...'
                    : editor.mode === 'create'
                      ? 'Crear'
                      : 'Guardar'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`category-select__chevron${
        open ? ' category-select__chevron--open' : ''
      }`}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M6 9l6 6 6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path
        d="M21 21l-4.3-4.3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

function PencilIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 20h9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4 12.5-12.5z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

export default CategorySelect
