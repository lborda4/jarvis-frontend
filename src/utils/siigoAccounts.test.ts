import { describe, expect, it } from 'vitest'
import {
  mergeSuggestedAccountsIntoOptions,
  rematchRowAccountsToCatalog,
  resolveSuggestedAccountOption,
} from './siigoAccounts'
import type { ElectronicDocumentListItem } from '../types/electronicDocument'

const CATALOG = [
  { code: '51359501', description: 'Elementos de aseo' },
  { code: '51451001', description: 'Gastos de viaje' },
]

describe('resolveSuggestedAccountOption', () => {
  it('no inventa una opción fuera del catálogo usable cuando ya cargó', () => {
    // Caso real: historial/IA traen un padre o código que SIIGO rechaza en
    // compras; antes se mostraba igual y el primer envío fallaba.
    expect(
      resolveSuggestedAccountOption(
        { code: '5135', name: 'Gastos' },
        CATALOG,
      ),
    ).toBeNull()
  })

  it('devuelve la entrada real del catálogo cuando el código existe', () => {
    expect(
      resolveSuggestedAccountOption(
        { code: '51359501', name: '51359501' },
        CATALOG,
      ),
    ).toEqual({ code: '51359501', description: 'Elementos de aseo' })
  })

  it('deja provisional solo si el catálogo todavía no cargó', () => {
    expect(
      resolveSuggestedAccountOption({ code: '5135', name: 'Gastos' }, []),
    ).toEqual({ code: '5135', description: 'Gastos' })
  })
})

describe('rematchRowAccountsToCatalog', () => {
  it('limpia códigos sintéticos y remapea a la sugerencia válida del catálogo', () => {
    const document = {
      id: 'doc-1',
      suggestedAccount: { code: '51359501', name: 'Elementos de aseo' },
    } as ElectronicDocumentListItem

    const rematched = rematchRowAccountsToCatalog(
      [document],
      CATALOG,
      { 'doc-1': { code: '5135', description: 'Gastos' } },
      (item) => item.suggestedAccount,
    )

    expect(rematched['doc-1']).toEqual({
      code: '51359501',
      description: 'Elementos de aseo',
    })
  })
})

describe('mergeSuggestedAccountsIntoOptions', () => {
  it('no inyecta códigos sugeridos fuera del catálogo en el picker', () => {
    const documents = [
      {
        id: 'doc-1',
        suggestedAccount: { code: '99999999', name: 'Fantasma' },
      },
    ] as ElectronicDocumentListItem[]

    expect(mergeSuggestedAccountsIntoOptions(CATALOG, documents)).toEqual(CATALOG)
  })
})
