import { createServer } from 'vite'
import { writeFile } from 'node:fs/promises'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
try {
  const { createTercerosTemplateFile, TERCEROS_TEMPLATE_FILENAME } = await server.ssrLoadModule('/src/utils/jarvisTercerosExcel.ts')
  await writeFile(`artifacts/${TERCEROS_TEMPLATE_FILENAME}`, new Uint8Array(createTercerosTemplateFile()))
  console.log(`Plantilla creada en artifacts/${TERCEROS_TEMPLATE_FILENAME}`)
} finally {
  await server.close()
}
