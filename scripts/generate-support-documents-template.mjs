import { createServer } from 'vite'
import { mkdir, writeFile } from 'node:fs/promises'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
try {
  const { createSupportDocumentsTemplateFile, SUPPORT_TEMPLATE_FILENAME } = await server.ssrLoadModule('/src/utils/supportDocumentsExcel.ts')
  await mkdir('artifacts', { recursive: true })
  await writeFile(`artifacts/${SUPPORT_TEMPLATE_FILENAME}`, new Uint8Array(createSupportDocumentsTemplateFile()))
  console.log(`Plantilla creada en artifacts/${SUPPORT_TEMPLATE_FILENAME}`)
} finally { await server.close() }
