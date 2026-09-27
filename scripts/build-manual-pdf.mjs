// Renders the /manual page of a running server to public/manual-media/manual-experimente-plus.pdf.
//
// Usage (with the site running, e.g. `pnpm dev`):
//   node scripts/build-manual-pdf.mjs
//   MANUAL_URL=http://localhost:3360/manual node scripts/build-manual-pdf.mjs
//
// The page's print rules hide the site's header, footer and navigation, open each
// chapter on a new page and list the contents at the start. The PDF also carries
// bookmarks for every chapter and task. With `pdftotext` (poppler) installed, the
// contents list and every cross-reference get their page numbers: the PDF is
// printed once, the pages are read back from its text and it is printed again.
// Rebuild the PDF and commit it whenever the manual changes.
import { spawnSync } from 'node:child_process'
import { mkdtemp, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const manualUrl = process.env.MANUAL_URL ?? 'http://localhost:3333/manual'
const pdfPath = resolve(root, 'public/manual-media/manual-experimente-plus.pdf')

const PDF_OPTIONS = {
  format: 'A4',
  printBackground: true,
  outline: true,
  tagged: true,
  margin: { top: '16mm', bottom: '18mm', left: '14mm', right: '14mm' },
  displayHeaderFooter: true,
  headerTemplate: '<span></span>',
  footerTemplate: `
    <div style="width: 100%; padding: 0 14mm; font-family: sans-serif; font-size: 8px; color: #5b6472; display: flex; justify-content: space-between;">
      <span>Manual do Experimente+ · versão beta, dados de demonstração</span>
      <span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span>
    </div>`,
}

/** Lower case, no accents, single spaces: how a heading is looked up in the PDF text. */
function normalize(text) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[“”"'’]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function hasPdfToText() {
  return spawnSync('pdftotext', ['-v'], { stdio: 'ignore' }).status === 0
}

/**
 * The page each part starts on: its heading followed by the first words of the
 * line under it, searched in order, so a mention of the same title elsewhere (in
 * the contents or in a cross-reference) is not mistaken for the part itself.
 */
function locate(pdfFile, parts) {
  const text = spawnSync('pdftotext', ['-enc', 'UTF-8', pdfFile, '-'], { encoding: 'utf8' }).stdout
  const pages = text.split('\f').map(normalize)
  const found = {}
  let from = 0
  for (const part of parts) {
    const needle = normalize(`${part.title} ${part.after}`).slice(0, part.title.length + 24)
    const index = pages.findIndex((page, number) => number >= from && page.includes(needle))
    if (index === -1) continue
    found[part.id] = index + 1
    from = index
  }
  return found
}

const browser = await chromium.launch()
const work = await mkdtemp(join(tmpdir(), 'manual-pdf-'))
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
      const maxWidth = image.naturalWidth > image.naturalHeight ? 1000 : 520
      const scale = Math.min(1, maxWidth / image.naturalWidth)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(image.naturalWidth * scale)
      canvas.height = Math.round(image.naturalHeight * scale)
      const context = canvas.getContext('2d')
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      image.src = canvas.toDataURL('image/jpeg', 0.78)
      await image.decode()
    }
  })

  // On paper a link cannot be followed: after each link to another part of the
  // manual, the PDF names that part (when the link says something else) and its page.
  await page.evaluate(() => {
    for (const link of document.querySelectorAll('main a[href^="#"]')) {
      if (link.closest('nav, [role="search"]')) continue
      const id = link.getAttribute('href').slice(1)
      const target = document.getElementById(id)
      const heading = target?.querySelector('h2, h3')
      if (!heading) continue
      const title = heading.textContent.trim()
      const reference = document.createElement('span')
      reference.dataset.printRef = id
      reference.dataset.printTitle =
        title.toLowerCase() === link.textContent.trim().toLowerCase() ? '' : title
      link.after(reference)
    }
  })

  const parts = await page.evaluate(() =>
    [...document.querySelectorAll('main section[aria-labelledby]')].map((section) => {
      const heading = document.getElementById(section.getAttribute('aria-labelledby'))
      let next = heading?.nextElementSibling
      while (next && next.tagName !== 'P') next = next.nextElementSibling
      return {
        id: section.id,
        title: heading?.textContent.trim() ?? '',
        after: next?.textContent.trim().slice(0, 40) ?? '',
      }
    })
  )

  /** Writes the page numbers (or the "00" placeholders of the first print) into the page. */
  const fill = (pages) =>
    page.evaluate((pages) => {
      for (const span of document.querySelectorAll('[data-print-page]')) {
        span.textContent = pages[span.dataset.printPage]
          ? String(pages[span.dataset.printPage])
          : ''
      }
      for (const span of document.querySelectorAll('[data-print-ref]')) {
        const number = pages[span.dataset.printRef]
        const title = span.dataset.printTitle
        const where = number ? `p. ${number}` : ''
        span.textContent = title
          ? ` (“${title}”${where ? `, ${where}` : ''})`
          : where
            ? ` (${where})`
            : ''
      }
    }, pages)

  await page.emulateMedia({ media: 'print', colorScheme: 'light' })

  if (hasPdfToText()) {
    // Two-digit placeholders keep the layout of the numbered print.
    let pages = Object.fromEntries(parts.map((part) => [part.id, '00']))
    let previous = ''
    for (let round = 1; round <= 3; round++) {
      await fill(pages)
      const draft = join(work, `round-${round}.pdf`)
      await page.pdf({ ...PDF_OPTIONS, path: draft })
      pages = locate(draft, parts)
      const missing = parts.filter((part) => !pages[part.id]).map((part) => part.id)
      if (missing.length) console.warn(`Sem página para: ${missing.join(', ')}`)
      const current = JSON.stringify(pages)
      if (current === previous) break
      previous = current
    }
    await fill(pages)
  } else {
    console.warn('pdftotext (poppler) não encontrado: o sumário sai sem números de página.')
    await fill({})
  }

  await page.pdf({ ...PDF_OPTIONS, path: pdfPath })

  const { size } = await stat(pdfPath)
  console.log(`PDF gerado: ${pdfPath} (${(size / 1024 / 1024).toFixed(1)} MB)`)
} finally {
  await browser.close()
  await rm(work, { recursive: true, force: true })
}
