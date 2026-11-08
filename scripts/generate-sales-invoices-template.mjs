import { createServer } from 'vite'
import XLSX from 'xlsx'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
try {
  const { createSalesInvoicesTemplate, SALES_TEMPLATE_FILENAME } = await server.ssrLoadModule('/src/utils/salesInvoicesExcel.ts')
  XLSX.writeFile(createSalesInvoicesTemplate(), `artifacts/${SALES_TEMPLATE_FILENAME}`, { compression: true })
  console.log(`Plantilla creada en artifacts/${SALES_TEMPLATE_FILENAME}`)
} finally { await server.close() }
