export class PdfModuleLoadError extends Error {
  constructor(cause: unknown) {
    super('No se pudo cargar el generador del PDF.', { cause })
    this.name = 'PdfModuleLoadError'
  }
}

export async function loadSalesInvoicePdfRenderer() {
  try {
    return await import('./salesInvoicePdf')
  } catch (error) {
    // A failed import can remain cached with the old deployment's module URL.
    throw new PdfModuleLoadError(error)
  }
}
