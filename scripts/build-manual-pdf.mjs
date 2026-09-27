// Renders the /manual page of a running server to public/manual-media/manual-experimente-plus.pdf.
//
// Usage (with the site running, e.g. `pnpm dev`):
//   node scripts/build-manual-pdf.mjs
//   MANUAL_URL=http://localhost:3360/manual node scripts/build-manual-pdf.mjs
//
// The page's print rules hide the site's header, footer and navigation, open each
// chapter on a new page and list the contents at the start. Rebuild the PDF and
// commit it whenever the manual changes.
import { stat } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const manualUrl = process.env.MANUAL_URL ?? 'http://localhost:3333/manual'
const pdfPath = resolve(root, 'public/manual-media/manual-experimente-plus.pdf')

const browser = await chromium.launch()
try {
  const context = await browser.newContext({
    colorScheme: 'light',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
  })
  // The manual is printed in the light theme, whatever the site remembers.
  await context.addInitScript(() => {
    try {
      window.localStorage.setItem('theme', 'light')
    } catch {}
  })
  const page = await context.newPage()
  const response = await page.goto(manualUrl, { waitUntil: 'networkidle' })
  if (!response?.ok()) throw new Error(`${manualUrl} answered ${response?.status()}`)

  // Screenshots load lazily on screen; a printout needs all of them now.
  await page.evaluate(() => {
    for (const image of document.querySelectorAll('img[loading="lazy"]')) image.loading = 'eager'
  })
  await page.waitForFunction(
    () => [...document.images].every((image) => image.complete && image.naturalWidth > 0),
    null,
    { timeout: 60_000 }
  )
  await page.evaluate(() => document.fonts.ready)

  // Chromium stores a WebP in the PDF losslessly, which made a 15 MB file; a JPEG
  // goes in as it is. Each screenshot becomes a JPEG at print resolution first.
  await page.evaluate(async () => {
    const images = [...document.querySelectorAll('main img')]
    for (const image of images) {
      const maxWidth = image.naturalWidth > image.naturalHeight ? 1200 : 560
      const scale = Math.min(1, maxWidth / image.naturalWidth)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(image.naturalWidth * scale)
      canvas.height = Math.round(image.naturalHeight * scale)
      const context = canvas.getContext('2d')
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      image.src = canvas.toDataURL('image/jpeg', 0.8)
      await image.decode()
    }
  })

  await page.emulateMedia({ media: 'print', colorScheme: 'light' })
  await page.pdf({
    path: pdfPath,
    format: 'A4',
    printBackground: true,
    margin: { top: '16mm', bottom: '18mm', left: '14mm', right: '14mm' },
    displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate: `
      <div style="width: 100%; padding: 0 14mm; font-family: sans-serif; font-size: 8px; color: #5b6472; display: flex; justify-content: space-between;">
        <span>Manual do Experimente+ · versão beta, dados de demonstração</span>
        <span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span>
      </div>`,
  })

  const { size } = await stat(pdfPath)
  console.log(`PDF gerado: ${pdfPath} (${(size / 1024 / 1024).toFixed(1)} MB)`)
} finally {
  await browser.close()
}
