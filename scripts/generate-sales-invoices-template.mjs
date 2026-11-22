import { createServer } from 'vite'
import { writeFile } from 'node:fs/promises'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
try {
  const { createSalesInvoicesTemplateFile, SALES_TEMPLATE_FILENAME } = await server.ssrLoadModule('/src/utils/salesInvoicesExcel.ts')
  await writeFile(`artifacts/${SALES_TEMPLATE_FILENAME}`, new Uint8Array(createSalesInvoicesTemplateFile()))
  console.log(`Plantilla creada en artifacts/${SALES_TEMPLATE_FILENAME}`)
} finally { await server.close() }
