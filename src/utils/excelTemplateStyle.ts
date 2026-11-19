import * as XLSX from 'xlsx'

/** Styles for downloaded workbooks; Excel needs literal colors and point sizes. */
const colors = {
  header: '0F766E', optional: '64748B', accent: '0D9488',
  text: '1F2937', border: 'D7DEE7', alternate: 'F0FDFA',
  white: 'FFFFFF', example: 'FFF3CD',
} as const

function entryWidth(header: string): number {
  const label = header.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  if (/descripcion|observacion|nota|razon social|nombre \*|correo|direccion/.test(label)) return 28
  if (/identificacion|numero de documento|sku/.test(label)) return 20
  if (/tipo de documento|tipo_documento/.test(label)) return 17
  if (/fecha|vencimiento|periodo/.test(label)) return 14
  if (/cantidad|digito|dias|tarifa|\(%\)|moneda/.test(label)) return 12
  if (/precio|valor|descuento|salario|auxilio|salud|pension/.test(label)) return 16
  return Math.min(22, Math.max(14, Math.ceil(header.length * 0.7) + 2))
}

export function styleExcelTemplate(book: XLSX.WorkBook, exampleSheets: string[] = []): XLSX.WorkBook {
  for (const [sheetIndex, name] of book.SheetNames.entries()) {
    const sheet = book.Sheets[name]
    if (!sheet['!ref']) continue
    const range = XLSX.utils.decode_range(sheet['!ref'])
    const inputSheet = sheetIndex === 0 && name !== 'Instrucciones'
    const instructions = name === 'Instrucciones'
    const columns = sheet['!cols'] ?? []
    const rows = sheet['!rows'] ?? []
    rows[0] = { ...rows[0], hpt: 44 }
    let lastVisibleColumn = 0
    for (let c = 0; c <= range.e.c; c++) {
      if (columns[c]?.hidden) continue
      lastVisibleColumn = c
      const header = String(sheet[XLSX.utils.encode_cell({ r: 0, c })]?.v ?? '')
      columns[c] = {
        ...columns[c],
        wch: instructions ? (c === 0 ? 26 : 68)
          : inputSheet ? entryWidth(header) : Math.min(columns[c]?.wch ?? 26, 36),
      }
      // Width fields from an imported sheet can otherwise override wch.
      delete columns[c].width
      delete columns[c].wpx
      for (let r = 0; r <= range.e.r; r++) {
        const address = XLSX.utils.encode_cell({ r, c })
        const cell = sheet[address] as XLSX.CellObject | undefined
        if (!cell) continue
        const heading = r === 0
        const background = heading ? (inputSheet && header && !header.endsWith('*') ? colors.optional : colors.header)
          : r === 1 && exampleSheets.includes(name) ? colors.example
            : r % 2 === 0 ? colors.alternate : colors.white
        cell.s = {
          font: { name: 'Calibri', sz: 11, bold: heading, color: { rgb: heading ? colors.white : colors.text } },
          fill: { patternType: 'solid', fgColor: { rgb: background } },
          alignment: { vertical: heading ? 'center' : 'top', horizontal: heading ? 'center' : undefined, wrapText: true },
          border: {
            right: { style: 'hair', color: { rgb: colors.border } },
            bottom: { style: heading ? 'medium' : 'hair', color: { rgb: heading ? colors.accent : colors.border } },
          },
        }
        if (!heading) {
          const text = String(cell.v ?? '')
          const lines = text.split('\n').reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / columns[c].wch!)), 0)
          rows[r] = { ...rows[r], hpt: Math.max(rows[r]?.hpt ?? 21, lines * 15 + 6) }
        }
      }
    }
    sheet['!cols'] = columns
    sheet['!rows'] = rows
    if (!instructions && !sheet['!autofilter']) sheet['!autofilter'] = { ref: `A1:${XLSX.utils.encode_col(lastVisibleColumn)}${range.e.r + 1}` }
  }
  return book
}
