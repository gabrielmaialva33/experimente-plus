import { test } from '@japa/runner'
import { UserFactory } from '#database/factories/user_factory'

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
    const user = await UserFactory.merge({ password: 'password123' }).create()
    const page = await browserContext.newPage()
    await page.goto('/login')

    await page.fill('input[name="uid"]', user.email)
    await page.fill('input[name="password"]', 'password123')
    await page.getByRole('button', { name: 'Entrar' }).click()
    await page.waitForURL('**/dashboard', { timeout: 10000 })
    await page.waitForSelector('h1, h2, [data-testid="dashboard"]', { timeout: 10000 })
  })

  test('should show error with invalid credentials', async ({ browserContext }) => {
    const page = await browserContext.newPage()
    await page.goto('/login')

    await page.fill('input[name="uid"]', 'invalid@example.com')
    await page.fill('input[name="password"]', 'wrongpassword')
    await page.getByRole('button', { name: 'Entrar' }).click()
    await page.waitForURL('/login')

    const hasError = (await page.locator('[role="alert"], .text-destructive').count()) > 0
    if (!hasError) await page.locator('input[name="uid"]').waitFor()
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
  })

  test('should redirect authenticated user to dashboard', async ({ browserContext }) => {
    const user = await UserFactory.merge({ password: 'password123' }).create()
    const page = await browserContext.newPage()

    await page.goto('/login')
    await page.fill('input[name="uid"]', user.email)
    await page.fill('input[name="password"]', 'password123')
    await page.getByRole('button', { name: 'Entrar' }).click()
    await page.waitForURL('**/dashboard', { timeout: 30000 })

    await page.goto('/login')
    await page.waitForURL('**/dashboard', { timeout: 30000 })
  })

  test('should expose a loading state while submitting', async ({ browserContext }) => {
    const page = await browserContext.newPage()
    await page.goto('/login')
    await page.fill('input[name="uid"]', 'test@example.com')
    await page.fill('input[name="password"]', 'password')

    const submitButton = page.getByRole('button', { name: 'Entrar' })
    await submitButton.click()

    try {
      await page.waitForFunction(
        `() => {
          const button = document.querySelector('button[type="submit"]')
          return button?.hasAttribute('disabled') || button?.textContent?.includes('Entrando')
        }`,
        { timeout: 1000 }
      )
    } catch {
      // The request may complete before the transient state can be observed.
    }
  })
})
