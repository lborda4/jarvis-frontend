export async function openPayrollPayslipPdf(generate: () => Promise<Blob>) {
  // Open synchronously from the click so the browser does not block the preview.
  const preview = window.open('about:blank', '_blank')
  if (!preview) throw new Error('Permite las ventanas emergentes para abrir el desprendible en otra pestaña.')
  preview.opener = null
  preview.document.title = 'Desprendible de nómina'
  preview.document.body.textContent = 'Generando desprendible…'
  let url: string | undefined
  try {
    const blob = await generate()
    if (preview.closed) return
    url = URL.createObjectURL(blob)
    preview.location.replace(url)
    const objectUrl = url
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 300_000)
  } catch (error) {
    if (url) URL.revokeObjectURL(url)
    preview.close()
    throw error
  }
}
