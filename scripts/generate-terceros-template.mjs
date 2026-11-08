import { createServer } from 'vite'
import XLSX from 'xlsx'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
try {
  const { createTercerosTemplate, TERCEROS_TEMPLATE_FILENAME } = await server.ssrLoadModule('/src/utils/jarvisTercerosExcel.ts')
  XLSX.writeFile(createTercerosTemplate(), `artifacts/${TERCEROS_TEMPLATE_FILENAME}`, { compression: true })
  console.log(`Plantilla creada en artifacts/${TERCEROS_TEMPLATE_FILENAME}`)
} finally {
  await server.close()
}
