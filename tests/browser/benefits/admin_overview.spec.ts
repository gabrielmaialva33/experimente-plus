import { test } from '@japa/runner'
import type { Page } from 'playwright'

import { createBenefitFlowScenario } from '#database/factories/scenarios/benefit_flow_factory'
import { gotoAppPage } from '#tests/browser/helpers/navigation'

async function signIn(page: Page, email: string, password: string) {
  await gotoAppPage(page, '/login')
  await page.fill('input[name="uid"]', email)
  await page.fill('input[name="password"]', password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await page.waitForURL('**/dashboard', { timeout: 30_000 })
}

test.group('Benefit administration browser flow', () => {
  test('renders offer and access totals for published editions', async ({ browserContext }) => {
    const scenario = await createBenefitFlowScenario({ suffix: 'browser-admin-overview' })
    const page = await browserContext.newPage()

    await signIn(page, scenario.users.admin.email, scenario.credentials.password)
    await gotoAppPage(page, '/backoffice/benefits')

    await page.getByRole('heading', { name: 'Edições e benefícios' }).waitFor()
    const edition = page.locator('article').filter({ hasText: scenario.edition.name })
    await edition.getByRole('heading', { name: scenario.edition.name }).waitFor()
    await edition.getByText('1 de 1', { exact: true }).waitFor()
    await edition.getByText('Acessos ativos', { exact: true }).waitFor()
    await edition.getByText('1', { exact: true }).waitFor()
  })

  // Web audit W25: at 390px the "Nova edição" form scrolled 508px sideways and
  // cut its hints at the right edge.
  test('fits a phone screen without sideways scrolling', async ({ assert, browserContext }) => {
    const scenario = await createBenefitFlowScenario({ suffix: 'browser-admin-phone' })
    const page = await browserContext.newPage()
    await page.setViewportSize({ width: 390, height: 844 })

    await signIn(page, scenario.users.admin.email, scenario.credentials.password)
    await gotoAppPage(page, '/backoffice/benefits')
    await page.getByRole('heading', { name: 'Edições e benefícios' }).waitFor()
    await page.getByLabel('Cidade').waitFor()

    const width = await page.evaluate(() => ({
      page: (globalThis as any).document.documentElement.scrollWidth as number,
      viewport: (globalThis as any).innerWidth as number,
    }))
    assert.isAtMost(width.page, width.viewport)
  })
})
