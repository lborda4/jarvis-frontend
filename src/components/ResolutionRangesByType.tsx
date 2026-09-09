import { useMemo, useState } from 'react'
import type { JarvisAvailableResolution } from '../types/jarvis'
import {
  documentTypeKey,
  getActiveRanges,
  groupByDocumentType,
  type DocumentTypeRangeGroup,
} from '../utils/resolutionRanges'
import './ResolutionRangesByType.css'

interface ResolutionRangesByTypeProps {
  resolutions: JarvisAvailableResolution[]
}

function formatDate(value?: string | null): string {
  if (!value) return '—'
  return value.slice(0, 10)
}

const EMPTY_GROUP: Omit<DocumentTypeRangeGroup, 'typeDocumentId' | 'label'> = {
  ranges: [],
  hasConflict: false,
}

function ResolutionRangesByType({ resolutions }: ResolutionRangesByTypeProps) {
  // Una pestaña por cada tipo de documento que aparezca en los datos, tenga
  // o no un rango activo hoy — si solo se armaran pestañas a partir de
  // groupByDocumentType (que solo agrupa lo YA activo), un tipo sin ningún
  // rango vigente simplemente no tendría pestaña, en vez de mostrar el
  // mensaje "Sin rango vigente" que pide el punto 3.
  const groups = useMemo<DocumentTypeRangeGroup[]>(() => {
    const activeGroupsByKey = new Map(
      groupByDocumentType(getActiveRanges(resolutions)).map((group) => [
        group.typeDocumentId != null
          ? `id:${group.typeDocumentId}`
          : `label:${group.label}`,
        group,
      ]),
    )

    const allTypesByKey = new Map<string, DocumentTypeRangeGroup>()

    for (const item of resolutions) {
      const key = documentTypeKey(item)

      if (allTypesByKey.has(key)) {
        continue
      }

      const label = item.documentTypeLabel?.trim() || 'Sin tipo de documento'

      allTypesByKey.set(
        key,
        activeGroupsByKey.get(key) ?? {
          typeDocumentId: item.typeDocumentId ?? null,
          label,
          ...EMPTY_GROUP,
        },
      )
    }

    return Array.from(allTypesByKey.values()).sort((a, b) =>
      a.label.localeCompare(b.label, 'es'),
    )
  }, [resolutions])

  const [activeTab, setActiveTab] = useState<string | null>(null)

  if (groups.length === 0) {
    return null
  }

  const activeKey =
    activeTab && groups.some((group) => group.label === activeTab)
      ? activeTab
      : groups[0].label
  const activeGroup = groups.find((group) => group.label === activeKey) ?? groups[0]

  return (
    <div className="resolution-ranges">
      <div className="resolution-ranges__tabs" role="tablist">
        {groups.map((group) => (
          <button
            key={group.label}
            type="button"
            role="tab"
            aria-selected={group.label === activeKey}
            className={`resolution-ranges__tab${
              group.label === activeKey ? ' is-active' : ''
            }`}
            onClick={() => setActiveTab(group.label)}
          >
            {group.label}
            {group.hasConflict && (
              <span
                className="resolution-ranges__badge"
                title="Hay más de un rango vigente para este tipo de documento"
              >
                Revisar: rangos duplicados
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="resolution-ranges__panel" role="tabpanel">
        {activeGroup.ranges.length === 0 ? (
          <p className="resolution-ranges__empty">
            Sin rango vigente para este tipo de documento.
          </p>
        ) : (
          <div className="resolution-ranges__table-wrap">
            <table className="resolution-ranges__table">
              <thead>
                <tr>
                  <th>Prefijo</th>
                  <th>Resolución</th>
                  <th>Vigente desde</th>
                  <th>Vigente hasta</th>
                  <th>Próximo consecutivo</th>
                </tr>
              </thead>
              <tbody>
                {activeGroup.ranges.map((range) => (
                  <tr key={range.id}>
                    <td>{range.prefix}</td>
                    <td>{range.formNumber ?? '—'}</td>
                    <td>{formatDate(range.dateFrom)}</td>
                    <td>{formatDate(range.dateTo)}</td>
                    <td>{range.nextConsecutive ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default ResolutionRangesByType
