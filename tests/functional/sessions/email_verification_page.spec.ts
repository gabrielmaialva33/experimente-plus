import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'
import mail from '@adonisjs/mail/services/main'
import { DateTime } from 'luxon'

import type { EmailVerificationPageProps } from '#modules/auth/interfaces/email_verification_page'
import EmailVerificationTokenService from '#modules/auth/services/email_verification_token_service'
import SendVerificationEmailService from '#modules/auth/services/send_verification_email_service'
import VerifyEmailNotification from '#modules/auth/services/verify_email_notification'
import IRole from '#modules/roles/interfaces/role_interface'
import Role from '#modules/roles/models/role'
import User from '#modules/users/models/user'

const PAGE = '/verificar-email'
const FLASH_KEY = 'email_verification'
const BROWSER_ACCEPT = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'

function pageProps(response: { text(): string }): EmailVerificationPageProps {
  const match = response
    .text()
    .match(/<script data-page="app" type="application\/json">([\s\S]*?)<\/script>/)
  if (!match?.[1]) {
    throw new Error('The response does not contain an Inertia page payload')
  }
  const page = JSON.parse(match[1]) as { component: string; props: EmailVerificationPageProps }
  if (page.component !== 'auth/verify_email') {
    throw new Error(`Unexpected Inertia component: ${page.component}`)
  }
  return { outcome: page.props.outcome, viewer: page.props.viewer }
}

let sequence = 0

/** An account waiting for confirmation, with the raw token its e-mail carries. */
async function pendingAccount(options: { sentAt?: DateTime; verified?: boolean } = {}) {
  sequence += 1
  const tokenService = await app.container.make(EmailVerificationTokenService)
  const { token, tokenHash } = tokenService.generate()
  const user = await User.create({
    full_name: `Confirmação ${sequence}`,
    email: `confirmacao-${sequence}@example.com`,
    password: 'password123',
    metadata: {
      email_verified: options.verified ?? false,
      email_verified_at: options.verified ? DateTime.now().toISO() : null,
      email_verification_sent_at: (options.sentAt ?? DateTime.now()).toISO(),
      email_verification_token_hash: tokenHash,
    },
  })
  const role = await Role.findByOrFail('slug', IRole.Slugs.USER)
  await user.related('roles').attach([role.id])

  return { user, token }
}

test.group('E-mail confirmation page', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(async () => {
    await limiter.clear()
    return () => limiter.clear()
  })

  test('links the confirmation e-mail to the web page', async ({ assert, cleanup }) => {
    mail.restore()
    const { mails } = mail.fake()
    cleanup(() => mail.restore())
    const { user } = await pendingAccount()

    const service = await app.container.make(SendVerificationEmailService)
    assert.equal(await service.handle(user.id), 'sent')

    const notification = mails.sent()[0] as VerifyEmailNotification
    const message = notification.message.toJSON().message as { text?: string; html?: string }
    const link = `/verificar-email?token=${encodeURIComponent(notification.getVerificationToken())}`
    assert.include(message.text, link)
    assert.include(message.html, link)
    assert.notInclude(`${message.text}${message.html}`, '/api/v1/verify-email')
  })

  test('confirms the address and drops the token from the address bar', async ({
    client,
    assert,
  }) => {
    const { user, token } = await pendingAccount()

    const response = await client.get(`${PAGE}?token=${token}`).redirects(0)

    response.assertStatus(302)
    assert.equal(response.header('location'), PAGE)
    assert.equal(response.header('cache-control'), 'private, no-store')
    assert.equal(response.header('referrer-policy'), 'no-referrer')
    response.assertFlashMessage(FLASH_KEY, 'confirmed')
    await user.refresh()
    assert.isTrue(user.metadata.email_verified)
    assert.isNull(user.metadata.email_verification_token_hash)

    const page = await client.get(PAGE).withFlashMessages({ [FLASH_KEY]: 'confirmed' })
    page.assertStatus(200)
    assert.deepEqual(pageProps(page), {
      outcome: 'confirmed',
      viewer: { signed_in: false, email: null, email_verified: null },
    })
    assert.notInclude(page.text(), token)
  })

  test('tells expired, already confirmed and unknown links apart', async ({ client, assert }) => {
    const expired = await pendingAccount({ sentAt: DateTime.now().minus({ hours: 25 }) })
    const expiredResponse = await client.get(`${PAGE}?token=${expired.token}`).redirects(0)
    expiredResponse.assertFlashMessage(FLASH_KEY, 'expired')
    await expired.user.refresh()
    assert.isFalse(expired.user.metadata.email_verified)

    const already = await pendingAccount({ verified: true })
    const alreadyResponse = await client.get(`${PAGE}?token=${already.token}`).redirects(0)
    alreadyResponse.assertFlashMessage(FLASH_KEY, 'already_confirmed')

    const unknown = await client.get(`${PAGE}?token=${'A'.repeat(43)}`).redirects(0)
    unknown.assertFlashMessage(FLASH_KEY, 'invalid')

    const malformed = await client.get(`${PAGE}?token=nem-parece-um-token`).redirects(0)
    malformed.assertFlashMessage(FLASH_KEY, 'invalid')

    // A consumed link no longer matches anything.
    const used = await pendingAccount()
    await client.get(`${PAGE}?token=${used.token}`).redirects(0)
    const reused = await client.get(`${PAGE}?token=${used.token}`).redirects(0)
    reused.assertFlashMessage(FLASH_KEY, 'invalid')
  })

  test('shows where a signed-in account stands and a used link to its owner', async ({
    client,
    assert,
  }) => {
    const pending = await pendingAccount()
    const confirmed = await pendingAccount({ verified: true })

    assert.deepEqual(pageProps(await client.get(PAGE).loginAs(pending.user)), {
      outcome: null,
      viewer: { signed_in: true, email: pending.user.email, email_verified: false },
    })
    // Opening the same link twice: "invalid" becomes "already confirmed" for its owner.
    assert.equal(
      pageProps(
        await client
          .get(PAGE)
          .withFlashMessages({ [FLASH_KEY]: 'invalid' })
          .loginAs(confirmed.user)
      ).outcome,
      'already_confirmed'
    )
    assert.equal(
      pageProps(await client.get(PAGE).withFlashMessages({ [FLASH_KEY]: 'invalid' })).outcome,
      'invalid'
    )
    // Only the four known outcomes are read back from the flash.
    assert.isNull(
      pageProps(await client.get(PAGE).withFlashMessages({ [FLASH_KEY]: '<script>' })).outcome
    )
  })

  test('sends a new link from the page to the signed-in account', async ({
    client,
    assert,
    cleanup,
  }) => {
    mail.restore()
    const { mails } = mail.fake()
    cleanup(() => mail.restore())
    const pending = await pendingAccount({ sentAt: DateTime.now().minus({ hours: 25 }) })
    const previousHash = pending.user.metadata.email_verification_token_hash

    const resend = await client
      .post(`${PAGE}/reenviar`)
      .withCsrfToken()
      .redirects(0)
      .loginAs(pending.user)
    resend.assertStatus(302)
    assert.equal(resend.header('location'), PAGE)
    resend.assertFlashMessage(
      'success',
      `Enviamos um novo link para ${pending.user.email}. Ele vale por 24 horas e substitui os anteriores.`
    )
    mails.assertSentCount(VerifyEmailNotification, 1)
    await pending.user.refresh()
    assert.notEqual(pending.user.metadata.email_verification_token_hash, previousHash)

    const confirmed = await pendingAccount({ verified: true })
    const noNeed = await client
      .post(`${PAGE}/reenviar`)
      .withCsrfToken()
      .redirects(0)
      .loginAs(confirmed.user)
    noNeed.assertFlashMessage(
      'success',
      'Seu e-mail já está confirmado. Não é preciso fazer mais nada.'
    )
    mails.assertSentCount(VerifyEmailNotification, 1)

    const guest = await client.post(`${PAGE}/reenviar`).withCsrfToken().redirects(0)
    guest.assertStatus(302)
    assert.equal(guest.header('location'), '/login')
  })

  test('sends browsers from old API links to the page and keeps JSON for API clients', async ({
    client,
    assert,
  }) => {
    const { user, token } = await pendingAccount()

    const browser = await client
      .get(`/api/v1/verify-email?token=${token}`)
      .header('accept', BROWSER_ACCEPT)
      .redirects(0)
    browser.assertStatus(302)
    assert.equal(browser.header('location'), `${PAGE}?token=${token}`)
    assert.equal(browser.header('cache-control'), 'private, no-store')
    // The redirect consumes nothing: the page does.
    await user.refresh()
    assert.isFalse(user.metadata.email_verified)

    const withoutToken = await client
      .get('/api/v1/verify-email')
      .header('accept', BROWSER_ACCEPT)
      .redirects(0)
    assert.equal(withoutToken.header('location'), PAGE)

    const api = await client
      .get(`/api/v1/verify-email?token=${token}`)
      .header('accept', 'application/json')
    api.assertStatus(200)
    api.assertBodyContains({ message: 'Email verified successfully', email_verified: true })
  })

  test('counts only the requests that consume a token against the limit', async ({
    client,
    assert,
  }) => {
    for (let attempt = 0; attempt < 12; attempt++) {
      const read = await client.get(PAGE)
      read.assertStatus(200)
    }

    for (let attempt = 0; attempt < 10; attempt++) {
      const consumed = await client.get(`${PAGE}?token=${'A'.repeat(43)}`).redirects(0)
      assert.equal(consumed.header('location'), PAGE)
    }
    const limited = await client.get(`${PAGE}?token=${'A'.repeat(43)}`).redirects(0)
    limited.assertStatus(302)
    assert.notEqual(limited.header('location'), PAGE)
    limited.assertFlashMessage('errors', {
      general: 'Muitas tentativas de confirmação. Tente de novo em alguns minutos.',
    })
  })

  test('returns to the page after signing in from it', async ({ client, assert }) => {
    const { user } = await pendingAccount()

    const login = await client
      .post('/login')
      .withCsrfToken()
      .redirects(0)
      .json({ uid: user.email, password: 'password123', next: PAGE })

    login.assertStatus(302)
    assert.equal(login.header('location'), PAGE)
  })
})
