import { test } from '@japa/runner'
import type { Page } from 'playwright'

import { createBenefitFlowScenario } from '#database/factories/scenarios/benefit_flow_factory'

async function signIn(page: Page, email: string, password: string) {
  await page.goto('/login')
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
    await page.goto('/backoffice/benefits')

    await page.getByRole('heading', { name: 'Edições e benefícios' }).waitFor()
    const edition = page.locator('article').filter({ hasText: scenario.edition.name })
    await edition.getByRole('heading', { name: scenario.edition.name }).waitFor()
    await edition.getByText('1 de 1', { exact: true }).waitFor()
    await edition.getByText('Acessos ativos', { exact: true }).waitFor()
    await edition.getByText('1', { exact: true }).waitFor()
  })
})
