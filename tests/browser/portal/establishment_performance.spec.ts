import { randomUUID } from 'node:crypto'

import { test } from '@japa/runner'
import type { Page } from 'playwright'

import { createBenefitFlowScenario } from '#database/factories/scenarios/benefit_flow_factory'
import { gotoAppPage } from '#tests/browser/helpers/navigation'
import { removeCommittedOperation, usersOnlyIn } from '#tests/helpers/committed_fixtures'

async function signIn(page: Page, email: string, password: string) {
  await gotoAppPage(page, '/login')
  await page.fill('input[name="uid"]', email)
  await page.fill('input[name="password"]', password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await page.waitForURL('**/portal', { timeout: 30_000 })
}

/**
 * The partner portal is used on phones: a place's "Desempenho" has to read
 * there without scrolling sideways, from the menu entry to the numbers.
 */
test.group('Place performance in the browser', () => {
  test('opens from the menu and fits a phone screen', async ({
    assert,
    browserContext,
    cleanup,
  }) => {
    const scenario = await createBenefitFlowScenario({
      suffix: `browser-performance-${randomUUID().slice(0, 8)}`,
      withRedemption: true,
    })
    cleanup(async () => {
      await removeCommittedOperation(scenario.tenant.id, await usersOnlyIn(scenario.tenant.id))
    })

    const page = await browserContext.newPage()
    await page.setViewportSize({ width: 390, height: 844 })
    await signIn(page, scenario.users.partner.email, scenario.credentials.password)

    // A partner with a single place lands straight on its numbers.
    await gotoAppPage(page, '/portal/performance')
    await page.waitForURL(`**/portal/establishments/${scenario.establishment.id}/performance`, {
      timeout: 30_000,
    })
    await page.getByRole('navigation', { name: 'Período' }).waitFor()

    const used = page.getByRole('article', { name: 'Benefícios utilizados' })
    await used.getByText('1', { exact: true }).waitFor()
    await page.getByRole('article', { name: 'Venda estimada' }).waitFor()
    await page.getByRole('link', { name: 'Edição atual' }).waitFor()

    const width = await page.evaluate(() => ({
      page: (globalThis as any).document.documentElement.scrollWidth as number,
      viewport: (globalThis as any).innerWidth as number,
    }))
    assert.isAtMost(width.page, width.viewport)

    // The period links keep the reader on the same place.
    await page.getByRole('link', { name: 'Últimos 90 dias' }).click()
    await page.waitForURL('**/performance?period=last_90_days', { timeout: 30_000 })
    assert.equal(
      await page.getByRole('link', { name: 'Últimos 90 dias' }).getAttribute('aria-current'),
      'page'
    )
  })
})
