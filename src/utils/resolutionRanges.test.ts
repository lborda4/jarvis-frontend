import { describe, expect, it } from 'vitest'
import type { JarvisAvailableResolution } from '../types/jarvis'
import { getActiveRanges, groupByDocumentType } from './resolutionRanges'

const YESTERDAY = '2020-01-01'
const FUTURE = '2099-01-01'

function buildResolution(
  overrides: Partial<JarvisAvailableResolution> = {},
): JarvisAvailableResolution {
  return {
    id: 'FE-123',
    prefix: 'FE',
    formNumber: '18760000001',
    fromNumber: 1,
    toNumber: 10000,
    nextConsecutive: 42,
    dateFrom: YESTERDAY,
    dateTo: FUTURE,
    documentTypeLabel: 'Factura electrónica de Venta',
    typeDocumentId: 1,
    ...overrides,
  }
}

describe('getActiveRanges', () => {
  it('excluye rangos sin resolución (formNumber null)', () => {
    const data = [buildResolution({ formNumber: null })]
    expect(getActiveRanges(data)).toHaveLength(0)
  })

  it('excluye rangos vencidos o que aún no empiezan', () => {
    const expired = buildResolution({ dateFrom: '2010-01-01', dateTo: '2011-01-01' })
    const notStartedYet = buildResolution({ dateFrom: FUTURE, dateTo: FUTURE })
    expect(getActiveRanges([expired, notStartedYet])).toHaveLength(0)
  })

  it('incluye un rango sin fechas (no se descarta por ausencia de límites)', () => {
    const data = [buildResolution({ dateFrom: null, dateTo: null })]
    expect(getActiveRanges(data)).toHaveLength(1)
  })

  it('marca hasConflict cuando hay más de un rango activo del mismo tipo', () => {
    const data = [
      buildResolution({ id: 'FE-1', typeDocumentId: 1 }),
      buildResolution({ id: 'FE-2', typeDocumentId: 1 }),
      buildResolution({ id: 'DS-1', typeDocumentId: 11, documentTypeLabel: 'Documento Soporte' }),
    ]

    const active = getActiveRanges(data)

    expect(active.find((item) => item.id === 'FE-1')?.hasConflict).toBe(true)
    expect(active.find((item) => item.id === 'FE-2')?.hasConflict).toBe(true)
    expect(active.find((item) => item.id === 'DS-1')?.hasConflict).toBe(false)
  })

  it('agrupa por typeDocumentId aunque documentTypeLabel venga null', () => {
    const data = [
      buildResolution({ id: 'A', documentTypeLabel: null, typeDocumentId: 1 }),
      buildResolution({ id: 'B', documentTypeLabel: null, typeDocumentId: 1 }),
    ]

    const active = getActiveRanges(data)
    expect(active.every((item) => item.hasConflict)).toBe(true)
  })
})

describe('groupByDocumentType', () => {
  it('agrupa cada rango bajo su tipo de documento', () => {
    const active = getActiveRanges([
      buildResolution({ id: 'FE-1', typeDocumentId: 1, documentTypeLabel: 'Factura electrónica de Venta' }),
      buildResolution({ id: 'DS-1', typeDocumentId: 11, documentTypeLabel: 'Documento Soporte Electrónico' }),
    ])

    const groups = groupByDocumentType(active)

    expect(groups).toHaveLength(2)
    expect(groups.map((group) => group.label).sort()).toEqual([
      'Documento Soporte Electrónico',
      'Factura electrónica de Venta',
    ])
    expect(groups.find((group) => group.typeDocumentId === 1)?.ranges).toHaveLength(1)
  })

  it('propaga hasConflict al grupo cuando alguno de sus rangos está en conflicto', () => {
    const active = getActiveRanges([
      buildResolution({ id: 'FE-1', typeDocumentId: 1 }),
      buildResolution({ id: 'FE-2', typeDocumentId: 1 }),
    ])

    const [group] = groupByDocumentType(active)
    expect(group.hasConflict).toBe(true)
    expect(group.ranges).toHaveLength(2)
  })

  it('usa "Sin tipo de documento" cuando no hay label ni id', () => {
    const active = getActiveRanges([
      buildResolution({ documentTypeLabel: null, typeDocumentId: null }),
    ])

    const [group] = groupByDocumentType(active)
    expect(group.label).toBe('Sin tipo de documento')
  })
})
