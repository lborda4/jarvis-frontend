import { createServer } from 'vite'
import XLSX from 'xlsx'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
try {
  const { createProductsTemplate, PRODUCTS_TEMPLATE_FILENAME } = await server.ssrLoadModule('/src/utils/productsExcel.ts')
  XLSX.writeFile(createProductsTemplate(), `artifacts/${PRODUCTS_TEMPLATE_FILENAME}`, { compression: true })
  console.log(`Plantilla creada en artifacts/${PRODUCTS_TEMPLATE_FILENAME}`)
} finally {
  await server.close()
}
