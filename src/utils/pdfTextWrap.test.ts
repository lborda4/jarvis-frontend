import { describe, expect, it } from 'vitest'
import { keepPdfWordIntact } from './pdfTextWrap'

describe('keepPdfWordIntact', () => {
  it('no parte la palabra para que react-pdf no inserte un guion', () => {
    expect(keepPdfWordIntact('LAURA')).toEqual(['LAURA'])
    expect(keepPdfWordIntact('BORDA')).toEqual(['BORDA'])
  })
})
