import { test } from '@japa/runner'
import type { BrowserContext, Page } from 'playwright'

import { createBenefitFlowScenario } from '#database/factories/scenarios/benefit_flow_factory'
import { gotoAppPage } from '#tests/browser/helpers/navigation'

type PresentationPagePayload = {
  props: {
    presentation: {
      token: string
      validation_url: string
    }
  }
}

async function signIn(
  page: Page,
  email: string,
  password: string,
  expectedLanding: '/wallet' | '/portal'
) {
  await gotoAppPage(page, '/login')
  await page.fill('input[name="uid"]', email)
  await page.fill('input[name="password"]', password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await page.waitForURL(`**${expectedLanding}`, { timeout: 30_000 })
}

async function resetSession(browserContext: BrowserContext) {
  await browserContext.clearCookies()
  for (const page of browserContext.pages()) {
    await page.close()
  }
}

test.group('Benefit redemption browser flow', () => {
  test('lets a holder present a benefit, a partner redeem it, and both see the receipt', async ({
    assert,
    browserContext,
  }) => {
    const scenario = await createBenefitFlowScenario({ suffix: 'browser-redemption' })
    const password = scenario.credentials.password

    await browserContext.grantPermissions(['clipboard-read', 'clipboard-write'])
    const holderPage = await browserContext.newPage()
    await holderPage.setViewportSize({ width: 390, height: 844 })
    await signIn(holderPage, scenario.users.holder.email, password, '/wallet')
    await gotoAppPage(holderPage, '/carteira')

    await holderPage.getByRole('heading', { name: 'Minha carteira' }).waitFor()
    await holderPage.keyboard.press('Tab')
    assert.isTrue(
      await holderPage.evaluate(
        () =>
          (globalThis as any).document.activeElement?.textContent?.includes(
            'Pular para o conteúdo principal'
          ) === true
      )
    )
    assert.equal(await holderPage.locator('main#conteudo-principal').count(), 1)
    assert.isFalse(
      await holderPage.evaluate(
        () =>
          (globalThis as any).document.documentElement.scrollWidth > (globalThis as any).innerWidth
      )
    )
    await holderPage.getByText('Disponível agora', { exact: true }).waitFor()
    await holderPage.getByRole('heading', { name: scenario.offer.title }).waitFor()
    await holderPage.getByRole('link', { name: 'Usar benefício' }).waitFor()

    const presentationResponsePromise = holderPage.waitForResponse(
      (response) =>
        response.request().method() === 'GET' &&
        response
          .url()
          .includes(`/wallet/accesses/${scenario.access.id}/offers/${scenario.offer.id}/use`)
    )
    await holderPage.getByRole('link', { name: 'Usar benefício' }).click()
    const presentationResponse = await presentationResponsePromise
    const payload = (await presentationResponse.json()) as PresentationPagePayload

    await holderPage.getByRole('heading', { name: 'Usar benefício' }).waitFor()
    assert.isFalse(
      await holderPage.evaluate(
        () =>
          (globalThis as any).document.documentElement.scrollWidth > (globalThis as any).innerWidth
      )
    )
    await holderPage
      .getByRole('img', { name: 'QR Code temporário para validar o benefício' })
      .waitFor()
    assert.isTrue(payload.props.presentation.token.length > 40)
    await holderPage.getByRole('button', { name: 'Copiar link de validação' }).click()
    await holderPage.getByRole('button', { name: 'Link copiado' }).waitFor()
    assert.equal(
      await holderPage.evaluate(() =>
        (
          navigator as unknown as { clipboard: { readText(): Promise<string> } }
        ).clipboard.readText()
      ),
      payload.props.presentation.validation_url
    )

    await resetSession(browserContext)

    const partnerPage = await browserContext.newPage()
    await signIn(partnerPage, scenario.users.partner.email, password, '/portal')
    await gotoAppPage(partnerPage, payload.props.presentation.validation_url)

    await partnerPage.getByRole('heading', { name: 'Validar benefício' }).waitFor()
    await partnerPage.getByText('Apresentação válida', { exact: true }).waitFor()
    await partnerPage.getByText(scenario.users.holder.full_name, { exact: false }).waitFor()
    await partnerPage.getByRole('heading', { name: scenario.offer.title }).waitFor()

    await partnerPage.getByRole('button', { name: 'Confirmar utilização', exact: true }).click()
    const confirmationDialog = partnerPage.getByRole('alertdialog')
    await confirmationDialog.waitFor()
    await confirmationDialog
      .getByRole('button', { name: 'Confirmar utilização', exact: true })
      .click()
    await partnerPage.waitForURL(/\/portal\/redemptions\/EXP-[A-F0-9]{16}$/, {
      timeout: 30_000,
    })
    await partnerPage.getByText('Utilização confirmada', { exact: true }).waitFor()
    await partnerPage.getByText(scenario.offer.terms!, { exact: true }).waitFor()

    const receiptCode = new URL(partnerPage.url()).pathname.split('/').at(-1)
    assert.exists(receiptCode)
    await partnerPage.getByText(receiptCode!, { exact: true }).waitFor()

    await resetSession(browserContext)

    const holderHistoryPage = await browserContext.newPage()
    await signIn(holderHistoryPage, scenario.users.holder.email, password, '/wallet')
    await gotoAppPage(holderHistoryPage, '/wallet/history')

    await holderHistoryPage.getByRole('heading', { name: 'Utilizações' }).waitFor()
    await holderHistoryPage.getByText('1 utilização', { exact: true }).waitFor()
    await holderHistoryPage.getByText(receiptCode!, { exact: true }).waitFor()
    await holderHistoryPage.getByRole('heading', { name: scenario.offer.title }).waitFor()
    await holderHistoryPage.getByRole('link', { name: 'Ver comprovante' }).click()
    await holderHistoryPage.waitForURL(`**/wallet/redemptions/${receiptCode}`)
    await holderHistoryPage
      .getByText('Regras vigentes no momento da utilização', { exact: true })
      .waitFor()
    await holderHistoryPage.getByText(scenario.offer.terms!, { exact: true }).waitFor()
  })
})
