/** Converts Colombian input to a decimal string suitable for calculations/API calls. */
export function parseMoneyInput(value: string): string {
  const clean = value.replace(/[^\d,]/g, '')
  if (!clean) return ''
  const [whole, ...fractions] = clean.split(',')
  const integer = (whole || '0').replace(/^0+(?=\d)/, '')
  return integer + (fractions.length ? `.${fractions.join('').slice(0, 2)}` : '')
}

export function formatMoneyInput(value: string | number, padDecimals = false): string {
  if (value === '') return ''
  const [whole, fraction] = String(value).split('.')
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const decimals = padDecimals ? (fraction ?? '').padEnd(2, '0') : fraction
  return grouped + (decimals !== undefined ? `,${decimals}` : '')
}
