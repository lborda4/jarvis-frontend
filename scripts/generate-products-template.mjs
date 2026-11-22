import { createServer } from 'vite'
import { writeFile } from 'node:fs/promises'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
try {
  const { createProductsTemplateFile, PRODUCTS_TEMPLATE_FILENAME } = await server.ssrLoadModule('/src/utils/productsExcel.ts')
  await writeFile(`artifacts/${PRODUCTS_TEMPLATE_FILENAME}`, new Uint8Array(createProductsTemplateFile()))
  console.log(`Plantilla creada en artifacts/${PRODUCTS_TEMPLATE_FILENAME}`)
} finally {
  await server.close()
}
