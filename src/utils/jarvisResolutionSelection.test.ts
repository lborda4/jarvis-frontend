import { describe, expect, it } from 'vitest'
import type { JarvisAvailableResolution, JarvisDianResolution } from '../types/jarvis'
import { restoreJarvisResolutionSelection } from './jarvisResolutionSelection'

const saved: JarvisDianResolution = {
  kind: 'ELECTRONIC_INVOICE', documentTypeLabel: 'Factura electrónica de venta',
  prefix: 'JAR', formNumber: '18764117060528', fromNumber: 1, toNumber: 100,
  nextConsecutive: 24,
}
const available: JarvisAvailableResolution = {
  id: 'invoice-1', prefix: 'JAR', formNumber: saved.formNumber,
  fromNumber: 1, toNumber: 100, nextConsecutive: 25,
}

describe('restaurar la resolución guardada', () => {
  it('recupera la selección al volver aunque el consecutivo haya avanzado', () => {
    const result = restoreJarvisResolutionSelection([available], saved)
    expect(result.selectedId).toBe('invoice-1')
    expect(result.options).toEqual([available])
  })
  it('mantiene visible la guardada mientras el catálogo no está disponible', () => {
    const result = restoreJarvisResolutionSelection([], saved)
    expect(result.options.find(option => option.id === result.selectedId)).toMatchObject({
      prefix: 'JAR', formNumber: saved.formNumber, fromNumber: 1, toNumber: 100,
    })
  })
  it('no confunde otra autorización del mismo prefijo', () => {
    const other = { ...available, formNumber: 'other-authorization' }
    const result = restoreJarvisResolutionSelection([other], saved)
    expect(result.selectedId).not.toBe(other.id)
    expect(result.options).toHaveLength(2)
  })
  it('distingue los rangos autorizados', () => {
    const result = restoreJarvisResolutionSelection([{ ...available, toNumber: 200 }], saved)
    expect(result.selectedId).toBe('saved-ELECTRONIC_INVOICE')
  })
  it('conserva por separado la resolución de documento soporte', () => {
    const result = restoreJarvisResolutionSelection([], { ...saved, kind: 'SUPPORT_DOCUMENT', prefix: 'DS' })
    expect(result.selectedId).toBe('saved-SUPPORT_DOCUMENT')
    expect(result.options[0].prefix).toBe('DS')
  })
  it('no elige automáticamente una resolución cuando no hay ninguna guardada', () => {
    expect(restoreJarvisResolutionSelection([available], null)).toEqual({ options: [available], selectedId: '' })
  })
})
