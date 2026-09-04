import type { BrowserContext, Page } from 'playwright'

const preparedContexts = new WeakMap<BrowserContext, ReturnType<BrowserContext['route']>>()

function prepareContext(context: BrowserContext) {
  const existingPreparation = preparedContexts.get(context)
  if (existingPreparation) {
    return existingPreparation
  }

  /**
   * Application behavior does not depend on the hosted font. Keeping that
   * request out of browser tests prevents an unavailable third-party asset
   * from holding Playwright's navigation lifecycle open.
   */
  const preparation = context.route('https://fonts.bunny.net/**', (route) => route.abort())
  preparedContexts.set(context, preparation)

  return preparation
}

/**
 * Wait for the application document, then let each test's UI assertion define
 * when its React page is ready. The browser `load` event also waits on optional
 * assets and is therefore too broad for first-navigation readiness.
 */
export async function gotoAppPage(page: Page, url: string) {
  await prepareContext(page.context())
  await page.goto(url, { waitUntil: 'domcontentloaded' })
}
