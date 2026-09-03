import { test } from '@japa/runner'
import { TenantFactory, UserFactory } from '#database/factories/index'

async function createConsumer(password = 'password123') {
  const user = await UserFactory.merge({ password }).create()
  const tenant = await TenantFactory.create()
  await user.related('tenants').attach({ [tenant.id]: { role: 'member' } })
  return user
}

test.group('Auth login', () => {
  test('should display the localized login page correctly', async ({ browserContext }) => {
    const page = await browserContext.newPage()
    await page.goto('/login')

    await page.getByRole('heading', { name: 'Entrar' }).waitFor()
    await page.locator('input[name="uid"]').waitFor()
    await page.locator('input[name="password"]').waitFor()
    await page.getByRole('button', { name: 'Entrar' }).waitFor()
    await page.getByRole('link', { name: 'Criar conta' }).waitFor()
    await page.getByRole('link', { name: 'Esqueceu a senha?' }).waitFor()

    await page.keyboard.press('Tab')
    await page.getByRole('link', { name: 'Pular para o conteúdo principal' }).waitFor()
    const skipLinkFocused = await page.evaluate(
      `document.activeElement?.textContent?.includes('Pular para o conteúdo principal') === true`
    )
    if (!skipLinkFocused) throw new Error('O skip link deve ser o primeiro alvo do teclado')
  })

  test('should reveal and hide the password accessibly', async ({ browserContext }) => {
    const page = await browserContext.newPage()
    await page.goto('/login')

    const password = page.locator('input[name="password"]')
    await password.waitFor()
    await page.getByRole('button', { name: 'Mostrar senha' }).click()
    await page.locator('input[name="password"][type="text"]').waitFor()
    await page.getByRole('button', { name: 'Ocultar senha' }).click()
    await page.locator('input[name="password"][type="password"]').waitFor()
  })

  test('should login successfully with valid credentials', async ({ browserContext }) => {
    const user = await createConsumer()
    const page = await browserContext.newPage()
    await page.goto('/login')

    await page.fill('input[name="uid"]', user.email)
    await page.fill('input[name="password"]', 'password123')
    await page.getByRole('button', { name: 'Entrar' }).click()
    await page.waitForURL('**/wallet', { timeout: 10000 })
    await page.getByRole('heading', { name: 'Minha carteira' }).waitFor()
  })

  test('should show error with invalid credentials', async ({ browserContext }) => {
    const page = await browserContext.newPage()
    await page.goto('/login')

    await page.fill('input[name="uid"]', 'invalid@example.com')
    await page.fill('input[name="password"]', 'wrongpassword')
    await page.getByRole('button', { name: 'Entrar' }).click()
    await page.waitForURL('/login')
    await page
      .getByRole('alert')
      .getByText('Não foi possível entrar. Verifique suas credenciais e tente novamente.')
      .waitFor()
  })

  test('should keep required empty fields on the login page', async ({ browserContext }) => {
    const page = await browserContext.newPage()
    await page.goto('/login')

    await page.getByRole('button', { name: 'Entrar' }).click()
    await page.waitForURL('/login')
    await page.locator('input[name="uid"]:invalid').waitFor()
    await page.locator('input[name="password"]:invalid').waitFor()
  })

  test('should navigate to password recovery', async ({ browserContext }) => {
    const page = await browserContext.newPage()
    await page.goto('/login')

    await page.getByRole('link', { name: 'Esqueceu a senha?' }).click()
    await page.waitForURL('**/forgot-password')
    await page.getByRole('heading', { name: 'Esqueceu sua senha?' }).waitFor()
  })

  test('should navigate to register page', async ({ browserContext }) => {
    const page = await browserContext.newPage()
    await page.goto('/login')

    await page.getByRole('link', { name: 'Criar conta' }).click()
    await page.waitForURL('/register')
    await page.getByRole('heading', { name: 'Criar conta' }).waitFor()
    await page.getByRole('link', { name: /Termos de Uso.*abre em nova aba/ }).waitFor()
    await page.getByRole('link', { name: /Política de Privacidade.*abre em nova aba/ }).waitFor()
    const submit = page.getByRole('button', { name: 'Criar conta' })
    if (!(await submit.isDisabled()))
      throw new Error('Cadastro sem aceite deve permanecer desabilitado')
    await page.getByRole('checkbox', { name: 'Li e aceito os documentos obrigatórios' }).click()
    if (await submit.isDisabled()) throw new Error('Cadastro com aceite deve ser habilitado')
  })

  test('should keep registration and legal navigation usable at 390px', async ({
    browserContext,
  }) => {
    const page = await browserContext.newPage()
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/register')

    await page.keyboard.press('Tab')
    const skipLinkFocused = await page.evaluate(
      () =>
        (globalThis as any).document.activeElement?.textContent?.includes(
          'Pular para o conteúdo principal'
        ) === true
    )
    if (!skipLinkFocused) throw new Error('O skip link deve ser o primeiro alvo no cadastro')
    if ((await page.locator('main#conteudo-principal').count()) !== 1) {
      throw new Error('O cadastro deve expor um único conteúdo principal')
    }
    if (
      await page.evaluate(
        () =>
          (globalThis as any).document.documentElement.scrollWidth > (globalThis as any).innerWidth
      )
    ) {
      throw new Error('O cadastro não deve produzir overflow horizontal em 390px')
    }

    const legalAcceptance = page.getByRole('checkbox', {
      name: 'Li e aceito os documentos obrigatórios',
    })
    if ((await legalAcceptance.getAttribute('aria-required')) !== 'true') {
      throw new Error('O aceite legal deve comunicar que é obrigatório')
    }
    const submit = page.getByRole('button', { name: 'Criar conta' })
    if (!(await submit.isDisabled())) throw new Error('O CTA deve iniciar desabilitado')

    const registrationValues = {
      full_name: 'Maria Preservada',
      email: 'maria-preservada@example.com',
      username: 'maria.preservada',
      password: 'password123',
      password_confirmation: 'password123',
    }
    for (const [name, value] of Object.entries(registrationValues)) {
      await page.fill(`input[name="${name}"]`, value)
    }

    const termsTabPromise = browserContext.waitForEvent('page')
    await page.getByRole('link', { name: /Termos de Uso.*abre em nova aba/ }).click()
    const termsTab = await termsTabPromise
    await termsTab.getByRole('heading', { level: 1, name: 'Termos de Uso' }).waitFor()
    await termsTab.getByRole('link', { name: 'Voltar ao cadastro' }).waitFor()
    await termsTab.close()

    const privacyTabPromise = browserContext.waitForEvent('page')
    await page.getByRole('link', { name: /Política de Privacidade.*abre em nova aba/ }).click()
    const privacyTab = await privacyTabPromise
    await privacyTab.getByRole('heading', { level: 1, name: 'Política de Privacidade' }).waitFor()
    await privacyTab.getByRole('link', { name: 'Voltar ao cadastro' }).waitFor()
    await privacyTab.close()

    await page.waitForURL('**/register')
    for (const [name, value] of Object.entries(registrationValues)) {
      if ((await page.locator(`input[name="${name}"]`).inputValue()) !== value) {
        throw new Error(`O campo ${name} deve ser preservado ao consultar os documentos legais`)
      }
    }
    const browserStorage = await page.evaluate(() =>
      JSON.stringify({
        localStorage: Object.entries((globalThis as any).localStorage),
        sessionStorage: Object.entries((globalThis as any).sessionStorage),
        historyState: (globalThis as any).history.state,
      })
    )
    if (browserStorage.includes(registrationValues.password)) {
      throw new Error('A senha do cadastro não pode ser persistida no storage ou histórico')
    }

    const returnedAcceptance = page.getByRole('checkbox', {
      name: 'Li e aceito os documentos obrigatórios',
    })
    await returnedAcceptance.click()
    if (await page.getByRole('button', { name: 'Criar conta' }).isDisabled()) {
      throw new Error('O CTA deve habilitar depois do aceite')
    }
  })

  test('should expose one deterministic registration submission state', async ({
    browserContext,
  }) => {
    const page = await browserContext.newPage()
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/register')

    const unique = Date.now()
    await page.fill('input[name="full_name"]', 'Cadastro Loading')
    await page.fill('input[name="email"]', `cadastro-loading-${unique}@example.com`)
    await page.fill('input[name="username"]', `cadastro-loading-${unique}`)
    await page.fill('input[name="password"]', 'password123')
    await page.fill('input[name="password_confirmation"]', 'password123')
    await page.getByRole('checkbox', { name: 'Li e aceito os documentos obrigatórios' }).click()

    let submissionCount = 0
    await page.route('**/register', async (route) => {
      if (route.request().method() === 'POST') {
        submissionCount += 1
        await new Promise((resolve) => setTimeout(resolve, 500))
      }
      await route.continue()
    })

    await page.evaluate(() => {
      const button = (globalThis as any).document.querySelector(
        'form[aria-label="Criar conta"] button[type="submit"]'
      ) as { click(): void } | null
      button?.click()
      button?.click()
    })

    await page.locator('form[aria-label="Criar conta"][aria-busy="true"]').waitFor()
    const loadingButton = page.getByRole('button', { name: 'Criando conta...' })
    await loadingButton.waitFor()
    if (!(await loadingButton.isDisabled())) {
      throw new Error('O botão de cadastro deve ficar desabilitado durante o envio')
    }

    await page.waitForURL('**/wallet', { timeout: 15000 })
    if (submissionCount !== 1) {
      throw new Error(`O cadastro deve enviar uma requisição; recebeu ${submissionCount}`)
    }
  })

  test('should redirect an authenticated consumer to the wallet', async ({ browserContext }) => {
    const user = await createConsumer()
    const page = await browserContext.newPage()

    await page.goto('/login')
    await page.fill('input[name="uid"]', user.email)
    await page.fill('input[name="password"]', 'password123')
    await page.getByRole('button', { name: 'Entrar' }).click()
    await page.waitForURL('**/wallet', { timeout: 30000 })

    await page.goto('/login')
    await page.waitForURL('**/wallet', { timeout: 30000 })
  })

  test('should expose a loading state while submitting', async ({ browserContext }) => {
    const page = await browserContext.newPage()
    await page.goto('/login')
    await page.fill('input[name="uid"]', 'test@example.com')
    await page.fill('input[name="password"]', 'password')

    await page.route('**/login', async (route) => {
      if (route.request().method() === 'POST') {
        await new Promise((resolve) => setTimeout(resolve, 500))
      }
      await route.continue()
    })

    const submitButton = page.getByRole('button', { name: 'Entrar' })
    await submitButton.click()

    await page.locator('form[aria-label="Entrar"][aria-busy="true"]').waitFor()
    const loadingButton = page.getByRole('button', { name: 'Entrando...' })
    await loadingButton.waitFor()
    if (!(await loadingButton.isDisabled()))
      throw new Error('O botão deve ser desabilitado no envio')
  })
})
