import { createServer } from 'vite'
import XLSX from 'xlsx'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
try {
  const { createSupportDocumentsTemplate, SUPPORT_TEMPLATE_FILENAME } = await server.ssrLoadModule('/src/utils/supportDocumentsExcel.ts')
  XLSX.writeFile(createSupportDocumentsTemplate(), `artifacts/${SUPPORT_TEMPLATE_FILENAME}`, { compression: true })
  console.log(`Plantilla creada en artifacts/${SUPPORT_TEMPLATE_FILENAME}`)
} finally { await server.close() }
